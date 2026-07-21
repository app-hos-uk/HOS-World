import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RefundsService } from '../finance/refunds.service';
import { RETURN_REFUND_ORDER_INCLUDE } from '../finance/refund-order.include';

@Injectable()
export class ReturnsEnhancementsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @Optional() private refundsService?: RefundsService,
  ) {}

  private generateReturnNumber(): string {
    return `RET-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  async createReturnAuthorization(returnRequestId: string, notes?: string): Promise<any> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: { order: true },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (returnRequest.status !== 'PENDING') {
      throw new BadRequestException('Return request is not in pending status');
    }

    const returnNumber = this.generateReturnNumber();

    const updated = await this.prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        notes: (notes || returnRequest.notes || '') + ` [Return Number: ${returnNumber}]`,
      },
    });

    return {
      ...updated,
      returnNumber,
    };
  }

  async generateShippingLabel(returnRequestId: string): Promise<any> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        order: {
          include: {
            shippingAddress: true,
          },
        },
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (!['APPROVED', 'PROCESSING'].includes(returnRequest.status)) {
      throw new BadRequestException('Return must be approved before generating a return label');
    }

    const baseUrl = this.configService.get<string>('RETURN_LABELS_BASE_URL') || this.configService.get<string>('FRONTEND_URL') || 'https://localhost';
    const labelUrl = `${baseUrl}/returns/${returnRequest.id}`;
    const trackingNumber = `RTN${returnRequest.id.substring(0, 8).toUpperCase()}`;

    await this.prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        notes:
          (returnRequest.notes || '') +
          ` [Return label: ${labelUrl}, tracking: ${trackingNumber}]`,
      },
    });

    return {
      labelUrl,
      trackingNumber,
      instructions: 'Please print and attach this label to your return package.',
    };
  }

  /** Delegates to RefundsService — do not bypass finance/Stripe flows. */
  async processReturnRefund(returnRequestId: string): Promise<any> {
    if (!this.refundsService) {
      throw new BadRequestException('Refund service unavailable');
    }

    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
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
      throw new BadRequestException('Return must be approved before processing refund');
    }

    const amount =
      returnRequest.refundAmount != null
        ? Number(returnRequest.refundAmount)
        : Number(returnRequest.order.total);

    const prior = await this.refundsService.getRefunds({ returnId: returnRequestId });
    const priorTxs = prior?.transactions || [];
    const isRetry = priorTxs.some((t: any) => t.status === 'FAILED');

    const result = await this.refundsService.processRefund({
      returnId: returnRequestId,
      amount,
      currency: returnRequest.order.currency,
      description: isRetry
        ? `Retry refund for return request ${returnRequestId}`
        : `Refund for return request ${returnRequestId}`,
      isRetry,
    });

    if (result.stripeRefundSucceeded) {
      await this.prisma.returnRequest.update({
        where: { id: returnRequestId },
        data: {
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });
      await this.prisma.order.update({
        where: { id: returnRequest.orderId },
        data: { status: 'REFUNDED', paymentStatus: 'REFUNDED' },
      });
    }

    return {
      returnRequestId,
      refundAmount: amount,
      status: result.stripeRefundSucceeded ? 'completed' : 'failed',
      transactionId: result.transaction.id,
      error: result.error,
    };
  }

  async getReturnAnalytics(sellerId?: string, startDate?: Date, endDate?: Date): Promise<any> {
    const where: any = {};

    if (sellerId) {
      where.order = { sellerId };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const returns = await this.prisma.returnRequest.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            total: true,
            sellerId: true,
          },
        },
      },
    });

    const analytics = {
      total: returns.length,
      byStatus: {
        pending: returns.filter((r) => r.status === 'PENDING').length,
        approved: returns.filter((r) => r.status === 'APPROVED').length,
        processing: returns.filter((r) => r.status === 'PROCESSING').length,
        completed: returns.filter((r) => r.status === 'COMPLETED').length,
        cancelled: returns.filter((r) => r.status === 'CANCELLED').length,
      },
      totalRefundAmount: returns
        .filter((r) => r.refundAmount)
        .reduce((sum, r) => sum + Number(r.refundAmount || 0), 0),
      averageRefundAmount: 0,
      byReason: {} as Record<string, number>,
    };

    const returnsWithRefund = returns.filter((r) => r.refundAmount);
    if (returnsWithRefund.length > 0) {
      analytics.averageRefundAmount = analytics.totalRefundAmount / returnsWithRefund.length;
    }

    returns.forEach((r) => {
      const reason = r.reason.substring(0, 50);
      analytics.byReason[reason] = (analytics.byReason[reason] || 0) + 1;
    });

    return analytics;
  }
}
