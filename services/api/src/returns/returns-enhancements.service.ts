import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReturnsEnhancementsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate return authorization number
   */
  private generateReturnNumber(): string {
    return `RET-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }

  /**
   * Create return authorization
   */
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

    // Update return request with authorization
    const returnNumber = this.generateReturnNumber();

    const updated = await this.prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        status: 'APPROVED',
        notes: (notes || returnRequest.notes || '') + ` [Return Number: ${returnNumber}]`,
        // Note: metadata field may not exist in schema - using notes field instead
      },
    });

    return {
      ...updated,
      returnNumber,
    };
  }

  /**
   * Generate shipping label for return
   */
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

    if (returnRequest.status !== 'APPROVED') {
      throw new BadRequestException('Return must be approved before generating label');
    }

    // In production, integrate with shipping provider (USPS, FedEx, etc.)
    // For now, return a mock label URL
    const labelUrl = `https://labels.hos-marketplace.com/returns/${returnRequest.id}`;

    // Note: metadata field may not exist in ReturnRequest schema
    // Store label info in notes field instead
    await this.prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        notes: (returnRequest.notes || '') + ` [Shipping Label: ${labelUrl}]`,
      },
    });

    return {
      labelUrl,
      trackingNumber: `RTN${returnRequest.id.substring(0, 8).toUpperCase()}`,
      instructions: 'Please print and attach this label to your return package.',
    };
  }

  /**
   * Process return refund
   */
  async processReturnRefund(returnRequestId: string): Promise<any> {
    const returnRequest = await this.prisma.returnRequest.findUnique({
      where: { id: returnRequestId },
      include: {
        order: {
          include: {
            payments: true,
          },
        },
      },
    });

    if (!returnRequest) {
      throw new NotFoundException('Return request not found');
    }

    if (returnRequest.status !== 'APPROVED') {
      throw new BadRequestException('Return must be approved before processing refund');
    }

    // Get order total from included order relation
    const orderTotal = returnRequest.order ? Number(returnRequest.order.total) : 0;
    const refundAmount = returnRequest.refundAmount || orderTotal;

    // Process refund through payment provider
    // This is a simplified version - in production, integrate with Stripe/Klarna
    const refundId = `refund_${Date.now()}`;

    await this.prisma.returnRequest.update({
      where: { id: returnRequestId },
      data: {
        status: 'COMPLETED',
        processedAt: new Date(),
        notes: (returnRequest.notes || '') + ` [Refund ID: ${refundId}]`,
      },
    });

    return {
      returnRequestId,
      refundAmount,
      refundId,
      status: 'completed',
    };
  }

  /**
   * Get return analytics
   */
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

    // Calculate average
    const returnsWithRefund = returns.filter((r) => r.refundAmount);
    if (returnsWithRefund.length > 0) {
      analytics.averageRefundAmount = analytics.totalRefundAmount / returnsWithRefund.length;
    }

    // Count by reason
    returns.forEach((r) => {
      const reason = r.reason.substring(0, 50); // Truncate long reasons
      analytics.byReason[reason] = (analytics.byReason[reason] || 0) + 1;
    });

    return analytics;
  }
}
