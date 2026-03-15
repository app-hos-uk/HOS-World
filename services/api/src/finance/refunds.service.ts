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

    if (returnRequest.status !== 'APPROVED') {
      throw new BadRequestException('Return request must be approved before processing refund');
    }

    if (data.amount > Number(returnRequest.order.total)) {
      throw new BadRequestException('Refund amount cannot exceed order total');
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

    const stripePaymentId = returnRequest.order.stripePaymentIntentId;
    if (stripePaymentId && this.paymentProviderService.isProviderAvailable('stripe')) {
      try {
        const provider = this.paymentProviderService.getProvider('stripe');
        const result = await provider.refundPayment({
          paymentId: stripePaymentId,
          amount: data.amount,
          metadata: { currency: data.currency || returnRequest.order.currency },
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
