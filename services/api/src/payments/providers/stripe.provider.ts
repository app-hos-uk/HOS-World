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
import { IntegrationsService } from '../../integrations/integrations.service';

@Injectable()
export class StripeProvider implements PaymentProvider, OnModuleInit {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private stripe: Stripe | null = null;
  private webhookSecret: string | null = null;
  private readonly circuitBreaker = new CircuitBreaker({
    name: 'stripe',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 1,
  });

  constructor(
    private configService: ConfigService,
    private integrationsService: IntegrationsService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || null;
      this.logger.log('Stripe provider initialized from env vars');
    }
  }

  async onModuleInit() {
    if (this.stripe) return;
    void this.initFromIntegrations();
  }

  /**
   * Re-initialize from integrations DB. Called on startup and when
   * Stripe integration is activated/updated at runtime.
   */
  async initFromIntegrations(): Promise<void> {
    try {
      const creds = await this.integrationsService.getDecryptedCredentials('PAYMENT', 'stripe');
      const secretKey = creds.secretKey?.trim();
      if (secretKey) {
        this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
        this.webhookSecret = creds.webhookSecret?.trim() || null;
        this.logger.log('Stripe provider initialized from admin integrations DB');
      }
    } catch {
      this.logger.log('Stripe integration not configured in admin — provider disabled');
    }
  }

  isAvailable(): boolean {
    return this.stripe !== null;
  }

  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    if (!this.stripe) {
      throw new Error('Stripe provider is not available');
    }

    return this.circuitBreaker.execute(async () => {
      try {
        const amountCents = Math.round(params.amount * 100);
        const paymentIntent = await this.stripe!.paymentIntents.create(
        {
          amount: amountCents,
          currency: params.currency.toLowerCase(),
          metadata: {
            orderId: params.orderId,
            ...params.metadata,
          },
          automatic_payment_methods: {
            enabled: true,
          },
        },
        {
          // Include amount so a new intent is created when the payable total changes
          // (e.g. after gift card partial redemption). Same key still dedupes true retries.
          idempotencyKey: `order-${params.orderId}-${amountCents}`,
        },
      );

        return {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret || undefined,
          requiresAction: paymentIntent.status === 'requires_action',
          metadata: {
            ...paymentIntent.metadata,
          },
        };
      } catch (error: any) {
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
        const paymentIntent = await this.stripe!.paymentIntents.retrieve(params.paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
          return {
            success: true,
            paymentId: paymentIntent.id,
            transactionId: paymentIntent.latest_charge as string,
            amount: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            status: PaymentStatus.SUCCEEDED,
            metadata: paymentIntent.metadata,
          };
        }

        return {
          success: false,
          paymentId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
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

  async cancelPaymentIntent(paymentIntentId: string): Promise<'cancelled' | 'already_succeeded' | 'skipped'> {
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
    if (!this.stripe) {
      throw new Error('Stripe provider is not available');
    }

    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: params.paymentId,
          amount: params.amount ? Math.round(params.amount * 100) : undefined,
          reason: params.reason as any,
          metadata: params.metadata,
        },
        {
          idempotencyKey: `refund-${params.paymentId}`,
        },
      );

      return {
        success: refund.status === 'succeeded',
        refundId: refund.id,
        amount: refund.amount / 100,
        status:
          refund.status === 'succeeded'
            ? 'succeeded'
            : refund.status === 'pending'
              ? 'pending'
              : 'failed',
        metadata: refund.metadata,
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
      const paymentIntent = event.data.object;

      return {
        processed: true,
        eventType,
        paymentId: paymentIntent.id,
        orderId: paymentIntent.metadata?.orderId,
        metadata: paymentIntent.metadata,
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
    if (!this.stripe) throw new Error('Stripe provider is not available');

    const amountCents = Math.round(params.amount * 100);
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: params.currency.toLowerCase(),
        application_fee_amount: Math.round(params.applicationFeeAmount * 100),
        transfer_data: {
          destination: params.connectedAccountId,
        },
        metadata: {
          orderId: params.orderId,
          ...params.metadata,
        },
        automatic_payment_methods: { enabled: true },
      },
      {
        idempotencyKey: `order-split-${params.orderId}-${amountCents}-${Math.round(params.applicationFeeAmount * 100)}`,
      },
    );

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret || undefined,
      requiresAction: paymentIntent.status === 'requires_action',
      metadata: { ...paymentIntent.metadata },
    };
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
      amount: Math.round(params.amount * 100),
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
