import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PeriodCloseService {
  private readonly logger = new Logger(PeriodCloseService.name);

  constructor(private prisma: PrismaService) {}

  private static readonly STATUSES = ['OPEN', 'CLOSING', 'CLOSED'] as const;

  private normalizeStatus(status: string): string {
    const normalized = status.trim().toUpperCase();
    if (!PeriodCloseService.STATUSES.includes(normalized as (typeof PeriodCloseService.STATUSES)[number])) {
      throw new BadRequestException(
        `Invalid period status "${status}". Expected one of: ${PeriodCloseService.STATUSES.join(', ')}`,
      );
    }
    return normalized;
  }

  async getPeriods(filters?: { year?: number; status?: string }) {
    const where: any = {};
    if (filters?.year) where.year = filters.year;
    if (filters?.status) where.status = this.normalizeStatus(filters.status);

    return this.prisma.financialPeriod.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { closedBy: { select: { email: true, firstName: true, lastName: true } } },
    });
  }

  async getOrCreatePeriod(year: number, month: number) {
    return this.prisma.financialPeriod.upsert({
      where: { year_month: { year, month } },
      update: {},
      create: { year, month, status: 'OPEN' },
    });
  }

  async closePeriod(year: number, month: number, closedById?: string, notes?: string) {
    if (!Number.isInteger(year) || year < 2000 || year > 2999) {
      throw new BadRequestException(`Invalid year "${year}"`);
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException(`Invalid month "${month}" — expected 1-12`);
    }

    const period = await this.getOrCreatePeriod(year, month);
    if (period.status === 'CLOSED') {
      throw new BadRequestException(`Period ${year}-${String(month).padStart(2, '0')} is already closed`);
    }

    // A stale or non-persisted token subject would otherwise trip the closedBy foreign key.
    const closer = closedById
      ? await this.prisma.user.findUnique({ where: { id: closedById }, select: { id: true } })
      : null;

    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);

    const [revenue, refunds, payouts, fees] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { type: 'PAYMENT', status: 'COMPLETED', createdAt: { gte: periodStart, lt: periodEnd } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'REFUND', status: 'COMPLETED', createdAt: { gte: periodStart, lt: periodEnd } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'PAYOUT', status: 'COMPLETED', createdAt: { gte: periodStart, lt: periodEnd } },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { type: 'FEE', status: 'COMPLETED', createdAt: { gte: periodStart, lt: periodEnd } },
        _sum: { amount: true },
      }),
    ]);

    const totalRevenue = Number(revenue._sum.amount || 0);
    const totalRefunds = Number(refunds._sum.amount || 0);
    const totalPayouts = Number(payouts._sum.amount || 0);
    const totalFees = Number(fees._sum.amount || 0);
    const netIncome = totalRevenue - totalRefunds - totalPayouts + totalFees;

    return this.prisma.financialPeriod.update({
      where: { year_month: { year, month } },
      data: {
        status: 'CLOSED',
        closedById: closer?.id ?? null,
        closedAt: new Date(),
        notes,
        totalRevenue,
        totalRefunds,
        totalPayouts,
        totalFees,
        netIncome,
      },
    });
  }

  async reopenPeriod(year: number, month: number) {
    const period = await this.prisma.financialPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    if (!period) throw new BadRequestException('Period not found');
    if (period.status !== 'CLOSED') throw new BadRequestException('Period is not closed');

    return this.prisma.financialPeriod.update({
      where: { year_month: { year, month } },
      data: { status: 'OPEN', closedAt: null, closedById: null },
    });
  }

  async isTransactionInClosedPeriod(date: Date): Promise<boolean> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const period = await this.prisma.financialPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    return period?.status === 'CLOSED';
  }
}
