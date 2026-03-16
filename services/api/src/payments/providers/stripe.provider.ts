import { Injectable, Logger } from '@nestjs/common';
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

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private stripe: Stripe | null = null;
  private readonly circuitBreaker = new CircuitBreaker({
    name: 'stripe',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    halfOpenMaxAttempts: 1,
  });

  constructor(private configService: ConfigService) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
      this.logger.log('Stripe provider initialized');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set - Stripe provider disabled');
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
        const paymentIntent = await this.stripe!.paymentIntents.create(
        {
          amount: Math.round(params.amount * 100),
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
          idempotencyKey: `order-${params.orderId}`,
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

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    try {
      this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
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

    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: Math.round(params.amount * 100),
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
      { idempotencyKey: `order-split-${params.orderId}` },
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
