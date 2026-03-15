import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
// Decimal is used via Prisma's auto-coercion at the DB layer
import { Prisma } from '@prisma/client';

@Injectable()
export class VendorLedgerService {
  private readonly logger = new Logger(VendorLedgerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordSale(params: {
    sellerId: string;
    orderId: string;
    saleAmount: number;
    commissionRate: number;
    currency?: string;
  }) {
    const { sellerId, orderId, saleAmount, commissionRate, currency = 'USD' } = params;

    const commissionAmount = +(saleAmount * commissionRate).toFixed(2);
    const netAmount = +(saleAmount - commissionAmount).toFixed(2);

    return this.prisma.$transaction(
      async (tx) => {
        const lastEntry = await tx.vendorLedgerEntry.findFirst({
          where: { sellerId },
          orderBy: { createdAt: 'desc' },
        });
        const currentBalance = lastEntry ? Number(lastEntry.balance) : 0;
        const newBalance = +(currentBalance + netAmount).toFixed(2);

        const saleEntry = await tx.vendorLedgerEntry.create({
          data: {
            sellerId,
            orderId,
            type: 'SALE',
            amount: netAmount,
            currency,
            balance: newBalance,
            description: `Sale from order`,
            metadata: {
              grossAmount: saleAmount,
              commissionRate,
              commissionAmount,
              netAmount,
            },
          },
        });

        await tx.vendorLedgerEntry.create({
          data: {
            sellerId,
            orderId,
            type: 'COMMISSION',
            amount: -commissionAmount,
            currency,
            balance: newBalance,
            description: `Platform commission (${(commissionRate * 100).toFixed(1)}%)`,
            metadata: { rate: commissionRate, amount: commissionAmount },
          },
        });

        return saleEntry;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async recordRefund(params: {
    sellerId: string;
    orderId: string;
    refundAmount: number;
    commissionRate?: number;
    currency?: string;
  }) {
    const { sellerId, orderId, refundAmount, commissionRate = 0.1, currency = 'USD' } = params;

    // Adjust refund to account for commission: vendor only gets debited the net portion
    const commissionRefund = +(refundAmount * commissionRate).toFixed(2);
    const netRefund = +(refundAmount - commissionRefund).toFixed(2);

    return this.prisma.$transaction(
      async (tx) => {
        const lastEntry = await tx.vendorLedgerEntry.findFirst({
          where: { sellerId },
          orderBy: { createdAt: 'desc' },
        });
        const currentBalance = lastEntry ? Number(lastEntry.balance) : 0;
        const newBalance = +(currentBalance - netRefund).toFixed(2);

        return tx.vendorLedgerEntry.create({
          data: {
            sellerId,
            orderId,
            type: 'REFUND',
            amount: -netRefund,
            currency,
            balance: newBalance,
            description: `Refund for order (net of commission)`,
            metadata: {
              grossRefund: refundAmount,
              commissionRefund,
              netRefund,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async recordPayout(params: {
    sellerId: string;
    amount: number;
    referenceId?: string;
    currency?: string;
  }) {
    const { sellerId, amount, referenceId, currency = 'USD' } = params;

    if (amount <= 0) {
      throw new BadRequestException('Payout amount must be greater than zero');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const lastEntry = await tx.vendorLedgerEntry.findFirst({
          where: { sellerId },
          orderBy: { createdAt: 'desc' },
        });
        const currentBalance = lastEntry ? Number(lastEntry.balance) : 0;

        if (amount > currentBalance) {
          throw new BadRequestException(
            `Insufficient balance. Available: $${currentBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
          );
        }

        return tx.vendorLedgerEntry.create({
          data: {
            sellerId,
            type: 'PAYOUT',
            amount: -amount,
            currency,
            balance: +(currentBalance - amount).toFixed(2),
            description: `Payout processed`,
            referenceId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async getBalance(sellerId: string): Promise<number> {
    const lastEntry = await this.prisma.vendorLedgerEntry.findFirst({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
    return lastEntry ? Number(lastEntry.balance) : 0;
  }

  async getLedgerEntries(
    sellerId: string,
    options: {
      type?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { type, startDate, endDate, page = 1, limit: rawLimit = 20 } = options;
    const limit = Math.min(rawLimit, 100);

    const where: any = { sellerId };
    if (type) where.type = type;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      this.prisma.vendorLedgerEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: { id: true, orderNumber: true, total: true },
          },
        },
      }),
      this.prisma.vendorLedgerEntry.count({ where }),
    ]);

    return {
      data: entries,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSummary(sellerId: string, startDate?: Date, endDate?: Date) {
    const where: any = { sellerId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const entries = await this.prisma.vendorLedgerEntry.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    const balance = await this.getBalance(sellerId);

    const summary: Record<string, { total: number; count: number }> = {};
    for (const entry of entries) {
      summary[entry.type] = {
        total: Number(entry._sum.amount) || 0,
        count: entry._count,
      };
    }

    return { balance, breakdown: summary };
  }
}
