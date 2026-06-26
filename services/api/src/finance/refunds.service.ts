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

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private paymentProviderService: PaymentProviderService,
    @Optional() private vendorLedgerService?: VendorLedgerService,
  ) {}

  async processRefund(data: {
    returnId: string;
    amount: number;
    currency?: string;
    description?: string;
  }) {
    if (data.amount <= 0) {
      throw new BadRequestException('Refund amount must be greater than zero');
    }

    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: data.returnId },
      include: {
        order: {
          include: {
            seller: { select: { id: true, commissionRate: true } },
          },
        },
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    // Allow PENDING (called during approval transition) or APPROVED (called after)
    const allowedStatuses = ['PENDING', 'APPROVED'];
    if (!allowedStatuses.includes(returnRequest.status)) {
      throw new BadRequestException('Return request must be pending approval or approved before processing refund');
    }

    if (data.amount > Number(returnRequest.order.total)) {
      throw new BadRequestException('Refund amount cannot exceed order total');
    }

    // Cumulative refund cap: sum all existing COMPLETED refunds for this order
    const existingOrderRefunds = await this.transactionsService.getTransactions({
      orderId: returnRequest.orderId,
      type: 'REFUND',
      status: 'COMPLETED',
    });
    const totalRefundedSoFar = (existingOrderRefunds?.transactions || []).reduce(
      (sum: number, tx: any) => sum + Number(tx.amount || 0), 0,
    );
    if (totalRefundedSoFar + data.amount > Number(returnRequest.order.total)) {
      throw new BadRequestException(
        `Refund would exceed order total. Already refunded: ${totalRefundedSoFar.toFixed(2)}, requested: ${data.amount.toFixed(2)}, order total: ${Number(returnRequest.order.total).toFixed(2)}`,
      );
    }

    const existingRefund = await this.transactionsService.getTransactions({
      returnId: data.returnId,
      type: 'REFUND',
      status: 'COMPLETED',
    });
    if (existingRefund?.transactions?.length > 0) {
      throw new BadRequestException('A refund has already been processed for this return');
    }

    const transaction = await this.transactionsService.createTransaction({
      type: 'REFUND',
      amount: data.amount,
      currency: data.currency || returnRequest.order.currency,
      customerId: returnRequest.userId,
      orderId: returnRequest.orderId,
      returnId: data.returnId,
      description: data.description || `Refund for return request ${data.returnId}`,
      status: 'PENDING',
      metadata: {
        returnRequestId: data.returnId,
      },
    });

    await this.prisma.returnRequest.update({
      where: { id: data.returnId },
      data: {
        refundAmount: data.amount,
        refundMethod: 'ORIGINAL_PAYMENT',
      },
    });

    // Split refund between card and gift-card portions (mirrors cancel logic).
    // Gift-card redemptions reduce the card-refundable amount.
    const giftCardRedemptions = await this.prisma.giftCardTransaction.findMany({
      where: { orderId: returnRequest.orderId, type: 'REDEMPTION' },
      select: { amount: true, giftCardId: true },
    });
    const giftCardTotal = giftCardRedemptions.reduce(
      (sum: number, tx: any) => sum + Number(tx.amount), 0,
    );
    const orderTotal = Number(returnRequest.order.total);
    // Proportion of this refund that should go to card vs gift card
    const cardProportion = orderTotal > 0 ? Math.max(0, orderTotal - giftCardTotal) / orderTotal : 1;
    const cardRefundAmount = Math.round(data.amount * cardProportion * 100) / 100;
    const giftCardRefundAmount = data.amount - cardRefundAmount;

    // Reverse gift-card portion back to cards
    if (giftCardRefundAmount > 0 && giftCardRedemptions.length > 0) {
      let remaining = giftCardRefundAmount;
      for (const redemption of giftCardRedemptions) {
        if (remaining <= 0) break;
        const reverseAmount = Math.min(remaining, Number(redemption.amount));
        await this.prisma.giftCard.update({
          where: { id: redemption.giftCardId },
          data: { balance: { increment: reverseAmount } },
        });
        remaining -= reverseAmount;
      }
      this.logger.log(`Reversed ${giftCardRefundAmount} to gift cards for return ${data.returnId}`);
    }

    const stripePaymentId = returnRequest.order.stripePaymentIntentId;
    if (stripePaymentId && cardRefundAmount > 0 && this.paymentProviderService.isProviderAvailable('stripe')) {
      try {
        const provider = this.paymentProviderService.getProvider('stripe');
        const result = await provider.refundPayment({
          paymentId: stripePaymentId,
          amount: cardRefundAmount,
          metadata: { currency: data.currency || returnRequest.order.currency, returnId: data.returnId },
        });

        if (result && !result.success) {
          await this.transactionsService.updateTransactionStatus(transaction.id, 'FAILED');
          throw new BadRequestException('Payment provider refund was not successful');
        }

        await this.transactionsService.updateTransactionStatus(transaction.id, 'COMPLETED');
        this.logger.log(`Refund processed via Stripe for return ${data.returnId}`);
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        this.logger.error(`Stripe refund failed for return ${data.returnId}:`, error);
        await this.transactionsService.updateTransactionStatus(transaction.id, 'FAILED');
        throw new BadRequestException('Payment provider refund failed. Please retry.');
      }
    } else if (stripePaymentId && cardRefundAmount > 0) {
      // Stripe PI exists but provider is temporarily unavailable — do not silently succeed
      await this.transactionsService.updateTransactionStatus(transaction.id, 'FAILED');
      throw new BadRequestException(
        'Payment provider is temporarily unavailable. Refund could not be processed. Please retry later.',
      );
    } else if (cardRefundAmount <= 0 || !stripePaymentId) {
      // No card refund needed (gift-card-only order, or zero card amount) — complete immediately
      await this.transactionsService.updateTransactionStatus(transaction.id, 'COMPLETED');
      this.logger.log(`Refund for return ${data.returnId} completed (gift-card only, no Stripe refund needed)`);
    } else {
      await this.transactionsService.updateTransactionStatus(transaction.id, 'PENDING');
      this.logger.warn(
        `No payment provider for return ${data.returnId}. Refund marked PENDING for manual processing.`,
      );
    }

    if (this.vendorLedgerService && returnRequest.order.sellerId) {
      try {
        const commissionRate = returnRequest.order.seller?.commissionRate
          ? Number(returnRequest.order.seller.commissionRate)
          : 0.1;
        await this.vendorLedgerService.recordRefund({
          sellerId: returnRequest.order.sellerId,
          orderId: returnRequest.orderId,
          refundAmount: data.amount,
          commissionRate,
        });
      } catch (err) {
        this.logger.error(`Failed to record vendor ledger refund: ${err}`);
      }
    }

    return transaction;
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
  ) {
    return this.transactionsService.updateTransactionStatus(transactionId, status);
  }
}
