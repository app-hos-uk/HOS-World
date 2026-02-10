import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBusService, PAYMENT_EVENTS } from '@hos-marketplace/events';
import { PaymentPrismaService } from '../database/prisma.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private prisma: PaymentPrismaService,
    private configService: ConfigService,
    private eventBus: EventBusService,
  ) {}

  async createPaymentIntent(data: { orderId: string; userId: string; amount: number; currency?: string }) {
    const transaction = await this.prisma.transaction.create({
      data: {
        orderId: data.orderId,
        userId: data.userId,
        type: 'PAYMENT',
        status: 'PENDING',
        amount: data.amount,
        currency: data.currency || 'GBP',
        paymentProvider: 'stripe',
      },
    });
    return transaction;
  }

  async confirmPayment(transactionId: string, providerTransactionId: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    const updated = await this.prisma.transaction.update({ where: { id: transactionId }, data: { status: 'COMPLETED', providerTransactionId } });

    // Emit payment.payment.completed event
    try {
      this.eventBus.emit(PAYMENT_EVENTS.COMPLETED, {
        paymentId: updated.id,
        orderId: updated.orderId,
        userId: updated.userId,
        amount: Number(updated.amount),
        currency: updated.currency,
        provider: updated.paymentProvider || 'stripe',
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit payment.completed event: ${e?.message}`);
    }

    return updated;
  }

  async getTransactions(userId: string, query: { page?: number; limit?: number }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({ where: { userId }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);
    return { transactions, total, page, limit };
  }

  async refund(transactionId: string, amount?: number) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    const refundTx = await this.prisma.transaction.create({
      data: { orderId: tx.orderId, userId: tx.userId, sellerId: tx.sellerId, type: 'REFUND', status: 'COMPLETED', amount: amount || tx.amount, currency: tx.currency, paymentProvider: tx.paymentProvider, metadata: { refundedTransactionId: transactionId } },
    });

    // Emit payment.refund.issued event
    try {
      this.eventBus.emit(PAYMENT_EVENTS.REFUND_ISSUED, {
        refundId: refundTx.id,
        paymentId: transactionId,
        orderId: tx.orderId,
        amount: Number(refundTx.amount),
        currency: refundTx.currency,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit refund.issued event: ${e?.message}`);
    }

    return refundTx;
  }
}
