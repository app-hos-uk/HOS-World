/**
 * Payment Provider Interface
 * All payment providers must implement this interface
 */
export interface PaymentProvider {
  /**
   * Provider identifier (e.g., 'stripe', 'klarna', 'paypal')
   */
  readonly name: string;

  /**
   * Check if provider is available/configured
   */
  isAvailable(): boolean;

  /**
   * Create a payment intent/authorization
   */
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;

  /**
   * Confirm/complete a payment
   */
  confirmPayment(params: ConfirmPaymentParams): Promise<PaymentResult>;

  /**
   * Refund a payment
   */
  refundPayment(params: RefundPaymentParams): Promise<RefundResult>;

  /**
   * Get payment status
   */
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;

  /**
   * Validate webhook signature
   */
  validateWebhook(payload: any, signature: string): boolean;

  /**
   * Process webhook event
   */
  processWebhook(event: any): Promise<WebhookResult>;
}

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  orderId: string;
  customerId?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  clientSecret?: string;
  redirectUrl?: string;
  requiresAction?: boolean;
  metadata?: Record<string, any>;
}

export interface ConfirmPaymentParams {
  paymentIntentId: string;
  orderId: string;
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  paymentId: string;
  transactionId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  metadata?: Record<string, any>;
  error?: string;
}

export interface RefundPaymentParams {
  paymentId: string;
  amount?: number; // If not provided, full refund
  reason?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
  metadata?: Record<string, any>;
  error?: string;
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export interface WebhookResult {
  processed: boolean;
  eventType: string;
  paymentId?: string;
  orderId?: string;
  metadata?: Record<string, any>;
}
