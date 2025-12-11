import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';
import Stripe from 'stripe';

@Injectable()
export class RefundsService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    private configService: ConfigService,
  ) {
    // Initialize Stripe if API key is available
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, {
        apiVersion: '2024-01-05.acacia',
      });
      this.logger.log('Stripe initialized for refund processing');
    } else {
      this.logger.warn('Stripe secret key not found - refunds will be processed without payment gateway');
    }
  }

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

    // Process refund through Stripe if available
    if (this.stripe) {
      try {
        // Get the payment for this order
        const payment = await this.prisma.payment.findFirst({
          where: {
            orderId: returnRequest.orderId,
            status: 'PAID',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (payment && payment.stripePaymentId) {
          // Convert amount to pence (Stripe uses smallest currency unit)
          const refundAmountPence = Math.round(data.amount * 100);

          // Create Stripe refund
          const stripeRefund = await this.stripe.refunds.create({
            payment_intent: payment.stripePaymentId,
            amount: refundAmountPence,
            reason: 'requested_by_customer',
            metadata: {
              returnRequestId: data.returnId,
              orderId: returnRequest.orderId,
              transactionId: transaction.id,
            },
          });

          // Update transaction with Stripe refund ID
          await this.transactionsService.updateTransactionStatus(transaction.id, 'COMPLETED');

          // Update payment record with refund amount
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: {
              refundAmount: data.amount,
              metadata: {
                ...((payment.metadata as any) || {}),
                refundId: stripeRefund.id,
                refundStatus: stripeRefund.status,
                refundedAt: new Date().toISOString(),
              } as any,
            },
          });

          this.logger.log(`Stripe refund processed: ${stripeRefund.id} for return ${data.returnId}`);

          return {
            ...transaction,
            stripeRefundId: stripeRefund.id,
            stripeRefundStatus: stripeRefund.status,
          };
        } else {
          this.logger.warn(`No Stripe payment found for order ${returnRequest.orderId} - processing refund without gateway`);
          await this.transactionsService.updateTransactionStatus(transaction.id, 'COMPLETED');
          return transaction;
        }
      } catch (error: any) {
        this.logger.error(`Stripe refund failed: ${error.message}`, error.stack);
        // Mark transaction as failed but don't throw - allow manual processing
        await this.transactionsService.updateTransactionStatus(transaction.id, 'FAILED');
        throw new BadRequestException(`Refund processing failed: ${error.message}`);
      }
    } else {
      // No Stripe configured - mark as completed for manual processing
      this.logger.log(`Processing refund without Stripe for return ${data.returnId}`);
      await this.transactionsService.updateTransactionStatus(transaction.id, 'COMPLETED');
      return transaction;
    }
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

