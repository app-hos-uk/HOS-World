import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { computeClv } from './engines/clv.engine';
import { computeRoi } from './engines/attribution.engine';

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}
function monthsAgo(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}
function monthsBetween(a: Date, b: Date): number {
  return Math.max(1, (b.getTime() - a.getTime()) / (30.44 * 86_400_000));
}
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86_400_000));
}
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Injectable()
export class LoyaltyAnalyticsService {
  private readonly logger = new Logger(LoyaltyAnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // ── Daily Snapshot ──

  async computeDailySnapshot(date?: Date): Promise<unknown> {
    const target = date ? startOfDay(date) : startOfDay(daysAgo(1));
    const dayEnd = endOfDay(target);
    const now = new Date();
    const thirtyAgo = daysAgo(30);

    const [
      totalMembers,
      activeMembers30d,
      newEnrollments,
      earnAgg,
      burnAgg,
      expireAgg,
      liabilityAgg,
      brandAgg,
      campaignAgg,
      webTxs,
      posTxs,
      tiers,
    ] = await Promise.all([
      this.prisma.loyaltyMembership.count(),
      this.prisma.loyaltyMembership.count({ where: { lastActivityAt: { gte: thirtyAgo } } }),
      this.prisma.loyaltyMembership.count({
        where: { enrolledAt: { gte: target, lte: dayEnd } },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EARN', createdAt: { gte: target, lte: dayEnd } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'BURN', createdAt: { gte: target, lte: dayEnd } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EXPIRE', createdAt: { gte: target, lte: dayEnd } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyMembership.aggregate({ _sum: { currentBalance: true } }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { source: 'BRAND_CAMPAIGN', createdAt: { gte: target, lte: dayEnd } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { campaignId: { not: null }, createdAt: { gte: target, lte: dayEnd } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EARN', channel: 'WEB', createdAt: { gte: target, lte: dayEnd } },
        _sum: { points: true },
        _count: true,
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EARN', channel: 'HOS_OUTLET_POS', createdAt: { gte: target, lte: dayEnd } },
        _sum: { points: true },
        _count: true,
      }),
      this.prisma.loyaltyTier.findMany({
        where: { isActive: true },
        include: { _count: { select: { members: true } } },
        orderBy: { level: 'asc' },
      }),
    ]);

    const memberUserIds = await this.prisma.loyaltyMembership.findMany({
      select: { userId: true },
    });
    const memberSet = new Set(memberUserIds.map((m) => m.userId));

    const loyaltyOrders = await this.prisma.order.findMany({
      where: {
        parentOrderId: null,
        loyaltyPointsEarned: { gt: 0 },
        createdAt: { gte: target, lte: dayEnd },
        userId: { in: [...memberSet].slice(0, 10000) },
      },
      select: { subtotal: true },
    });

    const totalRevenueLoyalty = loyaltyOrders.reduce(
      (s, o) => s.add(new Decimal(o.subtotal)),
      new Decimal(0),
    );
    const totalOrdersLoyalty = loyaltyOrders.length;
    const avgOv = totalOrdersLoyalty > 0 ? totalRevenueLoyalty.div(totalOrdersLoyalty) : new Decimal(0);

    const topFandomsRaw = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { createdAt: { gte: target, lte: dayEnd }, parentOrderId: null } },
      _sum: { quantity: true },
    });

    const tierDistribution = tiers.map((t) => ({ tier: t.name, count: t._count.members }));

    const snapshot = {
      date: target,
      totalMembers,
      activeMembers30d,
      newEnrollments,
      pointsIssued: earnAgg._sum.points ?? 0,
      pointsRedeemed: Math.abs(burnAgg._sum.points ?? 0),
      pointsExpired: Math.abs(expireAgg._sum.points ?? 0),
      pointsLiability: liabilityAgg._sum.currentBalance ?? 0,
      totalRevenueLoyalty,
      totalOrdersLoyalty,
      avgOrderValueLoyalty: avgOv,
      brandFundedPoints: brandAgg._sum.points ?? 0,
      campaignPointsIssued: campaignAgg._sum.points ?? 0,
      webOrders: webTxs._count ?? 0,
      posOrders: posTxs._count ?? 0,
      webRevenue: new Decimal(webTxs._sum.points ?? 0),
      posRevenue: new Decimal(posTxs._sum.points ?? 0),
      tierDistribution: tierDistribution as unknown as Prisma.InputJsonValue,
      topFandoms: [] as unknown as Prisma.InputJsonValue,
    };

    return this.prisma.loyaltyAnalyticsSnapshot.upsert({
      where: { date: target },
      create: snapshot,
      update: snapshot,
    });
  }

  async getSnapshotTimeline(startDate: Date, endDate: Date): Promise<unknown[]> {
    return this.prisma.loyaltyAnalyticsSnapshot.findMany({
      where: { date: { gte: startOfDay(startDate), lte: endOfDay(endDate) } },
      orderBy: { date: 'asc' },
    });
  }

  // ── CLV ──

  async computeClvForMember(membershipId: string): Promise<{ clvScore: number; churnRisk: number }> {
    const m = await this.prisma.loyaltyMembership.findUnique({
      where: { id: membershipId },
      include: { tier: true },
    });
    if (!m) return { clvScore: 0, churnRisk: 1 };

    const orders = await this.prisma.order.findMany({
      where: { userId: m.userId, parentOrderId: null, status: { not: 'CANCELLED' } },
      select: { subtotal: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const totalOrders = orders.length;
    const totalSpend = orders.reduce((s, o) => s + new Decimal(o.subtotal).toNumber(), 0);
    const avgOrderValue = totalOrders > 0 ? totalSpend / totalOrders : 0;
    const lastPurchaseAt = orders[0]?.createdAt ?? null;
    const firstPurchaseAt = orders.length > 0 ? orders[orders.length - 1].createdAt : null;
    const daysSinceLastPurchase = lastPurchaseAt ? daysBetween(lastPurchaseAt, new Date()) : 999;
    const monthsSinceEnrollment = monthsBetween(m.enrolledAt, new Date());
    const frequency = totalOrders / Math.max(1, monthsSinceEnrollment);

    const result = computeClv({
      daysSinceLastPurchase,
      totalOrders,
      monthsSinceEnrollment,
      avgOrderValue,
      totalSpend,
      tierLevel: m.tier?.level ?? 1,
      tierMultiplier: m.tier?.multiplier ? new Decimal(m.tier.multiplier).toNumber() : 1,
      engagementCount: m.engagementCount,
    });

    await this.prisma.loyaltyMembership.update({
      where: { id: membershipId },
      data: {
        clvScore: new Decimal(result.clvScore),
        predictedChurnRisk: new Decimal(result.churnRisk),
        clvUpdatedAt: new Date(),
        firstPurchaseAt: firstPurchaseAt ?? undefined,
        lastPurchaseAt: lastPurchaseAt ?? undefined,
        avgOrderValue: new Decimal(avgOrderValue),
        purchaseFrequency: new Decimal(Math.round(frequency * 10000) / 10000),
      },
    });

    return result;
  }

  async recomputeAllClv(batchSize?: number): Promise<{ computed: number; errors: number }> {
    const size = batchSize ?? parseInt(this.config.get('LOYALTY_CLV_BATCH_SIZE', '200'), 10);
    let computed = 0;
    let errors = 0;
    let skip = 0;

    for (;;) {
      const batch = await this.prisma.loyaltyMembership.findMany({
        select: { id: true },
        skip,
        take: size,
        orderBy: { enrolledAt: 'asc' },
      });
      if (!batch.length) break;

      for (const m of batch) {
        try {
          await this.computeClvForMember(m.id);
          computed++;
        } catch {
          errors++;
        }
      }
      skip += size;
    }
    return { computed, errors };
  }

  async getClvDistribution(): Promise<Array<{ bucket: string; count: number; avgClv: number }>> {
    const buckets = [
      { label: '£0–50', min: 0, max: 50 },
      { label: '£50–200', min: 50, max: 200 },
      { label: '£200–500', min: 200, max: 500 },
      { label: '£500+', min: 500, max: 999999 },
    ];

    const result: Array<{ bucket: string; count: number; avgClv: number }> = [];
    for (const b of buckets) {
      const agg = await this.prisma.loyaltyMembership.aggregate({
        where: { clvScore: { gte: b.min, lt: b.max } },
        _count: true,
        _avg: { clvScore: true },
      });
      result.push({
        bucket: b.label,
        count: agg._count,
        avgClv: agg._avg.clvScore ? new Decimal(agg._avg.clvScore).toNumber() : 0,
      });
    }
    return result;
  }

  async getTopMembersByClv(limit = 20): Promise<unknown[]> {
    const rows = await this.prisma.loyaltyMembership.findMany({
      where: { clvScore: { not: null } },
      orderBy: { clvScore: 'desc' },
      take: Math.min(100, limit),
      include: { tier: { select: { name: true } }, user: { select: { firstName: true, lastName: true, email: true } } },
    });
    return rows.map((r) => ({
      membershipId: r.id,
      userId: r.userId,
      name: [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ') || r.user?.email || r.userId,
      clvScore: r.clvScore ? new Decimal(r.clvScore).toNumber() : 0,
      tier: r.tier?.name ?? 'Unknown',
      totalSpend: new Decimal(r.totalSpend).toNumber(),
      purchaseCount: r.purchaseCount,
    }));
  }

  async getChurnRiskReport(): Promise<unknown> {
    const [atRisk, healthy, churned] = await Promise.all([
      this.prisma.loyaltyMembership.count({ where: { predictedChurnRisk: { gte: 0.5, lt: 0.9 } } }),
      this.prisma.loyaltyMembership.count({ where: { predictedChurnRisk: { lt: 0.5 } } }),
      this.prisma.loyaltyMembership.count({ where: { predictedChurnRisk: { gte: 0.9 } } }),
    ]);

    const atRiskMembers = await this.prisma.loyaltyMembership.findMany({
      where: { predictedChurnRisk: { gte: 0.5 } },
      orderBy: { predictedChurnRisk: 'desc' },
      take: 30,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });

    return {
      atRisk,
      healthy,
      churned,
      atRiskMembers: atRiskMembers.map((m) => ({
        userId: m.userId,
        name: [m.user?.firstName, m.user?.lastName].filter(Boolean).join(' ') || m.user?.email,
        lastPurchase: m.lastPurchaseAt?.toISOString() ?? null,
        churnRisk: m.predictedChurnRisk ? new Decimal(m.predictedChurnRisk).toNumber() : 0,
      })),
    };
  }

  // ── Campaign Attribution ──

  async computeAttributionForDate(date?: Date): Promise<number> {
    const target = date ? startOfDay(date) : startOfDay(daysAgo(1));
    const dayEnd = endOfDay(target);
    const redeemValue = Number(this.config.get('LOYALTY_DEFAULT_REDEEM_VALUE', 0.01));

    const txs = await this.prisma.loyaltyTransaction.findMany({
      where: { campaignId: { not: null }, createdAt: { gte: target, lte: dayEnd } },
      select: { campaignId: true, points: true, sourceId: true, source: true, membership: { select: { userId: true } } },
    });

    const grouped = new Map<string, { points: number; orderIds: Set<string>; userIds: Set<string>; source: string }>();
    for (const tx of txs) {
      if (!tx.campaignId) continue;
      const g = grouped.get(tx.campaignId) ?? { points: 0, orderIds: new Set(), userIds: new Set(), source: tx.source };
      g.points += Math.abs(tx.points);
      if (tx.sourceId) g.orderIds.add(tx.sourceId);
      g.userIds.add(tx.membership.userId);
      grouped.set(tx.campaignId, g);
    }

    let count = 0;
    for (const [campaignId, g] of grouped) {
      let campaignName = '';
      let campaignType = 'INTERNAL';

      const brand = await this.prisma.brandCampaign.findUnique({
        where: { id: campaignId },
        select: { name: true },
      });
      if (brand) {
        campaignName = brand.name;
        campaignType = 'BRAND';
      } else {
        const internal = await this.prisma.loyaltyBonusCampaign.findUnique({
          where: { id: campaignId },
          select: { name: true },
        });
        campaignName = internal?.name ?? 'Unknown';
      }

      let revenueInfluenced = new Decimal(0);
      if (g.orderIds.size) {
        const orders = await this.prisma.order.findMany({
          where: { id: { in: [...g.orderIds] }, parentOrderId: null },
          select: { subtotal: true },
        });
        for (const o of orders) {
          revenueInfluenced = revenueInfluenced.add(new Decimal(o.subtotal));
        }
      }

      const roi = computeRoi(g.points, revenueInfluenced.toNumber(), redeemValue);

      await this.prisma.campaignAttribution.upsert({
        where: { campaignId_date: { campaignId, date: target } },
        create: {
          campaignId,
          campaignType,
          campaignName,
          date: target,
          ordersInfluenced: g.orderIds.size,
          revenueInfluenced,
          pointsAwarded: g.points,
          pointsCost: new Decimal(g.points * redeemValue),
          uniqueUsers: g.userIds.size,
          roi: new Decimal(roi),
        },
        update: {
          ordersInfluenced: g.orderIds.size,
          revenueInfluenced,
          pointsAwarded: g.points,
          pointsCost: new Decimal(g.points * redeemValue),
          uniqueUsers: g.userIds.size,
          roi: new Decimal(roi),
        },
      });
      count++;
    }
    return count;
  }

  async getCampaignAttributionReport(filters: {
    startDate?: Date; endDate?: Date; campaignType?: string; limit?: number;
  }): Promise<unknown> {
    const where: Prisma.CampaignAttributionWhereInput = {};
    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = startOfDay(filters.startDate);
      if (filters.endDate) where.date.lte = endOfDay(filters.endDate);
    }
    if (filters.campaignType) where.campaignType = filters.campaignType;

    const rows = await this.prisma.campaignAttribution.findMany({
      where,
      orderBy: { revenueInfluenced: 'desc' },
      take: Math.min(100, filters.limit ?? 50),
    });

    const byCampaign = new Map<string, {
      campaignId: string; campaignName: string; campaignType: string;
      totalOrders: number; totalRevenue: number; totalPoints: number; totalCost: number;
    }>();
    for (const r of rows) {
      const key = r.campaignId;
      const cur = byCampaign.get(key) ?? {
        campaignId: r.campaignId, campaignName: r.campaignName, campaignType: r.campaignType,
        totalOrders: 0, totalRevenue: 0, totalPoints: 0, totalCost: 0,
      };
      cur.totalOrders += r.ordersInfluenced;
      cur.totalRevenue += new Decimal(r.revenueInfluenced).toNumber();
      cur.totalPoints += r.pointsAwarded;
      cur.totalCost += new Decimal(r.pointsCost).toNumber();
      byCampaign.set(key, cur);
    }

    const campaigns = [...byCampaign.values()].map((c) => ({
      ...c,
      roi: c.totalCost > 0 ? Math.round(((c.totalRevenue - c.totalCost) / c.totalCost) * 10000) / 10000 : 0,
    }));

    const totals = campaigns.reduce(
      (acc, c) => ({
        orders: acc.orders + c.totalOrders,
        revenue: acc.revenue + c.totalRevenue,
        points: acc.points + c.totalPoints,
        cost: acc.cost + c.totalCost,
      }),
      { orders: 0, revenue: 0, points: 0, cost: 0 },
    );

    return {
      campaigns,
      totals: {
        ...totals,
        avgRoi: totals.cost > 0 ? Math.round(((totals.revenue - totals.cost) / totals.cost) * 10000) / 10000 : 0,
      },
    };
  }

  async getCampaignRoiTimeline(campaignId: string, days = 30): Promise<unknown[]> {
    const since = startOfDay(daysAgo(days));
    const rows = await this.prisma.campaignAttribution.findMany({
      where: { campaignId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      orders: r.ordersInfluenced,
      revenue: new Decimal(r.revenueInfluenced).toNumber(),
      points: r.pointsAwarded,
      roi: r.roi ? new Decimal(r.roi).toNumber() : 0,
    }));
  }

  // ── Fandom Trends ──

  async getFandomTrends(days = 30): Promise<unknown[]> {
    const since = daysAgo(days);
    const priorStart = daysAgo(days * 2);

    const items = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: since }, parentOrderId: null } },
      select: { quantity: true, price: true, product: { select: { fandom: true, name: true } } },
    });

    const priorItems = await this.prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: priorStart, lt: since }, parentOrderId: null } },
      select: { quantity: true, price: true, product: { select: { fandom: true } } },
    });

    const cur = new Map<string, { revenue: number; orders: number; products: Map<string, number> }>();
    for (const it of items) {
      const f = it.product?.fandom;
      if (!f) continue;
      const c = cur.get(f) ?? { revenue: 0, orders: 0, products: new Map() };
      const lineVal = new Decimal(it.price).mul(it.quantity).toNumber();
      c.revenue += lineVal;
      c.orders += it.quantity;
      const pn = it.product?.name ?? 'Unknown';
      c.products.set(pn, (c.products.get(pn) ?? 0) + lineVal);
      cur.set(f, c);
    }

    const prev = new Map<string, number>();
    for (const it of priorItems) {
      const f = it.product?.fandom;
      if (!f) continue;
      prev.set(f, (prev.get(f) ?? 0) + new Decimal(it.price).mul(it.quantity).toNumber());
    }

    const memberCounts = await this.prisma.loyaltyMembership.findMany({
      where: { fandomProfile: { not: null } },
      select: { fandomProfile: true },
    });
    const fandomMembers = new Map<string, number>();
    for (const m of memberCounts) {
      const fp = m.fandomProfile as Record<string, number> | null;
      if (!fp) continue;
      for (const [f, score] of Object.entries(fp)) {
        if (score > 0.1) fandomMembers.set(f, (fandomMembers.get(f) ?? 0) + 1);
      }
    }

    return [...cur.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([fandom, data]) => {
        const prevRev = prev.get(fandom) ?? 0;
        const growth = prevRev > 0 ? Math.round(((data.revenue - prevRev) / prevRev) * 10000) / 100 : 0;
        const topProducts = [...data.products.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }));
        return {
          fandom,
          members: fandomMembers.get(fandom) ?? 0,
          revenue: Math.round(data.revenue * 100) / 100,
          orders: data.orders,
          avgSpend: data.orders > 0 ? Math.round((data.revenue / data.orders) * 100) / 100 : 0,
          topProducts,
          growth,
        };
      });
  }

  // ── Programme Health ──

  async getProgrammeHealth(): Promise<unknown> {
    const now = new Date();
    const redeemValue = Number(this.config.get('LOYALTY_DEFAULT_REDEEM_VALUE', 0.01));

    const [totalMembers, active30, active90, liabilityAgg, clvAgg] = await Promise.all([
      this.prisma.loyaltyMembership.count(),
      this.prisma.loyaltyMembership.count({ where: { lastActivityAt: { gte: daysAgo(30) } } }),
      this.prisma.loyaltyMembership.count({ where: { lastActivityAt: { gte: daysAgo(90) } } }),
      this.prisma.loyaltyMembership.aggregate({ _sum: { currentBalance: true } }),
      this.prisma.loyaltyMembership.aggregate({ _avg: { clvScore: true, predictedChurnRisk: true } }),
    ]);

    const liability = liabilityAgg._sum.currentBalance ?? 0;

    const [earned30, redeemed30] = await Promise.all([
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: { in: ['EARN', 'BONUS'] }, createdAt: { gte: daysAgo(30) } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'BURN', createdAt: { gte: daysAgo(30) } },
        _sum: { points: true },
      }),
    ]);
    const issuedLast30d = earned30._sum.points ?? 0;
    const redeemedLast30d = Math.abs(redeemed30._sum.points ?? 0);

    const enrollmentMonths: Array<{ month: string; count: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const s = monthsAgo(i + 1);
      const e = monthsAgo(i);
      const count = await this.prisma.loyaltyMembership.count({
        where: { enrolledAt: { gte: s, lt: e } },
      });
      enrollmentMonths.push({ month: monthKey(s), count });
    }

    const memberUserIds = await this.prisma.loyaltyMembership.findMany({ select: { userId: true }, take: 50000 });
    const memberIdSet = new Set(memberUserIds.map((m) => m.userId));

    const allOrders30 = await this.prisma.order.findMany({
      where: { parentOrderId: null, createdAt: { gte: daysAgo(30) }, status: { not: 'CANCELLED' } },
      select: { userId: true, subtotal: true },
    });

    let memberRev = 0, memberCount = 0, nonMemberRev = 0, nonMemberCount = 0;
    for (const o of allOrders30) {
      const sub = new Decimal(o.subtotal).toNumber();
      if (o.userId && memberIdSet.has(o.userId)) { memberRev += sub; memberCount++; }
      else { nonMemberRev += sub; nonMemberCount++; }
    }
    const memberAvgOrder = memberCount > 0 ? memberRev / memberCount : 0;
    const nonMemberAvgOrder = nonMemberCount > 0 ? nonMemberRev / nonMemberCount : 0;
    const liftPercent = nonMemberAvgOrder > 0
      ? Math.round(((memberAvgOrder - nonMemberAvgOrder) / nonMemberAvgOrder) * 10000) / 100
      : 0;

    const tierChanges30 = await this.prisma.loyaltyMembership.count({
      where: { updatedAt: { gte: daysAgo(30) } },
    });

    return {
      totalMembers,
      activeLast30d: active30,
      activeLast90d: active90,
      enrollmentTrend: enrollmentMonths,
      pointsLiability: { total: liability, estimatedCost: Math.round(liability * redeemValue * 100) / 100 },
      pointsVelocity: { issuedLast30d, redeemedLast30d, netChange: issuedLast30d - redeemedLast30d },
      revenueImpact: {
        memberRevenue: Math.round(memberRev * 100) / 100,
        nonMemberRevenue: Math.round(nonMemberRev * 100) / 100,
        liftPercent,
      },
      avgClv: clvAgg._avg.clvScore ? new Decimal(clvAgg._avg.clvScore).toNumber() : 0,
      churnRate: clvAgg._avg.predictedChurnRisk ? new Decimal(clvAgg._avg.predictedChurnRisk).toNumber() : 0,
      tierMovement30d: { upgrades: tierChanges30, downgrades: 0 },
    };
  }

  // ── Tier Analysis ──

  async getTierAnalysis(): Promise<unknown[]> {
    const tiers = await this.prisma.loyaltyTier.findMany({
      where: { isActive: true },
      include: { _count: { select: { members: true } } },
      orderBy: { level: 'asc' },
    });

    const result: unknown[] = [];
    for (const t of tiers) {
      const agg = await this.prisma.loyaltyMembership.aggregate({
        where: { tierId: t.id },
        _avg: { totalSpend: true, clvScore: true, purchaseFrequency: true, predictedChurnRisk: true },
        _sum: { totalSpend: true },
      });
      result.push({
        tier: t.name,
        level: t.level,
        memberCount: t._count.members,
        avgSpend: agg._avg.totalSpend ? new Decimal(agg._avg.totalSpend).toNumber() : 0,
        avgClv: agg._avg.clvScore ? new Decimal(agg._avg.clvScore).toNumber() : 0,
        avgPurchaseFreq: agg._avg.purchaseFrequency ? new Decimal(agg._avg.purchaseFrequency).toNumber() : 0,
        churnRate: agg._avg.predictedChurnRisk ? new Decimal(agg._avg.predictedChurnRisk).toNumber() : 0,
        revenueContribution: agg._sum.totalSpend ? new Decimal(agg._sum.totalSpend).toNumber() : 0,
      });
    }
    return result;
  }

  // ── Channel Performance ──

  async getChannelPerformance(days = 30): Promise<unknown> {
    const since = daysAgo(days);

    const [webAgg, posAgg] = await Promise.all([
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EARN', channel: 'WEB', createdAt: { gte: since } },
        _sum: { points: true },
        _count: true,
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { type: 'EARN', channel: 'HOS_OUTLET_POS', createdAt: { gte: since } },
        _sum: { points: true },
        _count: true,
      }),
    ]);

    const webOrders = await this.prisma.order.aggregate({
      where: { parentOrderId: null, createdAt: { gte: since }, loyaltyPointsEarned: { gt: 0 } },
      _sum: { subtotal: true },
      _count: true,
    });

    const posOrders = await this.prisma.pOSSale.aggregate({
      where: { saleDate: { gte: since }, loyaltyPointsEarned: { gt: 0 } },
      _sum: { totalAmount: true },
      _count: true,
    });

    const webRev = webOrders._sum.subtotal ? new Decimal(webOrders._sum.subtotal).toNumber() : 0;
    const posRev = posOrders._sum.totalAmount ? new Decimal(posOrders._sum.totalAmount).toNumber() : 0;

    return {
      web: {
        orders: webOrders._count ?? 0,
        revenue: webRev,
        pointsEarned: webAgg._sum.points ?? 0,
        avgOrder: (webOrders._count ?? 0) > 0 ? Math.round((webRev / webOrders._count) * 100) / 100 : 0,
      },
      pos: {
        orders: posOrders._count ?? 0,
        revenue: posRev,
        pointsEarned: posAgg._sum.points ?? 0,
        avgOrder: (posOrders._count ?? 0) > 0 ? Math.round((posRev / posOrders._count) * 100) / 100 : 0,
      },
      trend: [],
    };
  }

  // ── Cohort Retention ──

  async getCohortRetention(months = 6): Promise<unknown[]> {
    const cohorts: Array<{ cohort: string; enrolled: number; retention: number[] }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const cohortStart = monthsAgo(i + 1);
      const cohortEnd = monthsAgo(i);
      const label = monthKey(cohortStart);

      const members = await this.prisma.loyaltyMembership.findMany({
        where: { enrolledAt: { gte: cohortStart, lt: cohortEnd } },
        select: { userId: true },
      });

      const enrolled = members.length;
      if (enrolled === 0) {
        cohorts.push({ cohort: label, enrolled: 0, retention: [] });
        continue;
      }

      const userIds = members.map((m) => m.userId);
      const retention: number[] = [];

      for (let m = 0; m <= i; m++) {
        const windowStart = monthsAgo(i - m);
        const windowEnd = monthsAgo(i - m - 1);
        const active = await this.prisma.order.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            parentOrderId: null,
            createdAt: { gte: windowStart, lt: windowEnd },
          },
        });
        retention.push(Math.round((active.length / enrolled) * 10000) / 100);
      }

      cohorts.push({ cohort: label, enrolled, retention });
    }
    return cohorts;
  }

  // ── Export ──

  async exportReport(type: string, format: string): Promise<unknown> {
    switch (type) {
      case 'clv':
        return this.getTopMembersByClv(200);
      case 'attribution':
        return this.getCampaignAttributionReport({ limit: 200 });
      case 'fandom':
        return this.getFandomTrends(90);
      case 'health':
        return this.getProgrammeHealth();
      default:
        return { error: 'Unknown report type' };
    }
  }
}
