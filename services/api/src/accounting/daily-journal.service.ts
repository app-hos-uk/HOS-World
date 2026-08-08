import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyTxType, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AccountingService } from './accounting.service';
import { LedgerEntryType } from './accounting.types';
import { MetricsService } from '../monitoring/metrics.service';

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utcDayBounds(periodDate: string): { start: Date; end: Date } {
  const start = new Date(`${periodDate}T00:00:00.000Z`);
  const end = new Date(`${periodDate}T23:59:59.999Z`);
  return { start, end };
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Aggregates yesterday's (or a given UTC day) online commerce + loyalty totals
 * into daily Xero journal outbox rows. Never includes POSSale data.
 */
@Injectable()
export class DailyJournalService {
  private readonly logger = new Logger(DailyJournalService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private accounting: AccountingService,
    private metrics: MetricsService,
  ) {}

  /** Default period = previous UTC calendar day. */
  defaultPeriodDate(now = new Date()): string {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 1);
    return toDateString(d);
  }

  async redeemValuePerPoint(): Promise<number> {
    try {
      const row = await this.prisma.config.findFirst({
        where: { level: 'PLATFORM', levelId: 'PLATFORM', key: 'LOYALTY_PROGRAMME_SETTINGS' },
      });
      const v = row?.value as { defaultRedeemValue?: number } | null;
      if (v?.defaultRedeemValue != null && Number(v.defaultRedeemValue) > 0) {
        return Number(v.defaultRedeemValue);
      }
    } catch {
      /* env fallback */
    }
    const redeemRaw = this.config.get<string | number>('LOYALTY_DEFAULT_REDEEM_VALUE');
    if (redeemRaw === undefined || redeemRaw === null || redeemRaw === '') return 0.01;
    return Number(redeemRaw) || 0.01;
  }

  async enqueueForPeriod(periodDate?: string): Promise<{
    periodDate: string;
    enqueued: string[];
    skipped: string[];
  }> {
    if (!this.accounting.isEnabled()) {
      this.logger.log('Daily journal enqueue skipped — accounting disabled');
      return { periodDate: periodDate ?? this.defaultPeriodDate(), enqueued: [], skipped: ['disabled'] };
    }

    const day = periodDate ?? this.defaultPeriodDate();
    const { start, end } = utcDayBounds(day);
    const journals = this.accounting.getJournalBuilder();
    const coa = await this.accounting.getCoaMapping();
    const enqueued: string[] = [];
    const skipped: string[] = [];

    // --- Online sales (paid parent orders only; exclude pure children if parent aggregates) ---
    const paidOrders = await this.prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        parentOrderId: null,
        deletedAt: null,
        updatedAt: { gte: start, lte: end },
      },
      select: {
        total: true,
        tax: true,
        platformFeeAmount: true,
        loyaltyDiscountAmount: true,
        giftCardTransactions: {
          where: { type: 'REDEMPTION' },
          select: { amount: true },
        },
      },
    });

    let grossRevenue = 0;
    let taxAmount = 0;
    let stripeFees = 0;
    let giftCardRedeemed = 0;
    let loyaltyDiscount = 0;
    for (const o of paidOrders) {
      grossRevenue += num(o.total) - num(o.tax);
      taxAmount += num(o.tax);
      stripeFees += num(o.platformFeeAmount);
      loyaltyDiscount += num(o.loyaltyDiscountAmount);
      for (const g of o.giftCardTransactions) {
        giftCardRedeemed += num(g.amount);
      }
    }
    const netReceivable = Math.max(
      0,
      round2(grossRevenue + taxAmount - stripeFees - giftCardRedeemed - loyaltyDiscount),
    );

    if (grossRevenue > 0 || taxAmount > 0) {
      await this.accounting.enqueueBuilt(LedgerEntryType.ONLINE_SALES, day, () =>
        journals.buildOnlineSales(
          {
            periodDate: day,
            grossRevenue: round2(grossRevenue),
            taxAmount: round2(taxAmount),
            stripeFees: round2(stripeFees),
            giftCardRedeemed: round2(giftCardRedeemed),
            loyaltyDiscount: round2(loyaltyDiscount),
            netReceivable,
          },
          coa,
        ),
      );
      enqueued.push(LedgerEntryType.ONLINE_SALES);
    } else {
      skipped.push(LedgerEntryType.ONLINE_SALES);
    }

    // --- Refunds ---
    const refundPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.REFUNDED,
        updatedAt: { gte: start, lte: end },
        refundAmount: { gt: 0 },
      },
      select: { refundAmount: true, order: { select: { tax: true, total: true } } },
    });
    let refundTotal = 0;
    let taxReversed = 0;
    for (const p of refundPayments) {
      const refund = num(p.refundAmount);
      refundTotal += refund;
      const orderTotal = num(p.order?.total);
      const orderTax = num(p.order?.tax);
      if (orderTotal > 0 && orderTax > 0) {
        taxReversed += (refund / orderTotal) * orderTax;
      }
    }
    if (refundTotal > 0) {
      await this.accounting.enqueueBuilt(LedgerEntryType.REFUNDS, day, () =>
        journals.buildRefunds(
          {
            periodDate: day,
            refundTotal: round2(refundTotal),
            taxReversed: round2(taxReversed),
          },
          coa,
        ),
      );
      enqueued.push(LedgerEntryType.REFUNDS);
    } else {
      skipped.push(LedgerEntryType.REFUNDS);
    }

    // --- Points liability ---
    const redeemValue = await this.redeemValuePerPoint();
    const [earnAgg, burnAgg, expireAgg] = await Promise.all([
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: LoyaltyTxType.EARN, createdAt: { gte: start, lte: end } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: LoyaltyTxType.BURN, createdAt: { gte: start, lte: end } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: LoyaltyTxType.EXPIRE, createdAt: { gte: start, lte: end } },
        _sum: { points: true },
      }),
    ]);
    const pointsEarnedValue = round2(Math.abs(num(earnAgg._sum.points)) * redeemValue);
    const pointsBurnedValue = round2(Math.abs(num(burnAgg._sum.points)) * redeemValue);
    const breakageRecognised = round2(Math.abs(num(expireAgg._sum.points)) * redeemValue);

    if (pointsEarnedValue > 0 || pointsBurnedValue > 0 || breakageRecognised > 0) {
      await this.accounting.enqueueBuilt(LedgerEntryType.POINTS_LIABILITY, day, () =>
        journals.buildPointsLiability(
          {
            periodDate: day,
            pointsEarnedValue,
            pointsBurnedValue,
            breakageRecognised,
          },
          coa,
        ),
      );
      enqueued.push(LedgerEntryType.POINTS_LIABILITY);
    } else {
      skipped.push(LedgerEntryType.POINTS_LIABILITY);
    }

    // --- GC bridge reclass (POS vouchers issued) ---
    const voucherAgg = await this.prisma.loyaltyPosVoucher.aggregate({
      where: {
        status: 'ISSUED',
        issuedAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
    });
    const reclassAmount = round2(num(voucherAgg._sum.amount));
    if (reclassAmount > 0) {
      await this.accounting.enqueueBuilt(LedgerEntryType.GC_BRIDGE_RECLASS, day, () =>
        journals.buildGcBridgeReclass({ periodDate: day, reclassAmount }, coa),
      );
      enqueued.push(LedgerEntryType.GC_BRIDGE_RECLASS);
    } else {
      skipped.push(LedgerEntryType.GC_BRIDGE_RECLASS);
    }

    // --- HOS gift cards ---
    const [issuedGc, redeemedGc, expiredGc] = await Promise.all([
      this.prisma.giftCardTransaction.aggregate({
        where: { type: 'PURCHASE', createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.giftCardTransaction.aggregate({
        where: { type: 'REDEMPTION', createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.giftCard.aggregate({
        where: {
          status: 'EXPIRED',
          updatedAt: { gte: start, lte: end },
        },
        _sum: { balance: true },
      }),
    ]);
    const issuedAmount = round2(num(issuedGc._sum.amount));
    const redeemedAmount = round2(num(redeemedGc._sum.amount));
    const expiredAmount = round2(num(expiredGc._sum.balance));

    if (issuedAmount > 0 || redeemedAmount > 0 || expiredAmount > 0) {
      await this.accounting.enqueueBuilt(LedgerEntryType.HOS_GIFT_CARDS, day, () =>
        journals.buildHosGiftCards(
          {
            periodDate: day,
            issuedAmount,
            redeemedAmount,
            expiredAmount,
          },
          coa,
        ),
      );
      enqueued.push(LedgerEntryType.HOS_GIFT_CARDS);
    } else {
      skipped.push(LedgerEntryType.HOS_GIFT_CARDS);
    }

    this.metrics.incrementCounter('xero_daily_journals_enqueued_total', enqueued.length);
    this.logger.log(
      `Daily journals for ${day}: enqueued=[${enqueued.join(',')}] skipped=[${skipped.join(',')}]`,
    );
    return { periodDate: day, enqueued, skipped };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
