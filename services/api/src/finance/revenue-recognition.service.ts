import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface RevenueBreakdown {
  recognized: number;
  deferred: number;
  refundProvision: number;
  netRecognized: number;
}

@Injectable()
export class RevenueRecognitionService {
  private readonly HISTORICAL_REFUND_RATE = 0.05;

  constructor(private prisma: PrismaService) {}

  async getRevenueBreakdown(periodStart: Date, periodEnd: Date): Promise<RevenueBreakdown> {
    const deliveredOrders = await this.prisma.order.aggregate({
      where: {
        status: { in: ['DELIVERED'] },
        paymentStatus: 'PAID',
        updatedAt: { gte: periodStart, lt: periodEnd },
        parentOrderId: null,
        deletedAt: null,
      },
      _sum: { total: true },
    });
    const recognized = Number(deliveredOrders._sum.total || 0);

    const deferredOrders = await this.prisma.order.aggregate({
      where: {
        status: { in: ['PENDING', 'ACCEPTED', 'CONFIRMED', 'PROCESSING', 'FULFILLED', 'SHIPPED'] },
        paymentStatus: 'PAID',
        createdAt: { lt: periodEnd },
        parentOrderId: null,
        deletedAt: null,
      },
      _sum: { total: true },
    });
    const deferred = Number(deferredOrders._sum.total || 0);

    const refundProvision = +(recognized * this.HISTORICAL_REFUND_RATE).toFixed(2);

    const netRecognized = +(recognized - refundProvision).toFixed(2);

    return { recognized, deferred, refundProvision, netRecognized };
  }

  async getMonthlyRecognition(year: number, month: number) {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);

    const breakdown = await this.getRevenueBreakdown(periodStart, periodEnd);

    const actualRefunds = await this.prisma.transaction.aggregate({
      where: {
        type: 'REFUND',
        status: 'COMPLETED',
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      _sum: { amount: true },
    });

    return {
      year,
      month,
      ...breakdown,
      actualRefunds: Number(actualRefunds._sum.amount || 0),
      provisionAccuracy: breakdown.recognized > 0
        ? +((Number(actualRefunds._sum.amount || 0) / breakdown.recognized) * 100).toFixed(2)
        : 0,
    };
  }

  async getDeferredRevenueDetails(page = 1, limit = 50) {
    const deferredStatuses: OrderStatus[] = [
      'PENDING',
      'ACCEPTED',
      'CONFIRMED',
      'PROCESSING',
      'FULFILLED',
      'SHIPPED',
    ];

    const where = {
      status: { in: deferredStatuses },
      paymentStatus: PaymentStatus.PAID,
      parentOrderId: null,
      deletedAt: null,
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          currency: true,
          status: true,
          createdAt: true,
          seller: { select: { storeName: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map((o) => ({
        ...o,
        total: Number(o.total),
        ageInDays: Math.floor((Date.now() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
