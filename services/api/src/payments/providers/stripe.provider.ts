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

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripeProvider.name);
  private stripe: Stripe | null = null;

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

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(params.amount * 100), // Convert to cents
        currency: params.currency.toLowerCase(),
        metadata: {
          orderId: params.orderId,
          ...params.metadata,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

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
  }

  async confirmPayment(params: ConfirmPaymentParams): Promise<PaymentResult> {
    if (!this.stripe) {
      throw new Error('Stripe provider is not available');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(params.paymentIntentId);

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
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundResult> {
    if (!this.stripe) {
      throw new Error('Stripe provider is not available');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: params.paymentId,
        amount: params.amount ? Math.round(params.amount * 100) : undefined,
        reason: params.reason as any,
        metadata: params.metadata,
      });

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
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set - webhook validation disabled');
      return false;
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
