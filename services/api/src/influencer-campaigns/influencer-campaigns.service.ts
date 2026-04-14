import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InfluencerCampaignsService {
  private readonly logger = new Logger(InfluencerCampaignsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get campaigns for influencer
   */
  async findByInfluencer(
    userId: string,
    options?: { page?: number; limit?: number; status?: string },
  ) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const { page = 1, limit = 20, status } = options || {};

    const where: any = { influencerId: influencer.id };
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      this.prisma.influencerCampaign.findMany({
        where,
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerCampaign.count({ where }),
    ]);

    return {
      data: campaigns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List all campaigns (admin)
   */
  async findAll(options?: {
    page?: number;
    limit?: number;
    status?: string;
    influencerId?: string;
  }) {
    const { page = 1, limit = 20, status, influencerId } = options || {};

    const where: any = {};
    if (status) where.status = status;
    if (influencerId) where.influencerId = influencerId;

    const [campaigns, total] = await Promise.all([
      this.prisma.influencerCampaign.findMany({
        where,
        include: {
          influencer: {
            select: { id: true, displayName: true, referralCode: true },
          },
        },
        orderBy: { startDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerCampaign.count({ where }),
    ]);

    return {
      data: campaigns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

   /**
   * Aggregated analytics for a campaign (referrals, commissions, time series, top products).
   */
  async getAnalytics(campaignId: string) {
    const campaign = await this.prisma.influencerCampaign.findUnique({
      where: { id: campaignId },
      include: {
        influencer: { select: { id: true, displayName: true, referralCode: true } },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const convertedReferrals = await this.prisma.referral.findMany({
      where: {
        campaignId,
        convertedAt: { not: null },
      },
      select: {
        id: true,
        convertedAt: true,
        orderTotal: true,
        orderId: true,
      },
    });

    const commissions = await this.prisma.influencerCommission.findMany({
      where: {
        referral: { campaignId },
      },
      select: {
        id: true,
        amount: true,
        status: true,
        orderId: true,
      },
    });

    const totalCommission = commissions.reduce(
      (s, c) => s.plus(new Decimal(c.amount.toString())),
      new Decimal(0),
    );

    const clicksOnly = await this.prisma.referral.count({
      where: { campaignId, convertedAt: null },
    });

    const byDayMap = new Map<string, { conversions: number; sales: number }>();
    for (const r of convertedReferrals) {
      if (!r.convertedAt) continue;
      const day = r.convertedAt.toISOString().slice(0, 10);
      const cur = byDayMap.get(day) || { conversions: 0, sales: 0 };
      cur.conversions += 1;
      cur.sales += Number(r.orderTotal ?? 0);
      byDayMap.set(day, cur);
    }

    const timeSeries = [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        conversions: v.conversions,
        sales: v.sales,
      }));

    const orderIds = [
      ...new Set(convertedReferrals.map((r) => r.orderId).filter(Boolean) as string[]),
    ];
    const productAgg = new Map<string, { name: string; revenue: number; units: number }>();

    if (orderIds.length > 0) {
      const items = await this.prisma.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        include: {
          product: { select: { id: true, name: true } },
        },
      });
      for (const it of items) {
        if (!it.product) continue;
        const cur = productAgg.get(it.product.id) || {
          name: it.product.name,
          revenue: 0,
          units: 0,
        };
        cur.revenue += Number(it.price) * it.quantity;
        cur.units += it.quantity;
        productAgg.set(it.product.id, cur);
      }
    }

    const topProducts = [...productAgg.entries()]
      .map(([productId, v]) => ({
        productId,
        name: v.name,
        revenue: v.revenue,
        units: v.units,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const totalSalesFromReferrals = convertedReferrals.reduce(
      (s, r) => s + Number(r.orderTotal ?? 0),
      0,
    );

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        influencer: campaign.influencer,
        totalClicks: campaign.totalClicks,
        totalConversions: campaign.totalConversions,
        totalSales: Number(campaign.totalSales),
      },
      summary: {
        conversions: convertedReferrals.length,
        clickOnlyReferrals: clicksOnly,
        totalSalesAttributed: totalSalesFromReferrals,
        totalCommissionPending: commissions
          .filter((c) => c.status === 'PENDING')
          .reduce((s, c) => s + Number(c.amount), 0),
        totalCommissionApproved: commissions
          .filter((c) => c.status === 'APPROVED' || c.status === 'PAID')
          .reduce((s, c) => s + Number(c.amount), 0),
        totalCommissionAll: Number(totalCommission),
      },
      timeSeries,
      topProducts,
      commissions: commissions.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        status: c.status,
        orderId: c.orderId,
      })),
    };
  }

  /**
   * Get campaign by ID
   */
  async findOne(id: string) {
    const campaign = await this.prisma.influencerCampaign.findUnique({
      where: { id },
      include: {
        influencer: {
          select: { id: true, displayName: true, referralCode: true },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  /**
   * Create campaign (admin)
   */
  async create(data: {
    influencerId: string;
    name: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    overrideCommissionRate?: number;
    productIds?: string[];
    categoryIds?: string[];
    status?: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  }) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id: data.influencerId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer not found');
    }

    return this.prisma.influencerCampaign.create({
      data: {
        influencerId: data.influencerId,
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        overrideCommissionRate: data.overrideCommissionRate,
        productIds: data.productIds || [],
        categoryIds: data.categoryIds || [],
        status: (data.status || 'ACTIVE') as any,
      },
      include: {
        influencer: {
          select: { displayName: true, referralCode: true },
        },
      },
    });
  }

  /**
   * Update campaign (admin)
   */
  async update(
    id: string,
    data: {
      name?: string;
      description?: string;
      startDate?: Date;
      endDate?: Date;
      /** Pass `null` to clear override and fall back to influencer default / rules */
      overrideCommissionRate?: number | null;
      productIds?: string[];
      categoryIds?: string[];
      status?: string;
    },
  ) {
    const campaign = await this.prisma.influencerCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.startDate !== undefined) patch.startDate = data.startDate;
    if (data.endDate !== undefined) patch.endDate = data.endDate;
    if (data.overrideCommissionRate !== undefined) {
      patch.overrideCommissionRate = data.overrideCommissionRate;
    }
    if (data.productIds !== undefined) patch.productIds = data.productIds;
    if (data.categoryIds !== undefined) patch.categoryIds = data.categoryIds;
    if (data.status !== undefined) patch.status = data.status;

    return this.prisma.influencerCampaign.update({
      where: { id },
      data: patch as any,
      include: {
        influencer: {
          select: { displayName: true, referralCode: true },
        },
      },
    });
  }

  /**
   * Delete campaign (admin)
   */
  async delete(id: string) {
    const campaign = await this.prisma.influencerCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    await this.prisma.influencerCampaign.delete({
      where: { id },
    });

    return { message: 'Campaign deleted successfully' };
  }
}
