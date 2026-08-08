import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';
import { PaymentProviderService } from '../payments/payment-provider.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';
import { DEFAULT_PLATFORM_FEE_RATE } from '../common/platform-config';
import { ProcessRefundInput, RefundProcessResult } from './refund.types';
import { RETURN_REFUND_ORDER_INCLUDE } from './refund-order.include';
import { LoyaltyReversalService } from '../loyalty/services/loyalty-reversal.service';
import { RETURN_FULFILMENT, ReturnFulfilment } from '../returns/return-fulfilment.token';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private paymentProviderService: PaymentProviderService,
    private moduleRef: ModuleRef,
    @Optional() private vendorLedgerService?: VendorLedgerService,
    @Optional()
    @Inject(forwardRef(() => LoyaltyReversalService))
    private loyaltyReversalService?: LoyaltyReversalService,
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
        // Everything already put back on these cards counts, however it got there —
        // an admin may have refunded the redemption by hand from the gift-card page,
        // and crediting it twice would leave the card holding more than the order charged.
        const priorRefunds = await this.prisma.giftCardTransaction.groupBy({
          by: ['giftCardId'],
          where: { orderId: returnRequest.orderId, type: 'REFUND' },
          _sum: { amount: true },
        });
        const refundedByCard = new Map<string, number>(
          priorRefunds.map((row: any) => [row.giftCardId, Number(row._sum?.amount ?? 0)]),
        );
        // One card can pay for the same order more than once, so total per card.
        const redeemedByCard = new Map<string, number>();
        for (const redemption of giftCardRedemptions) {
          redeemedByCard.set(
            redemption.giftCardId,
            (redeemedByCard.get(redemption.giftCardId) ?? 0) + Number(redemption.amount),
          );
        }

        let remaining = giftCardRefundAmount;
        await this.prisma.$transaction(async (tx) => {
          for (const [giftCardId, redeemed] of redeemedByCard) {
            if (remaining <= 0) break;
            const refundable =
              Math.round((redeemed - (refundedByCard.get(giftCardId) ?? 0)) * 100) / 100;
            if (refundable <= 0) continue;

            const reverseAmount = Math.min(remaining, refundable);
            const card = await tx.giftCard.findUnique({ where: { id: giftCardId } });
            const newBalance = Number(card?.balance || 0) + reverseAmount;
            await tx.giftCard.update({
              where: { id: giftCardId },
              data: { balance: { increment: reverseAmount } },
            });
            await tx.giftCardTransaction.create({
              data: {
                giftCardId,
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

        const reversed = Math.round((giftCardRefundAmount - remaining) * 100) / 100;
        this.logger.log(`Reversed ${reversed} to gift cards for return ${data.returnId}`);
        if (remaining > 0) {
          this.logger.warn(
            `Gift card portion of return ${data.returnId} short by ${remaining} — those redemptions were already refunded`,
          );
        }
      }
    }

    let stripeRefundSucceeded = false;
    let stripeError: string | undefined;
    let stripeRefundId: string | undefined;

    const stripePaymentId = returnRequest.order.stripePaymentIntentId;

    // Match checkout: actively re-init Stripe (integrations/env) before gating on availability.
    // Sync isProviderAvailable() alone misses cold starts / post-deploy process restarts.
    if (stripePaymentId && cardRefundAmount > 0) {
      await this.paymentProviderService.ensureAvailableProviders();
    }

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
      } else if (result?.status === 'pending') {
        // Refund accepted by Stripe but not settled — keep PENDING; do not ledger/totals yet
        stripeRefundId = result.refundId;
        stripeError = result.error || 'Stripe refund is pending confirmation';
        await this.transactionsService.updateTransactionStatus(transaction.id, 'PENDING', {
          reason: stripeError,
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
              stripeStatus: 'pending',
            },
          },
        });
        this.logger.warn(
          `Stripe refund pending for return ${data.returnId} (refundId=${stripeRefundId})`,
        );
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

    // Loyalty follows HOS-settled value: GC reverse can complete even when Stripe fails.
    // Cumulative top-up on retry when the card portion later succeeds. The gift-card
    // side is read back from the ledger, capped at this return's share, so a portion an
    // admin already restored still counts once and only once.
    const giftCardSettled =
      giftCardRefundAmount > 0
        ? Math.min(
            giftCardRefundAmount,
            await this.giftCardRefundedForOrder(returnRequest.orderId),
          )
        : 0;
    const settledRefundAmount =
      Math.round((giftCardSettled + (stripeRefundSucceeded ? cardRefundAmount : 0)) * 100) / 100;

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
    // Note: refundAmount is intentionally left untouched when the card refund did not
    // settle — retryReturnRefund derives its amount from it and would otherwise retry
    // only the already-restored gift-card portion.

    if (settledRefundAmount > 0 && this.loyaltyReversalService) {
      try {
        await this.loyaltyReversalService.onReturnRefunded({
          returnId: data.returnId,
          orderId: returnRequest.orderId,
          refundAmount: settledRefundAmount,
        });
      } catch (e) {
        this.logger.warn(
          `Loyalty reversal on return ${data.returnId} failed: ${(e as Error).message}`,
        );
      }
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
    // Nothing carries this refund id: adopt the return's own unsettled attempt when
    // there is exactly one, so the settlement lands on that row instead of a second
    // ledger entry that leaves the original stuck as pending.
    const adopted = matched ? undefined : this.findUnsettledReturnRefund(existing);
    const attributed = matched ?? adopted;

    if (params.status === 'succeeded') {
      const returnId =
        attributed?.returnId ||
        ((attributed?.metadata as any)?.returnRequestId as string | undefined) ||
        null;
      if (returnId) {
        const settledAmount = await this.settledValueForReturn({
          orderId: order.id,
          returnId,
          cardAmount: params.amount,
          orderTotal: Number(order.total),
        });
        await this.reverseLoyaltyForSettledRefund(order.id, returnId, settledAmount);
        // A COMPLETED transaction means the inline attempt already finalised the
        // return; anything else is a pending/failed card refund settling now.
        if (attributed?.status !== 'COMPLETED') {
          await this.completeReturnAfterCardSettlement({
            returnId,
            orderId: order.id,
            cardAmount: params.amount,
            settledAmount,
          });
        }
      }
    }

    if (attributed) {
      if (adopted) {
        // Record the refund id so a redelivery matches this row directly.
        await this.prisma.transaction.update({
          where: { id: adopted.id },
          data: {
            metadata: {
              ...(typeof adopted.metadata === 'object' && adopted.metadata ? adopted.metadata : {}),
              stripeRefundId: params.stripeRefundId,
              paymentIntentId: params.paymentIntentId,
            } as any,
          },
        });
      }
      if (attributed.status !== txStatus) {
        await this.transactionsService.updateTransactionStatus(attributed.id, txStatus as any, {
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

  /**
   * Every refund we raise for a return records its Stripe id, so a webhook with no
   * match is either a refund raised straight in Stripe, an order cancellation, or an
   * attempt whose id never got written. Only the last of those belongs to a return,
   * and only when a single attempt is still unsettled — guessing would complete and
   * restock the wrong one.
   */
  private findUnsettledReturnRefund<T extends { returnId?: string | null; status?: string }>(
    refundTxs: T[],
  ): T | undefined {
    const unsettled = refundTxs.filter((t) => t.returnId && t.status !== 'COMPLETED');
    if (unsettled.length === 1) {
      return unsettled[0];
    }
    if (unsettled.length > 1) {
      this.logger.warn(
        `Stripe refund could not be attributed: ${unsettled.length} unsettled return refunds on this order`,
      );
    }
    return undefined;
  }

  /**
   * Gift-card value restored on this order, however it got there — the return
   * reversal or an admin refunding the redemption by hand. Loyalty follows what the
   * customer actually got back, so both count.
   */
  private async giftCardRefundedForOrder(orderId: string): Promise<number> {
    const reversals = await this.prisma.giftCardTransaction.findMany({
      where: { orderId, type: 'REFUND' },
      select: { amount: true },
    });
    return reversals.reduce((sum: number, t: { amount: unknown }) => sum + Number(t.amount), 0);
  }

  /** Card value that settled plus restored gift-card value, never more than the return is worth. */
  private async settledValueForReturn(params: {
    orderId: string;
    returnId: string;
    cardAmount: number;
    orderTotal: number;
  }): Promise<number> {
    const [giftCardRestored, returnRequest] = await Promise.all([
      this.giftCardRefundedForOrder(params.orderId),
      this.prisma.returnRequest.findUnique({
        where: { id: params.returnId },
        select: { refundAmount: true },
      }),
    ]);
    const cap = Number(returnRequest?.refundAmount ?? params.orderTotal ?? 0);
    const settled = Math.round((params.cardAmount + giftCardRestored) * 100) / 100;
    return cap > 0 ? Math.min(cap, settled) : settled;
  }

  /**
   * Card refunds can settle asynchronously (inline attempt returned pending/failed),
   * so top up the loyalty reversal once Stripe confirms. Reversal is cumulative per
   * return, so replayed webhooks are no-ops.
   */
  private async reverseLoyaltyForSettledRefund(
    orderId: string,
    returnId: string,
    settledAmount: number,
  ): Promise<void> {
    if (!this.loyaltyReversalService || settledAmount <= 0) return;
    try {
      await this.loyaltyReversalService.onReturnRefunded({
        returnId,
        orderId,
        refundAmount: settledAmount,
      });
    } catch (e) {
      this.logger.warn(
        `Loyalty reversal from refund webhook failed for order ${orderId}: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Finishes a return whose card refund settled after the inline attempt returned
   * pending or failed — otherwise the request stays APPROVED/PROCESSING forever and
   * the vendor ledger never sees the refund. Idempotent: a return that is already
   * COMPLETED, or one that was rejected/cancelled, is left alone.
   */
  private async completeReturnAfterCardSettlement(params: {
    returnId: string;
    orderId: string;
    cardAmount: number;
    settledAmount: number;
  }): Promise<void> {
    try {
      const returnRequest = await this.prisma.returnRequest.findUnique({
        where: { id: params.returnId },
        include: { order: { include: RETURN_REFUND_ORDER_INCLUDE } },
      });
      if (!returnRequest) return;
      if (!['APPROVED', 'PROCESSING'].includes(returnRequest.status)) return;

      // Claim the return with a conditional write so a redelivered webhook cannot
      // restock the items or ledger the refund a second time.
      const claimed = await this.prisma.returnRequest.updateMany({
        where: { id: params.returnId, status: { in: ['APPROVED', 'PROCESSING'] } },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
          refundAmount: returnRequest.refundAmount ?? params.settledAmount,
          refundMethod: returnRequest.refundMethod ?? 'ORIGINAL_PAYMENT',
        },
      });
      if (claimed.count === 0) return;

      // The inline attempt recorded nothing on the payment (it was pending or failed),
      // so the whole settled value lands here — gift-card portion included.
      await this.updatePaymentRefundTotal(params.orderId, params.settledAmount);
      await this.recordVendorLedgerRefunds(
        returnRequest.order as any,
        Number(returnRequest.refundAmount ?? params.settledAmount),
      );
      // Restock and order status live in ReturnsService so the async path lands on
      // exactly the same rules as an inline refund (partial returns keep their status).
      await this.finalizeReturnFulfilment(params.returnId, params.orderId);

      this.logger.log(
        `Return ${params.returnId} completed from Stripe refund webhook (card ${params.cardAmount})`,
      );
    } catch (e) {
      this.logger.error(
        `Failed to complete return ${params.returnId} after card settlement: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Resolved lazily by token: the returns side already injects this service, so a
   * direct import would put the two constructors in a cycle.
   */
  private async finalizeReturnFulfilment(returnId: string, orderId: string): Promise<void> {
    try {
      const returns = this.moduleRef.get<ReturnFulfilment>(RETURN_FULFILMENT, { strict: false });
      await returns.finalizeSettledReturn(returnId);
    } catch (e) {
      // Never leave the order looking unrefunded just because restock failed.
      this.logger.error(
        `Restock/order update after settled refund failed for return ${returnId}: ${(e as Error).message}`,
      );
      await this.prisma.order
        .update({
          where: { id: orderId },
          data: { paymentStatus: 'REFUNDED' },
        })
        .catch(() => undefined);
    }
  }
}
