export interface ProcessRefundInput {
  returnId: string;
  amount: number;
  currency?: string;
  description?: string;
  /** When true, re-attempts after a prior FAILED refund (not the initial approval attempt). */
  isRetry?: boolean;
}

export interface RefundProcessResult {
  transaction: {
    id: string;
    status: string;
    amount: unknown;
    metadata?: unknown;
    [key: string]: unknown;
  };
  stripeRefundSucceeded: boolean;
  cardRefundAmount: number;
  giftCardRefundAmount: number;
  error?: string;
}
