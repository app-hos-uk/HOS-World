import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InfluencerPrismaService } from '../database/prisma.service';

@Injectable()
export class InfluencersService {
  private readonly logger = new Logger(InfluencersService.name);

  constructor(private prisma: InfluencerPrismaService) {}

  async findByUserId(userId: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { userId },
      include: { storefront: true, productLinks: true, campaigns: { take: 5, orderBy: { createdAt: 'desc' } } },
    });
    if (!influencer) throw new NotFoundException('Influencer profile not found');
    return influencer;
  }

  async findAll(activeOnly = true) {
    return this.prisma.influencer.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: { storefront: true },
      orderBy: { totalEarnings: 'desc' },
    });
  }

  async findById(id: string) {
    const influencer = await this.prisma.influencer.findUnique({
      where: { id },
      include: { storefront: true, productLinks: true },
    });
    if (!influencer) throw new NotFoundException('Influencer not found');
    return influencer;
  }

  async update(userId: string, data: any) {
    const influencer = await this.prisma.influencer.findUnique({ where: { userId } });
    if (!influencer) throw new NotFoundException('Influencer not found');
    return this.prisma.influencer.update({ where: { userId }, data });
  }

  async createProductLink(influencerId: string, productId: string) {
    const shortCode = `inf_${Math.random().toString(36).substring(2, 10)}`;
    return this.prisma.influencerProductLink.create({
      data: { influencerId, productId, shortCode },
    });
  }

  async getProductLinks(influencerId: string) {
    return this.prisma.influencerProductLink.findMany({
      where: { influencerId },
      orderBy: { clicks: 'desc' },
    });
  }

  async getCommissions(influencerId: string, status?: string) {
    return this.prisma.influencerCommission.findMany({
      where: { influencerId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayouts(influencerId: string) {
    return this.prisma.influencerPayout.findMany({
      where: { influencerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
