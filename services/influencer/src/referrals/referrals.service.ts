import { Injectable, NotFoundException } from '@nestjs/common';
import { InfluencerPrismaService } from '../database/prisma.service';

@Injectable()
export class ReferralsService {
  constructor(private prisma: InfluencerPrismaService) {}

  async create(influencerId: string) {
    const referralCode = `ref_${Math.random().toString(36).substring(2, 10)}`;
    return this.prisma.referral.create({ data: { influencerId, referralCode, status: 'PENDING' } });
  }

  async findByCode(code: string) {
    const referral = await this.prisma.referral.findUnique({ where: { referralCode: code }, include: { influencer: true } });
    if (!referral) throw new NotFoundException('Referral not found');
    return referral;
  }

  async findByInfluencer(influencerId: string) {
    return this.prisma.referral.findMany({ where: { influencerId }, orderBy: { createdAt: 'desc' } });
  }

  async convert(code: string, referredUserId: string) {
    const referral = await this.findByCode(code);
    return this.prisma.referral.update({ where: { referralCode: code }, data: { status: 'CONVERTED', referredUserId, convertedAt: new Date() } });
  }
}
