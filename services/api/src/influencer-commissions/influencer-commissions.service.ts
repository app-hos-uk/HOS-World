import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InfluencerCommissionsService {
  private readonly logger = new Logger(InfluencerCommissionsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Calculate commission rate based on priority: Campaign > Category > Base
   */
  async calculateCommissionRate(
    influencer: any,
    order: any,
    items: any[],
  ): Promise<{ rate: Decimal; source: string }> {
    const now = new Date();

    // Check for active campaign
    const activeCampaign = await this.prisma.influencerCampaign.findFirst({
      where: {
        influencerId: influencer.id,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (activeCampaign?.overrideCommissionRate) {
      return {
        rate: activeCampaign.overrideCommissionRate,
        source: 'CAMPAIGN',
      };
    }

    // Check for category-specific rate (use highest if multiple categories)
    if (influencer.categoryCommissions && items.length > 0) {
      const categoryRates = influencer.categoryCommissions as Record<string, number>;
      let highestCategoryRate = 0;

      for (const item of items) {
        const categoryId = item.product?.categoryId;
        if (categoryId && categoryRates[categoryId]) {
          highestCategoryRate = Math.max(highestCategoryRate, categoryRates[categoryId]);
        }
      }

      if (highestCategoryRate > 0) {
        return {
          rate: new Decimal(highestCategoryRate),
          source: 'CATEGORY',
        };
      }
    }

    // Default to base rate
    return {
      rate: influencer.baseCommissionRate,
      source: 'BASE',
    };
  }

  /**
   * Create commission for an order
   */
  async create(data: {
    influencerId: string;
    referralId: string;
    orderId: string;
    orderTotal: Decimal;
    rateSource: string;
    rateApplied: Decimal;
    amount: Decimal;
    currency?: string;
  }) {
    const commission = await this.prisma.influencerCommission.create({
      data: {
        influencerId: data.influencerId,
        referralId: data.referralId,
        orderId: data.orderId,
        orderTotal: data.orderTotal,
        rateSource: data.rateSource,
        rateApplied: data.rateApplied,
        amount: data.amount,
        currency: data.currency || 'GBP',
        status: 'PENDING',
      },
    });

    // Update influencer total commission
    await this.prisma.influencer.update({
      where: { id: data.influencerId },
      data: {
        totalCommission: { increment: data.amount.toNumber() },
        totalSalesAmount: { increment: data.orderTotal.toNumber() },
      },
    });

    return commission;
  }

  /**
   * Get commissions for influencer
   */
  async findByInfluencer(userId: string, options?: { page?: number; limit?: number; status?: string }) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const { page = 1, limit = 20, status } = options || {};

    const where: any = { influencerId: influencer.id };
    if (status) where.status = status;

    const [commissions, total] = await Promise.all([
      this.prisma.influencerCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerCommission.count({ where }),
    ]);

    return {
      data: commissions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get earnings summary for influencer
   */
  async getEarningsSummary(userId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const commissions = await this.prisma.influencerCommission.findMany({
      where: { influencerId: influencer.id },
    });

    const pending = commissions.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + Number(c.amount), 0);
    const approved = commissions.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + Number(c.amount), 0);
    const paid = commissions.filter(c => c.status === 'PAID').reduce((sum, c) => sum + Number(c.amount), 0);
    const cancelled = commissions.filter(c => c.status === 'CANCELLED').reduce((sum, c) => sum + Number(c.amount), 0);

    return {
      pending,
      approved,
      paid,
      cancelled,
      total: pending + approved + paid,
      available: approved, // Ready to be paid
    };
  }

  /**
   * List all commissions (admin)
   */
  async findAll(options?: { page?: number; limit?: number; status?: string; influencerId?: string }) {
    const { page = 1, limit = 20, status, influencerId } = options || {};

    const where: any = {};
    if (status) where.status = status;
    if (influencerId) where.influencerId = influencerId;

    const [commissions, total] = await Promise.all([
      this.prisma.influencerCommission.findMany({
        where,
        include: {
          influencer: {
            select: { id: true, displayName: true, referralCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.influencerCommission.count({ where }),
    ]);

    return {
      data: commissions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update commission status (admin)
   */
  async updateStatus(id: string, status: string, notes?: string) {
    const commission = await this.prisma.influencerCommission.findUnique({
      where: { id },
    });

    if (!commission) {
      throw new NotFoundException('Commission not found');
    }

    return this.prisma.influencerCommission.update({
      where: { id },
      data: {
        status: status as any,
        notes: notes || commission.notes,
      },
    });
  }

  /**
   * Approve commission (admin)
   */
  async approve(id: string) {
    return this.updateStatus(id, 'APPROVED');
  }
}
