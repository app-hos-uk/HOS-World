import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(private prisma: PrismaService) {}

  async createFromWebhook(data: {
    stripeDisputeId: string;
    paymentIntentId?: string;
    amount: number;
    currency: string;
    reason?: string;
    evidenceDeadline?: Date;
  }) {
    // Find matching order/transaction by payment intent
    let orderId: string | undefined;
    let sellerId: string | undefined;
    let customerId: string | undefined;
    let transactionId: string | undefined;

    if (data.paymentIntentId) {
      const order = await this.prisma.order.findFirst({
        where: { stripePaymentIntentId: data.paymentIntentId },
        select: { id: true, sellerId: true, userId: true },
      });
      if (order) {
        orderId = order.id;
        sellerId = order.sellerId || undefined;
        customerId = order.userId;
      }

      const tx = await this.prisma.transaction.findFirst({
        where: { orderId, type: 'PAYMENT' },
        select: { id: true },
      });
      if (tx) transactionId = tx.id;
    }

    const existing = await this.prisma.dispute.findUnique({
      where: { stripeDisputeId: data.stripeDisputeId },
    });
    if (existing) {
      return this.prisma.dispute.update({
        where: { id: existing.id },
        data: {
          status: 'OPEN',
          amount: data.amount,
          reason: data.reason,
          evidenceDeadline: data.evidenceDeadline,
        },
      });
    }

    return this.prisma.dispute.create({
      data: {
        stripeDisputeId: data.stripeDisputeId,
        orderId,
        transactionId,
        sellerId,
        customerId,
        amount: data.amount,
        currency: data.currency,
        reason: data.reason,
        status: 'OPEN',
        evidenceDeadline: data.evidenceDeadline,
      },
    });
  }

  async updateFromWebhook(stripeDisputeId: string, update: {
    status?: string;
    outcome?: string;
  }) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { stripeDisputeId },
    });
    if (!dispute) {
      this.logger.warn(`Dispute not found for Stripe ID: ${stripeDisputeId}`);
      return null;
    }

    const statusMap: Record<string, string> = {
      'needs_response': 'EVIDENCE_REQUIRED',
      'under_review': 'UNDER_REVIEW',
      'won': 'WON',
      'lost': 'LOST',
      'closed': 'CLOSED',
    };

    const newStatus = update.status ? (statusMap[update.status] || dispute.status) : dispute.status;

    return this.prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status: newStatus as any,
        outcome: update.outcome,
        resolvedAt: ['WON', 'LOST', 'CLOSED'].includes(newStatus) ? new Date() : undefined,
      },
    });
  }

  async getDisputes(filters?: {
    status?: string;
    sellerId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const where: any = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.sellerId) where.sellerId = filters.sellerId;

    const [disputes, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: { select: { id: true, orderNumber: true, total: true } },
          seller: { select: { id: true, storeName: true } },
          customer: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { disputes, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getDisputeById(id: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNumber: true, total: true, currency: true } },
        seller: { select: { id: true, storeName: true } },
        customer: { select: { id: true, email: true, firstName: true, lastName: true } },
        transaction: { select: { id: true, amount: true, status: true } },
      },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  async updateDisputeStatus(id: string, status: string, notes?: string) {
    return this.prisma.dispute.update({
      where: { id },
      data: {
        status: status as any,
        notes,
        resolvedAt: ['WON', 'LOST', 'CLOSED'].includes(status) ? new Date() : undefined,
      },
    });
  }

  async markEvidenceSubmitted(id: string) {
    return this.prisma.dispute.update({
      where: { id },
      data: { evidenceSubmitted: true, status: 'UNDER_REVIEW' },
    });
  }

  async getSellerChargebackRate(sellerId: string): Promise<{ rate: number; total: number; lost: number }> {
    const [total, lost] = await Promise.all([
      this.prisma.dispute.count({ where: { sellerId } }),
      this.prisma.dispute.count({ where: { sellerId, status: 'LOST' } }),
    ]);
    return { rate: total > 0 ? lost / total : 0, total, lost };
  }
}
