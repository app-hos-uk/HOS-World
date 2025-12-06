import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';

@Injectable()
export class RefundsService {
  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
  ) {}

  async processRefund(data: {
    returnId: string;
    amount: number;
    currency?: string;
    description?: string;
  }) {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: data.returnId },
      include: {
        order: true,
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (returnRequest.status !== 'APPROVED') {
      throw new BadRequestException('Return request must be approved before processing refund');
    }

    // Create refund transaction
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

    // Update return request with refund amount
    await this.prisma.returnRequest.update({
      where: { id: data.returnId },
      data: {
        refundAmount: data.amount,
        refundMethod: 'ORIGINAL_PAYMENT',
      },
    });

    // In a real implementation, this would integrate with payment gateway (Stripe)
    // For now, we'll mark it as completed
    await this.transactionsService.updateTransactionStatus(transaction.id, 'COMPLETED');

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

