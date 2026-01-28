import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Track a referral click/visit
   */
  async track(dto: {
    referralCode: string;
    visitorId?: string;
    landingPage?: string;
    productId?: string;
    campaignId?: string;
    utmParams?: Record<string, string>;
  }) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { referralCode: dto.referralCode },
    });

    if (!influencer || influencer.status !== 'ACTIVE') {
      return null; // Silent fail for invalid codes
    }

    // Calculate expiry based on cookie duration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + influencer.cookieDuration);

    // Create or update referral record
    const referral = await this.prisma.referral.create({
      data: {
        influencerId: influencer.id,
        visitorId: dto.visitorId,
        landingPage: dto.landingPage,
        productId: dto.productId,
        campaignId: dto.campaignId,
        utmParams: dto.utmParams,
        expiresAt,
      },
    });

    // Increment click counter
    await this.prisma.influencer.update({
      where: { id: influencer.id },
      data: { totalClicks: { increment: 1 } },
    });

    this.logger.log(`Referral tracked for influencer ${influencer.id}`);

    return {
      referralId: referral.id,
      expiresAt,
      cookieDuration: influencer.cookieDuration,
    };
  }

  /**
   * Get referrals for an influencer
   */
  async findByInfluencer(userId: string, options?: { page?: number; limit?: number; converted?: boolean }) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
    });

    if (!influencer) {
      throw new NotFoundException('Influencer profile not found');
    }

    const { page = 1, limit = 20, converted } = options || {};

    const where: any = { influencerId: influencer.id };
    if (converted !== undefined) {
      where.convertedAt = converted ? { not: null } : null;
    }

    const [referrals, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        include: {
          order: {
            select: { id: true, orderNumber: true, total: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.referral.count({ where }),
    ]);

    return {
      data: referrals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find active referral by visitor ID (for order attribution)
   */
  async findActiveByVisitorId(visitorId: string) {
    const now = new Date();
    
    return this.prisma.referral.findFirst({
      where: {
        visitorId,
        expiresAt: { gte: now },
        convertedAt: null, // Not yet converted
      },
      include: {
        influencer: true,
      },
      orderBy: { createdAt: 'desc' }, // Most recent
    });
  }

  /**
   * Mark referral as converted
   */
  async markConverted(referralId: string, orderId: string, orderTotal: number) {
    const referral = await this.prisma.referral.findUnique({
      where: { id: referralId },
      include: { influencer: true },
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    await this.prisma.referral.update({
      where: { id: referralId },
      data: {
        orderId,
        orderTotal,
        convertedAt: new Date(),
      },
    });

    // Increment conversion counter
    await this.prisma.influencer.update({
      where: { id: referral.influencerId },
      data: { totalConversions: { increment: 1 } },
    });

    return referral;
  }
}
