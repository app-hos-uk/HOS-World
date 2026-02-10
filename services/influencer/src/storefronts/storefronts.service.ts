import { Injectable, NotFoundException } from '@nestjs/common';
import { InfluencerPrismaService } from '../database/prisma.service';

@Injectable()
export class StorefrontsService {
  constructor(private prisma: InfluencerPrismaService) {}

  async findBySlug(slug: string) {
    const sf = await this.prisma.influencerStorefront.findUnique({
      where: { slug },
      include: { influencer: true },
    });
    if (!sf) throw new NotFoundException('Storefront not found');
    return sf;
  }

  async findByInfluencerId(influencerId: string) {
    return this.prisma.influencerStorefront.findUnique({ where: { influencerId } });
  }

  async update(influencerId: string, data: any) {
    return this.prisma.influencerStorefront.update({ where: { influencerId }, data });
  }
}
