import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';

@Injectable()
export class PayoutsService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    @Optional() private vendorLedgerService?: VendorLedgerService,
  ) {}

  async schedulePayout(data: {
    sellerId: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    scheduledDate?: Date;
    description?: string;
  }) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: data.sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Create transaction for payout
    const transaction = await this.transactionsService.createTransaction({
      type: 'PAYOUT',
      amount: data.amount,
      currency: data.currency || 'USD',
      sellerId: data.sellerId,
      description: data.description || `Payout to ${seller.storeName}`,
      status: data.scheduledDate && data.scheduledDate > new Date() ? 'PENDING' : 'PENDING',
      metadata: {
        paymentMethod: data.paymentMethod,
        scheduledDate: data.scheduledDate,
      },
    });

    return transaction;
  }

  async processPayout(transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.type !== 'PAYOUT') {
        throw new BadRequestException('Transaction is not a payout');
      }

      if (transaction.status !== 'PENDING') {
        throw new BadRequestException('Payout has already been processed');
      }

      if (transaction.sellerId && this.vendorLedgerService) {
        await this.vendorLedgerService.recordPayout(
          {
            sellerId: transaction.sellerId,
            amount: Number(transaction.amount),
            referenceId: transactionId,
            currency: transaction.currency || 'USD',
          },
          { tx },
        );
      }

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
        include: {
          seller: {
            select: { id: true, storeName: true, slug: true },
          },
          customer: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      await tx.transactionAuditLog.create({
        data: {
          transactionId,
          previousStatus: 'PENDING',
          newStatus: 'COMPLETED',
          reason: 'Payout processed',
        },
      });

      return updated;
    });
  }

  async getPayouts(filters?: {
    sellerId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    return this.transactionsService.getTransactions({
      ...filters,
      type: 'PAYOUT',
    });
  }

  async getSellerPayoutHistory(
    sellerId: string,
    filters?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    return this.getPayouts({
      ...filters,
      sellerId,
    });
  }
}
