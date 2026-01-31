import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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
        status: 'ACTIVE',
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
      overrideCommissionRate?: number;
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

    return this.prisma.influencerCampaign.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        overrideCommissionRate: data.overrideCommissionRate,
        productIds: data.productIds,
        categoryIds: data.categoryIds,
        status: data.status as any,
      },
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
