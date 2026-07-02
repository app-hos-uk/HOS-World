import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';
import { PaymentProviderService } from '../payments/payment-provider.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';
import { DEFAULT_PLATFORM_FEE_RATE } from '../common/platform-config';
import { ProcessRefundInput, RefundProcessResult } from './refund.types';
import { RETURN_REFUND_ORDER_INCLUDE } from './refund-order.include';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private paymentProviderService: PaymentProviderService,
    @Optional() private vendorLedgerService?: VendorLedgerService,
  ) {}

  async processRefund(data: ProcessRefundInput): Promise<RefundProcessResult> {
    if (data.amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: data.returnId },
      include: {
        order: {
          include: RETURN_REFUND_ORDER_INCLUDE,
        },
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    const allowedStatuses = data.isRetry
      ? ['APPROVED', 'PROCESSING']
      : ['PENDING', 'APPROVED'];
    if (!allowedStatuses.includes(returnRequest.status)) {
      throw new BadRequestException(
        data.isRetry
          ? 'Return must be approved or processing before retrying a refund'
          : 'Return request must be pending approval or approved before processing refund',
      );
    }

    if (data.amount > Number(returnRequest.order.total)) {
      throw new BadRequestException('Refund amount cannot exceed order total');
    }

    const existingOrderRefunds = await this.transactionsService.getTransactions({
      orderId: returnRequest.orderId,
      type: 'REFUND',
      status: 'COMPLETED',
    });
    const totalRefundedSoFar = (existingOrderRefunds?.transactions || []).reduce(
      (sum: number, tx: any) => sum + Number(tx.amount || 0),
      0,
    );
    if (totalRefundedSoFar + data.amount > Number(returnRequest.order.total)) {
      throw new BadRequestException(
        `Refund would exceed order total. Already refunded: ${totalRefundedSoFar.toFixed(2)}, requested: ${data.amount.toFixed(2)}, order total: ${Number(returnRequest.order.total).toFixed(2)}`,
      );
    }

    const existingCompleted = await this.transactionsService.getTransactions({
      returnId: data.returnId,
      type: 'REFUND',
      status: 'COMPLETED',
    });
    if (existingCompleted?.transactions?.length > 0) {
      throw new BadRequestException('A refund has already been processed for this return');
    }

    const priorAttempts = await this.transactionsService.getTransactions({
      returnId: data.returnId,
      type: 'REFUND',
    });
    const priorTxs = priorAttempts?.transactions || [];
    const hasPending = priorTxs.some((t: any) => t.status === 'PENDING');
    const hasFailed = priorTxs.some((t: any) => t.status === 'FAILED');

    if (data.isRetry) {
      if (hasPending) {
        throw new BadRequestException(
          'A refund attempt is already in progress for this return',
        );
      }
      if (!hasFailed) {
        throw new BadRequestException('No failed refund exists to retry');
      }
    } else if (hasPending) {
      throw new BadRequestException('A refund is already being processed for this return');
    } else if (hasFailed) {
      throw new BadRequestException(
        'A prior refund attempt failed. Use retry-refund to re-attempt.',
      );
    }

    const retryAttempt = priorTxs.length;

    const sellerId =
      returnRequest.order.sellerId ||
      returnRequest.order.childOrders?.[0]?.sellerId ||
      undefined;

    const transaction = await this.transactionsService.createTransaction({
      type: 'REFUND',
      amount: data.amount,
      currency: data.currency || returnRequest.order.currency,
      customerId: returnRequest.userId,
      sellerId,
      orderId: returnRequest.orderId,
      returnId: data.returnId,
      description: data.description || `Refund for return request ${data.returnId}`,
      status: 'PENDING',
      metadata: {
        returnRequestId: data.returnId,
        retryAttempt,
        source: 'return_refund',
      },
    });

    const giftCardRedemptions = await this.prisma.giftCardTransaction.findMany({
      where: { orderId: returnRequest.orderId, type: 'REDEMPTION' },
      select: { amount: true, giftCardId: true },
    });
    const giftCardTotal = giftCardRedemptions.reduce(
      (sum: number, tx: any) => sum + Number(tx.amount),
      0,
    );
    const orderTotal = Number(returnRequest.order.total);
    const cardProportion =
      orderTotal > 0 ? Math.max(0, orderTotal - giftCardTotal) / orderTotal : 1;
    const cardRefundAmount = Math.round(data.amount * cardProportion * 100) / 100;
    const giftCardRefundAmount = Math.round((data.amount - cardRefundAmount) * 100) / 100;

    if (giftCardRefundAmount > 0 && giftCardRedemptions.length > 0) {
      const existingReversals = await this.prisma.giftCardTransaction.count({
        where: {
          orderId: returnRequest.orderId,
          type: 'REFUND',
          notes: { contains: data.returnId },
        },
      });
      if (existingReversals === 0) {
        await this.prisma.$transaction(async (tx) => {
          let remaining = giftCardRefundAmount;
          for (const redemption of giftCardRedemptions) {
            if (remaining <= 0) break;
            const reverseAmount = Math.min(remaining, Number(redemption.amount));
            const card = await tx.giftCard.findUnique({ where: { id: redemption.giftCardId } });
            const newBalance = Number(card?.balance || 0) + reverseAmount;
            await tx.giftCard.update({
              where: { id: redemption.giftCardId },
              data: { balance: { increment: reverseAmount } },
            });
            await tx.giftCardTransaction.create({
              data: {
                giftCardId: redemption.giftCardId,
                orderId: returnRequest.orderId,
                type: 'REFUND',
                amount: reverseAmount,
                balanceAfter: newBalance,
                notes: `Return refund reversal (returnId: ${data.returnId})`,
              },
            });
            remaining -= reverseAmount;
          }
        });
        this.logger.log(`Reversed ${giftCardRefundAmount} to gift cards for return ${data.returnId}`);
      }
    }

    let stripeRefundSucceeded = false;
    let stripeError: string | undefined;
    let stripeRefundId: string | undefined;

    const stripePaymentId = returnRequest.order.stripePaymentIntentId;
    if (stripePaymentId && cardRefundAmount > 0 && this.paymentProviderService.isProviderAvailable('stripe')) {
      const provider = this.paymentProviderService.getProvider('stripe');
      const result = await provider.refundPayment({
        paymentId: stripePaymentId,
        amount: cardRefundAmount,
        metadata: {
          currency: data.currency || returnRequest.order.currency,
          returnId: data.returnId,
          retryAttempt: String(retryAttempt),
        },
      });

      if (result?.success) {
        stripeRefundSucceeded = true;
        stripeRefundId = result.refundId;
        await this.transactionsService.updateTransactionStatus(transaction.id, 'COMPLETED', {
          reason: 'Stripe refund succeeded',
        });
        await this.prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            metadata: {
              returnRequestId: data.returnId,
              retryAttempt,
              source: 'return_refund',
              stripeRefundId,
              cardRefundAmount,
              giftCardRefundAmount,
            },
          },
        });
        await this.updatePaymentRefundTotal(returnRequest.orderId, data.amount);
        this.logger.log(`Refund processed via Stripe for return ${data.returnId}`);
      } else {
        stripeError = result?.error || 'Payment provider refund was not successful';
        await this.transactionsService.updateTransactionStatus(transaction.id, 'FAILED', {
          reason: stripeError,
        });
      }
    } else if (stripePaymentId && cardRefundAmount > 0) {
      stripeError =
        'Payment provider is temporarily unavailable. Refund could not be processed. Please retry later.';
      await this.transactionsService.updateTransactionStatus(transaction.id, 'FAILED', {
        reason: stripeError,
      });
    } else if (cardRefundAmount <= 0 || !stripePaymentId) {
      stripeRefundSucceeded = true;
      await this.transactionsService.updateTransactionStatus(transaction.id, 'COMPLETED', {
        reason: 'Gift-card-only or no card charge — refund completed without Stripe',
      });
      await this.updatePaymentRefundTotal(returnRequest.orderId, data.amount);
      this.logger.log(
        `Refund for return ${data.returnId} completed (no Stripe refund needed)`,
      );
    } else {
      stripeError = 'No payment provider configured for refund';
      await this.transactionsService.updateTransactionStatus(transaction.id, 'PENDING', {
        reason: stripeError,
      });
    }

    if (stripeRefundSucceeded) {
      await this.prisma.returnRequest.update({
        where: { id: data.returnId },
        data: {
          refundAmount: data.amount,
          refundMethod: 'ORIGINAL_PAYMENT',
        },
      });
      await this.recordVendorLedgerRefunds(returnRequest.order as any, data.amount);
    }

    const refreshed = await this.transactionsService.getTransactionById(transaction.id);

    return {
      transaction: refreshed,
      stripeRefundSucceeded,
      cardRefundAmount,
      giftCardRefundAmount,
      error: stripeError,
    };
  }

  async retryReturnRefund(returnId: string): Promise<RefundProcessResult> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnId },
      include: {
        order: {
          include: RETURN_REFUND_ORDER_INCLUDE,
        },
      },
    });
    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }
    if (!['APPROVED', 'PROCESSING'].includes(returnRequest.status)) {
      throw new BadRequestException(
        'Only approved returns with a failed refund can be retried',
      );
    }

    const priorAttempts = await this.transactionsService.getTransactions({
      returnId,
      type: 'REFUND',
    });
    const priorTxs = priorAttempts?.transactions || [];

    if (priorTxs.some((t: any) => t.status === 'COMPLETED')) {
      throw new BadRequestException('Refund already completed for this return');
    }
    if (priorTxs.some((t: any) => t.status === 'PENDING')) {
      throw new BadRequestException('A refund attempt is already in progress for this return');
    }
    if (!priorTxs.some((t: any) => t.status === 'FAILED')) {
      throw new BadRequestException('No failed refund exists to retry');
    }

    const amount =
      returnRequest.refundAmount != null
        ? Number(returnRequest.refundAmount)
        : Number(returnRequest.order.total);

    return this.processRefund({
      returnId,
      amount,
      currency: returnRequest.order.currency,
      description: `Retry refund for return request ${returnId}`,
      isRetry: true,
    });
  }

  private async updatePaymentRefundTotal(orderId: string, amount: number) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PAID' },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) return;
    const nextRefund = Number(payment.refundAmount || 0) + amount;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { refundAmount: nextRefund },
    });
  }

  /** Debit vendor ledger using subtotal-proportional amounts (matches recordSale basis). */
  private async recordVendorLedgerRefunds(
    order: {
      id: string;
      sellerId: string | null;
      subtotal: unknown;
      total: unknown;
      childOrders?: Array<{
        id: string;
        sellerId: string | null;
        subtotal: unknown;
        seller?: { commissionRate?: unknown } | null;
      }>;
    },
    customerRefundAmount: number,
  ) {
    if (!this.vendorLedgerService) return;

    const orderSubtotal = Number(order.subtotal || 0);
    const orderTotal = Number(order.total || 0);
    const ledgerBase =
      orderTotal > 0 && orderSubtotal > 0
        ? Math.round((customerRefundAmount * orderSubtotal) / orderTotal * 100) / 100
        : customerRefundAmount;

    const childOrders = order.childOrders || [];
    if (childOrders.length > 0) {
      const childSubtotalSum = childOrders.reduce(
        (sum, c) => sum + Number(c.subtotal || 0),
        0,
      );
      for (const child of childOrders) {
        if (!child.sellerId) continue;
        const share =
          childSubtotalSum > 0
            ? Math.round((ledgerBase * Number(child.subtotal || 0)) / childSubtotalSum * 100) / 100
            : ledgerBase / childOrders.length;
        const commissionRate = child.seller?.commissionRate
          ? Number(child.seller.commissionRate)
          : DEFAULT_PLATFORM_FEE_RATE;
        try {
          await this.vendorLedgerService.recordRefund({
            sellerId: child.sellerId,
            orderId: child.id,
            refundAmount: share,
            commissionRate,
          });
        } catch (err) {
          this.logger.error(`Failed vendor ledger refund for child order ${child.id}: ${err}`);
        }
      }
      return;
    }

    if (!order.sellerId) return;
    const seller = await this.prisma.seller.findUnique({ where: { id: order.sellerId } });
    const commissionRate = seller?.commissionRate
      ? Number(seller.commissionRate)
      : DEFAULT_PLATFORM_FEE_RATE;
    try {
      await this.vendorLedgerService.recordRefund({
        sellerId: order.sellerId,
        orderId: order.id,
        refundAmount: ledgerBase,
        commissionRate,
      });
    } catch (err) {
      this.logger.error(`Failed to record vendor ledger refund: ${err}`);
    }
  }

  async recordOrderCancellationRefund(data: {
    orderId: string;
    customerId: string;
    amount: number;
    cardRefundAmount?: number;
    currency?: string;
    cancellationRequestId?: string;
    stripeRefundSucceeded: boolean;
    stripeRefundId?: string;
    sellerId?: string;
  }) {
    const recordedAmount = data.cardRefundAmount ?? data.amount;
    if (recordedAmount <= 0) {
      return null;
    }

    const existing = await this.transactionsService.getTransactions({
      orderId: data.orderId,
      type: 'REFUND',
    });
    const duplicate = (existing?.transactions || []).some(
      (tx: any) =>
        tx.metadata?.cancellationRequestId === data.cancellationRequestId ||
        (tx.metadata?.source === 'order_cancellation' && !data.cancellationRequestId),
    );
    if (duplicate) {
      this.logger.log(`Cancellation refund transaction already recorded for order ${data.orderId}`);
      return null;
    }

    return this.transactionsService.createTransaction({
      type: 'REFUND',
      amount: recordedAmount,
      currency: data.currency || 'USD',
      customerId: data.customerId,
      sellerId: data.sellerId,
      orderId: data.orderId,
      description: data.cancellationRequestId
        ? `Refund for approved cancellation ${data.cancellationRequestId}`
        : `Refund for order cancellation ${data.orderId}`,
      status: data.stripeRefundSucceeded ? 'COMPLETED' : 'FAILED',
      metadata: {
        source: 'order_cancellation',
        cancellationRequestId: data.cancellationRequestId,
        orderTotal: data.amount,
        stripeRefundId: data.stripeRefundId,
      },
    });
  }

  async getRefunds(filters?: {
    customerId?: string;
    orderId?: string;
    returnId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    return this.transactionsService.getTransactions({
      ...filters,
      type: 'REFUND',
    });
  }

  async updateRefundStatus(
    transactionId: string,
    status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED',
    options?: { changedById?: string; reason?: string },
  ) {
    return this.transactionsService.updateTransactionStatus(transactionId, status, options);
  }

  async syncReturnRefundFromWebhook(params: {
    stripeRefundId: string;
    paymentIntentId: string;
    amount: number;
    status: 'succeeded' | 'failed' | 'pending';
  }) {
    const order = await this.prisma.order.findFirst({
      where: { stripePaymentIntentId: params.paymentIntentId },
    });
    if (!order) {
      this.logger.warn(`No order for refund webhook PI ${params.paymentIntentId}`);
      return;
    }

    const txStatus =
      params.status === 'succeeded'
        ? 'COMPLETED'
        : params.status === 'failed'
          ? 'FAILED'
          : 'PENDING';

    const existing = await this.prisma.transaction.findMany({
      where: { orderId: order.id, type: 'REFUND' },
    });
    const matched = existing.find(
      (t) => (t.metadata as any)?.stripeRefundId === params.stripeRefundId,
    );

    if (matched) {
      if (matched.status !== txStatus) {
        await this.transactionsService.updateTransactionStatus(matched.id, txStatus as any, {
          reason: `Stripe refund webhook (${params.status})`,
        });
      }
      return;
    }

    await this.transactionsService.createTransaction({
      type: 'REFUND',
      amount: params.amount,
      currency: order.currency,
      customerId: order.userId,
      sellerId: order.sellerId || undefined,
      orderId: order.id,
      status: txStatus as any,
      description: `Stripe refund ${params.stripeRefundId}`,
      metadata: {
        source: 'stripe_webhook',
        stripeRefundId: params.stripeRefundId,
        paymentIntentId: params.paymentIntentId,
      },
    });
  }
}
