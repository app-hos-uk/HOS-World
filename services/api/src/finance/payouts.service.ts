import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';

@Injectable()
export class PayoutsService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
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
      currency: data.currency || 'GBP',
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
    const transaction = await this.prisma.transaction.findUnique({
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

    // Update transaction status to completed
    // In a real implementation, this would integrate with payment gateway
    const updated = await this.transactionsService.updateTransactionStatus(
      transactionId,
      'COMPLETED',
    );

    return updated;
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
