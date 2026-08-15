import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import {
  PaymentProvider,
  CreatePaymentIntentParams,
  PaymentIntentResult,
  ConfirmPaymentParams,
  PaymentResult,
  RefundPaymentParams,
  RefundResult,
  PaymentStatus,
  WebhookResult,
} from '../interfaces/payment-provider.interface';
import { CircuitBreaker } from '../../common/utils/circuit-breaker';
import { fromMinorUnits, toMinorUnits } from '../../common/money';
import { IntegrationsService } from '../../integrations/integrations.service';

function isValidStripeSecretKey(key?: string | null): key is string {
  const trimmed = key?.trim();
  return !!trimmed && (trimmed.startsWith('sk_test_') || trimmed.startsWith('sk_live_'));
}

@Injectable()
export class StripeProvider implements PaymentProvider, OnModuleInit {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;
  /** When false, skip STRIPE_SECRET_KEY fallback (admin deactivated/deleted Stripe). */
  private allowEnvFallback = true;
  private readonly circuitBreaker = new CircuitBreaker({
    name: 'stripe',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 1,
  });

  constructor(
    private configService: ConfigService,
    private integrationsService: IntegrationsService,
  ) {}

  async onModuleInit() {
    // Prefer admin integrations; env is fallback only. Never keep placeholder keys.
    await this.initFromIntegrations();
    if (!this.stripe && this.allowEnvFallback) {
      this.initFromEnv();
    }
  }

  private initFromEnv(): void {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY')?.trim();
    if (!stripeKey) return;
    if (!isValidStripeSecretKey(stripeKey)) {
      this.logger.warn(
        'Ignoring STRIPE_SECRET_KEY env value — expected sk_test_/sk_live_ (placeholder keys are rejected)',
      );
      return;
    }
    this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || null;
    this.circuitBreaker.reset();
    this.logger.log('Stripe provider initialized from env vars');
  }

  /**
   * Re-initialize from integrations DB. Called on startup and when
   * Stripe integration is activated/updated at runtime.
   */
  async initFromIntegrations(): Promise<void> {
    try {
      const creds = await this.integrationsService.getDecryptedCredentials('PAYMENT', 'stripe');
      const secretKey = creds.secretKey?.trim();
      if (!secretKey) {
        this.logger.warn('Stripe integration has no secretKey');
        this.stripe = null;
        this.webhookSecret = null;
        return;
      }
      if (!isValidStripeSecretKey(secretKey)) {
        this.logger.error(
          'Stripe integration secretKey is invalid (expected sk_test_/sk_live_). Payments will fail until a real secret is saved.',
        );
        this.stripe = null;
        this.webhookSecret = null;
        return;
      }
      this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
      this.webhookSecret = creds.webhookSecret?.trim() || null;
      this.circuitBreaker.reset();
      this.logger.log('Stripe provider initialized from admin integrations DB');
    } catch (err: any) {
      // Clear so callers can fall back to env instead of keeping a stale/invalid client.
      this.stripe = null;
      this.webhookSecret = null;
      const message = String(err?.message || 'unknown error');
      // Admin deactivated Stripe — do not resurrect via STRIPE_SECRET_KEY
      if (message.toLowerCase().includes('not active')) {
        this.allowEnvFallback = false;
        this.logger.warn('Stripe integration is inactive — env fallback disabled');
        return;
      }
      this.logger.warn(`Stripe integration not loaded from admin: ${message}`);
    }
  }

  isAvailable(): boolean {
    return this.stripe !== null;
  }

  /**
   * Public entry for payment-provider / admin reload paths.
   * Loads integrations first, then falls back to env vars (unless disabled).
   */
  async ensureReady(options?: {
    forceReload?: boolean;
    allowEnvFallback?: boolean;
  }): Promise<boolean> {
    if (options?.allowEnvFallback !== undefined) {
      this.allowEnvFallback = options.allowEnvFallback;
    }
    if (options?.forceReload) {
      await this.reloadStripeClient();
    } else {
      await this.ensureStripeClient();
    }
    return this.isAvailable();
  }

  /** Drop the in-memory client (e.g. Stripe integration deactivated). */
  clearClient(options?: { disableEnvFallback?: boolean }): void {
    this.stripe = null;
    this.webhookSecret = null;
    this.circuitBreaker.reset();
    if (options?.disableEnvFallback) {
      this.allowEnvFallback = false;
    }
  }

  private async ensureStripeClient(): Promise<void> {
    if (this.stripe) return;
    await this.initFromIntegrations();
    if (!this.stripe && this.allowEnvFallback) this.initFromEnv();
  }

  /** Discard current client and rebuild from integrations, then env (if allowed). */
  private async reloadStripeClient(): Promise<void> {
    this.stripe = null;
    this.webhookSecret = null;
    await this.initFromIntegrations();
    if (!this.stripe && this.allowEnvFallback) this.initFromEnv();
  }

  private isStripeAuthError(error: any): boolean {
    const message = String(error?.message || '');
    return (
      error?.type === 'StripeAuthenticationError' ||
      message.includes('Invalid API Key') ||
      error?.statusCode === 401
    );
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    await this.ensureStripeClient();
    if (!this.stripe) {
      throw new Error('Stripe provider is not available');
    }

    return this.circuitBreaker.execute(async () => {
      const amountMinor = toMinorUnits(params.amount, params.currency);
      const createOnce = async (idempotencyKey: string) => {
        const paymentIntent = await this.stripe!.paymentIntents.create(
          {
            amount: amountMinor,
            currency: params.currency.toLowerCase(),
            metadata: {
              orderId: params.orderId,
              ...params.metadata,
            },
            automatic_payment_methods: {
              enabled: true,
            },
          },
          { idempotencyKey },
        );

        return {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret || undefined,
          requiresAction: paymentIntent.status === 'requires_action',
          metadata: {
            ...paymentIntent.metadata,
          },
        };
      };

      try {
        return await createOnce(`order-${params.orderId}-${amountMinor}`);
      } catch (error: any) {
        if (this.isStripeAuthError(error)) {
          // Admin may have rotated keys after boot; IntegrationsController used to miss re-init.
          this.logger.warn('Stripe auth failed — reloading credentials and retrying once');
          await this.reloadStripeClient();
          if (this.stripe) {
            return await createOnce(`order-${params.orderId}-${amountMinor}-reload`);
          }
        }

        this.logger.error('Failed to create Stripe payment intent:', error);
        throw error;
      }
    });
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<PaymentResult> {
    if (!this.stripe) {
      throw new Error('Stripe provider is not available');
    }

    return this.circuitBreaker.execute(async () => {
      try {
        // Expanding the charge gives us the masked card details the order
        // confirmation page shows ("Visa •••• 4242").
        const paymentIntent = await this.stripe!.paymentIntents.retrieve(params.paymentIntentId, {
          expand: ['latest_charge.payment_method_details'],
        });

        if (paymentIntent.status === 'succeeded') {
          const charge = paymentIntent.latest_charge as any;
          const cardDetails = charge?.payment_method_details?.card;
          return {
            success: true,
            paymentId: paymentIntent.id,
            transactionId: typeof charge === 'string' ? charge : charge?.id,
            amount: fromMinorUnits(paymentIntent.amount, paymentIntent.currency),
            currency: paymentIntent.currency,
            status: PaymentStatus.SUCCEEDED,
            metadata: paymentIntent.metadata,
            card: cardDetails
              ? { brand: cardDetails.brand, last4: cardDetails.last4 }
              : undefined,
          };
        }

        return {
          success: false,
          paymentId: paymentIntent.id,
          amount: fromMinorUnits(paymentIntent.amount, paymentIntent.currency),
          currency: paymentIntent.currency,
          status: this.mapStripeStatus(paymentIntent.status),
          metadata: paymentIntent.metadata,
          error: paymentIntent.last_payment_error?.message,
        };
      } catch (error: any) {
        this.logger.error('Failed to confirm Stripe payment:', error);
        throw error;
      }
    });
  }

  async cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<'cancelled' | 'already_succeeded' | 'skipped'> {
    if (!this.stripe) return 'skipped';
    try {
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status === 'succeeded') {
        return 'already_succeeded';
      }
      if (['canceled', 'requires_payment_method'].includes(intent.status)) {
        return 'cancelled';
      }
      await this.stripe.paymentIntents.cancel(paymentIntentId);
      return 'cancelled';
    } catch (err: any) {
      if (err?.code === 'payment_intent_unexpected_state') return 'cancelled';
      if (err?.code === 'resource_missing') return 'skipped';
      throw err;
    }
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundResult> {
    await this.ensureStripeClient();
    if (!this.stripe) {
      return {
        success: false,
        refundId: '',
        amount: 0,
        status: 'failed',
        error: 'Stripe provider is not available',
      };
    }

    const idempotencyKey = `refund-${params.paymentId}-${params.amount || 'full'}-${params.metadata?.returnId || params.metadata?.reason || 'cancel'}-${params.metadata?.retryAttempt || '0'}`;
    let amountMinor: number | undefined;
    if (params.amount) {
      let currency =
        params.currency ||
        (typeof params.metadata?.currency === 'string' ? params.metadata.currency : undefined);
      if (!currency) {
        currency = (await this.stripe.paymentIntents.retrieve(params.paymentId)).currency;
      }
      amountMinor = toMinorUnits(params.amount, currency);
    }
    const createRefund = async () =>
      this.stripe!.refunds.create(
        {
          payment_intent: params.paymentId,
          amount: amountMinor,
          reason: params.reason as any,
          metadata: params.metadata,
        },
        { idempotencyKey },
      );

    try {
      let refund;
      try {
        refund = await createRefund();
      } catch (error: any) {
        if (this.isStripeAuthError(error)) {
          this.logger.warn(
            'Stripe auth failed on refund — reloading credentials and retrying once',
          );
          await this.reloadStripeClient();
          if (!this.stripe) throw error;
          refund = await this.stripe.refunds.create(
            {
              payment_intent: params.paymentId,
              amount: amountMinor,
              reason: params.reason as any,
              metadata: params.metadata,
            },
            { idempotencyKey: `${idempotencyKey}-reload` },
          );
        } else {
          throw error;
        }
      }

      // Only succeeded is success — pending must not complete ledger/totals early.
      return {
        success: refund.status === 'succeeded',
        refundId: refund.id,
        amount: fromMinorUnits(refund.amount, refund.currency),
        status:
          refund.status === 'succeeded'
            ? 'succeeded'
            : refund.status === 'pending'
              ? 'pending'
              : 'failed',
        metadata: refund.metadata,
        error:
          refund.status === 'pending'
            ? 'Stripe refund is pending confirmation'
            : refund.status === 'succeeded'
              ? undefined
              : `Stripe refund status: ${refund.status}`,
      };
    } catch (error: any) {
      this.logger.error('Failed to refund Stripe payment:', error);
      return {
        success: false,
        refundId: '',
        amount: 0,
        status: 'failed',
        error: error.message,
      };
    }
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    if (!this.stripe) {
      throw new Error('Stripe provider is not available');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
      return this.mapStripeStatus(paymentIntent.status);
    } catch (error: any) {
      this.logger.error('Failed to get Stripe payment status:', error);
      throw error;
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    if (!this.stripe) {
      return false;
    }

    const secret = this.webhookSecret || this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new Error('Stripe webhook secret not configured');
    }

    try {
      this.stripe.webhooks.constructEvent(payload, signature, secret);
      return true;
    } catch (error) {
      this.logger.error('Webhook signature validation failed:', error);
      return false;
    }
  }

  async processWebhook(event: any): Promise<WebhookResult> {
    if (!this.stripe) {
      return { processed: false, eventType: event.type };
    }

    try {
      const eventType = event.type;
      const dataObject = event.data.object;

      // For charge events, the PI id is in payment_intent; for PI events, it's .id
      const isCharge = eventType.startsWith('charge.');
      const paymentId = isCharge ? dataObject.payment_intent || dataObject.id : dataObject.id;
      const metadata = isCharge ? dataObject.metadata || {} : dataObject.metadata || {};

      return {
        processed: true,
        eventType,
        paymentId,
        orderId: metadata?.orderId,
        metadata,
      };
    } catch (error: any) {
      this.logger.error('Failed to process Stripe webhook:', error);
      return { processed: false, eventType: event.type };
    }
  }

  // === Stripe Connect Methods ===

  getStripeInstance(): Stripe | null {
    return this.stripe;
  }

  async createConnectedAccount(params: {
    email: string;
    businessName: string;
    country?: string;
    metadata?: Record<string, string>;
  }): Promise<{ accountId: string; onboardingUrl?: string }> {
    if (!this.stripe) throw new Error('Stripe provider is not available');

    const account = await this.stripe.accounts.create({
      type: 'express',
      email: params.email,
      country: params.country || 'US',
      business_type: 'individual',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      business_profile: {
        name: params.businessName,
      },
      metadata: params.metadata || {},
    });

    return { accountId: account.id };
  }

  async createAccountOnboardingLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<string> {
    if (!this.stripe) throw new Error('Stripe provider is not available');

    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      return_url: returnUrl,
      refresh_url: refreshUrl,
      type: 'account_onboarding',
    });

    return accountLink.url;
  }

  async getConnectedAccountStatus(accountId: string): Promise<{
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    if (!this.stripe) throw new Error('Stripe provider is not available');

    const account = await this.stripe.accounts.retrieve(accountId);
    return {
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  }

  async createPaymentIntentWithSplit(params: {
    amount: number;
    currency: string;
    orderId: string;
    connectedAccountId: string;
    applicationFeeAmount: number;
    metadata?: Record<string, string>;
  }): Promise<PaymentIntentResult> {
    await this.ensureStripeClient();
    if (!this.stripe) throw new Error('Stripe provider is not available');

    const amountMinor = toMinorUnits(params.amount, params.currency);
    const feeMinor = toMinorUnits(params.applicationFeeAmount, params.currency);
    const createOnce = async (idempotencyKey: string) => {
      const paymentIntent = await this.stripe!.paymentIntents.create(
        {
          amount: amountMinor,
          currency: params.currency.toLowerCase(),
          application_fee_amount: feeMinor,
          transfer_data: {
            destination: params.connectedAccountId,
          },
          metadata: {
            orderId: params.orderId,
            ...params.metadata,
          },
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey },
      );

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret || undefined,
        requiresAction: paymentIntent.status === 'requires_action',
        metadata: { ...paymentIntent.metadata },
      };
    };

    try {
      return await createOnce(`order-split-${params.orderId}-${amountMinor}-${feeMinor}`);
    } catch (error: any) {
      if (this.isStripeAuthError(error)) {
        this.logger.warn(
          'Stripe auth failed on split intent — reloading credentials and retrying once',
        );
        await this.reloadStripeClient();
        if (this.stripe) {
          return await createOnce(
            `order-split-${params.orderId}-${amountMinor}-${feeMinor}-reload`,
          );
        }
      }
      this.logger.error('Failed to create Stripe split payment intent:', error);
      throw error;
    }
  }

  async createTransfer(params: {
    amount: number;
    currency: string;
    connectedAccountId: string;
    sourceTransaction?: string;
    description?: string;
    metadata?: Record<string, string>;
  }): Promise<{ transferId: string }> {
    if (!this.stripe) throw new Error('Stripe provider is not available');

    const transfer = await this.stripe.transfers.create({
      amount: toMinorUnits(params.amount, params.currency),
      currency: params.currency.toLowerCase(),
      destination: params.connectedAccountId,
      source_transaction: params.sourceTransaction,
      description: params.description,
      metadata: params.metadata || {},
    });

    return { transferId: transfer.id };
  }

  async createLoginLink(accountId: string): Promise<string> {
    if (!this.stripe) throw new Error('Stripe provider is not available');
    const loginLink = await this.stripe.accounts.createLoginLink(accountId);
    return loginLink.url;
  }

  private mapStripeStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      requires_payment_method: PaymentStatus.PENDING,
      requires_confirmation: PaymentStatus.PENDING,
      requires_action: PaymentStatus.PROCESSING,
      processing: PaymentStatus.PROCESSING,
      requires_capture: PaymentStatus.PROCESSING,
      canceled: PaymentStatus.CANCELLED,
      succeeded: PaymentStatus.SUCCEEDED,
    };

    return statusMap[status] || PaymentStatus.PENDING;
  }
}
