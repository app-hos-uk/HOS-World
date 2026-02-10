import { Injectable, NotFoundException } from '@nestjs/common';
import { InfluencerPrismaService } from '../database/prisma.service';

@Injectable()
export class CampaignsService {
  constructor(private prisma: InfluencerPrismaService) {}

  async create(influencerId: string, data: { name: string; description?: string; startDate?: string; endDate?: string; budget?: number }) {
    return this.prisma.influencerCampaign.create({
      data: { influencerId, name: data.name, description: data.description, startDate: data.startDate ? new Date(data.startDate) : undefined, endDate: data.endDate ? new Date(data.endDate) : undefined, budget: data.budget, status: 'DRAFT' },
    });
  }

  async findAll(influencerId?: string, status?: string) {
    const where: any = {};
    if (influencerId) where.influencerId = influencerId;
    if (status) where.status = status;
    return this.prisma.influencerCampaign.findMany({ where, orderBy: { createdAt: 'desc' }, include: { influencer: true } });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.influencerCampaign.findUnique({ where: { id }, include: { influencer: true } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.influencerCampaign.update({ where: { id }, data });
  }
}
