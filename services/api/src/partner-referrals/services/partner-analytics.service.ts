import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';

function decimalToNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  return new Decimal(value).toNumber();
}

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

@Injectable()
export class PartnerAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getPartnerReport(id: string): Promise<unknown> {
    const partner = await this.prisma.referralPartner.findUnique({
      where: { id },
      include: {
        links: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!partner) throw new NotFoundException('Partner not found');

    const [conversionAgg, byLink] = await Promise.all([
      this.prisma.partnerReferralConversion.aggregate({
        where: { partnerId: id },
        _sum: { firstOrderTotal: true, signupBonusAwarded: true },
        _count: { _all: true },
      }),
      this.prisma.partnerReferralConversion.groupBy({
        by: ['linkId'],
        where: { partnerId: id },
        _sum: { firstOrderTotal: true, signupBonusAwarded: true },
        _count: { _all: true },
      }),
    ]);

    const revenueByLink = new Map(
      byLink.map((row) => [row.linkId, decimalToNumber(row._sum.firstOrderTotal)]),
    );
    const bonusByLink = new Map(byLink.map((row) => [row.linkId, row._sum.signupBonusAwarded ?? 0]));

    const totalClicks = partner.links.reduce((sum, l) => sum + l.totalClicks, 0);
    const totalRegistrations = partner.links.reduce((sum, l) => sum + l.totalRegistrations, 0);
    const totalConversions = partner.links.reduce((sum, l) => sum + l.totalConversions, 0);

    return {
      partner: {
        id: partner.id,
        name: partner.name,
        slug: partner.slug,
        type: partner.type,
        status: partner.status,
      },
      totals: {
        clicks: totalClicks,
        registrations: totalRegistrations,
        conversions: totalConversions,
        revenue: decimalToNumber(conversionAgg._sum.firstOrderTotal),
        signupBonusAwarded: conversionAgg._sum.signupBonusAwarded ?? 0,
        conversionRecords: conversionAgg._count._all,
      },
      links: partner.links.map((link) => ({
        id: link.id,
        code: link.code,
        name: link.name,
        isActive: link.isActive,
        clicks: link.totalClicks,
        registrations: link.totalRegistrations,
        conversions: link.totalConversions,
        revenue: revenueByLink.get(link.id) ?? 0,
        signupBonusAwarded: bonusByLink.get(link.id) ?? 0,
        registrationRate: rate(link.totalRegistrations, link.totalClicks),
        conversionRate: rate(link.totalConversions, link.totalRegistrations),
      })),
    };
  }

  async getLinkReport(id: string): Promise<unknown> {
    const link = await this.prisma.referralPartnerLink.findUnique({
      where: { id },
      include: { partner: { select: { id: true, name: true, slug: true, status: true } } },
    });
    if (!link) throw new NotFoundException('Partner link not found');

    const [agg, multipliersApplied, couponsApplied] = await Promise.all([
      this.prisma.partnerReferralConversion.aggregate({
        where: { linkId: id },
        _sum: { firstOrderTotal: true, signupBonusAwarded: true },
        _count: { _all: true },
      }),
      this.prisma.partnerReferralConversion.count({
        where: { linkId: id, multiplierApplied: true },
      }),
      this.prisma.partnerReferralConversion.count({
        where: { linkId: id, couponApplied: { not: null } },
      }),
    ]);

    return {
      link: {
        id: link.id,
        code: link.code,
        name: link.name,
        isActive: link.isActive,
        expiresAt: link.expiresAt,
        signupBonusPoints: link.signupBonusPoints,
        pointsMultiplier: link.pointsMultiplier != null ? decimalToNumber(link.pointsMultiplier) : null,
        multiplierDays: link.multiplierDays,
        couponCode: link.couponCode,
      },
      partner: link.partner,
      totals: {
        clicks: link.totalClicks,
        registrations: link.totalRegistrations,
        conversions: link.totalConversions,
        revenue: decimalToNumber(agg._sum.firstOrderTotal),
      },
      rates: {
        clickToRegistration: rate(link.totalRegistrations, link.totalClicks),
        registrationToConversion: rate(link.totalConversions, link.totalRegistrations),
      },
      incentives: {
        signupBonusDistributed: agg._sum.signupBonusAwarded ?? 0,
        multipliersApplied,
        couponsApplied,
      },
    };
  }

  async getDashboard(): Promise<unknown> {
    const now = new Date();
    const [
      totalPartners,
      activePartners,
      activeLinks,
      clickAgg,
      topByRegistrations,
    ] = await Promise.all([
      this.prisma.referralPartner.count(),
      this.prisma.referralPartner.count({ where: { status: 'ACTIVE' } }),
      this.prisma.referralPartnerLink.count({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          partner: { status: 'ACTIVE' },
        },
      }),
      this.prisma.referralPartnerLink.aggregate({
        _sum: {
          totalClicks: true,
          totalRegistrations: true,
          totalConversions: true,
        },
      }),
      this.prisma.referralPartnerLink.groupBy({
        by: ['partnerId'],
        _sum: {
          totalRegistrations: true,
          totalConversions: true,
          totalClicks: true,
        },
        orderBy: { _sum: { totalRegistrations: 'desc' } },
        take: 10,
      }),
    ]);

    const partnerIds = topByRegistrations.map((row) => row.partnerId);
    const partners = partnerIds.length
      ? await this.prisma.referralPartner.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, slug: true, status: true, type: true },
        })
      : [];
    const partnerById = new Map(partners.map((p) => [p.id, p]));

    return {
      totalPartners,
      activePartners,
      activeLinks,
      totalClicks: clickAgg._sum.totalClicks ?? 0,
      totalRegistrations: clickAgg._sum.totalRegistrations ?? 0,
      totalConversions: clickAgg._sum.totalConversions ?? 0,
      topPartners: topByRegistrations.map((row) => {
        const partner = partnerById.get(row.partnerId);
        return {
          id: row.partnerId,
          name: partner?.name ?? row.partnerId,
          slug: partner?.slug ?? null,
          status: partner?.status ?? null,
          type: partner?.type ?? null,
          clicks: row._sum.totalClicks ?? 0,
          registrations: row._sum.totalRegistrations ?? 0,
          conversions: row._sum.totalConversions ?? 0,
        };
      }),
    };
  }
}
