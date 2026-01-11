import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
export class KlarnaProvider implements PaymentProvider {
  readonly name = 'klarna';
  private readonly logger = new Logger(KlarnaProvider.name);
  private readonly BASE_CURRENCY = 'GBP';
  private klarnaApiUrl: string;
  private klarnaUsername: string | null = null;
  private klarnaPassword: string | null = null;

  constructor(private configService: ConfigService) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.klarnaApiUrl = isProduction
      ? 'https://api.klarna.com'
      : 'https://api.playground.klarna.com';

    this.klarnaUsername = this.configService.get<string>('KLARNA_USERNAME') || null;
    this.klarnaPassword = this.configService.get<string>('KLARNA_PASSWORD') || null;

    if (this.klarnaUsername && this.klarnaPassword) {
      this.logger.log('Klarna provider initialized');
    } else {
      this.logger.warn('KLARNA_USERNAME/PASSWORD not set - Klarna provider disabled');
    }
  }

  isAvailable(): boolean {
    return !!(this.klarnaUsername && this.klarnaPassword);
  }

  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<PaymentIntentResult> {
    if (!this.isAvailable()) {
      throw new Error('Klarna provider is not available');
    }

    // Klarna uses a different flow - returns authorization token
    // This would typically be called from the frontend
    // For now, return a placeholder
    return {
      paymentIntentId: `klarna_${params.orderId}`,
      redirectUrl: `${this.klarnaApiUrl}/payments/v1/authorizations`,
      requiresAction: true,
      metadata: {
        orderId: params.orderId,
        ...params.metadata,
      },
    };
  }

  async confirmPayment(
    params: ConfirmPaymentParams,
  ): Promise<PaymentResult> {
    if (!this.isAvailable()) {
      throw new Error('Klarna provider is not available');
    }

    // This would call Klarna's confirmation API
    // Implementation would depend on Klarna's specific API
    // For now, return a placeholder
    return {
      success: true,
      paymentId: params.paymentIntentId,
      amount: 0,
      currency: this.BASE_CURRENCY,
      status: PaymentStatus.SUCCEEDED,
      metadata: params.metadata,
    };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundResult> {
    if (!this.isAvailable()) {
      throw new Error('Klarna provider is not available');
    }

    // Klarna refund implementation
    return {
      success: false,
      refundId: '',
      amount: params.amount || 0,
      status: 'pending',
      error: 'Klarna refund not yet implemented',
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    if (!this.isAvailable()) {
      throw new Error('Klarna provider is not available');
    }

    // Query Klarna API for payment status
    return PaymentStatus.PENDING;
  }

  validateWebhook(payload: any, signature: string): boolean {
    // Klarna webhook validation
    return true; // Placeholder
  }

  async processWebhook(event: any): Promise<WebhookResult> {
    return {
      processed: true,
      eventType: event.type || 'unknown',
    };
  }
}
