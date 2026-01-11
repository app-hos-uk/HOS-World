import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class BadgesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.badge.findMany({
      where: { isActive: true },
      orderBy: { points: 'desc' },
    });
  }

  async findOne(id: string) {
    const badge = await this.prisma.badge.findUnique({
      where: { id },
    });

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    return badge;
  }

  async getUserBadges(userId: string) {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: { earnedAt: 'desc' },
    });

    return userBadges.map((ub) => ({
      id: ub.badge.id,
      name: ub.badge.name,
      description: ub.badge.description,
      icon: ub.badge.icon,
      category: ub.badge.category,
      rarity: ub.badge.rarity,
      points: ub.badge.points,
      earnedAt: ub.earnedAt.toISOString(),
    }));
  }

  async getBadgeById(id: string) {
    return this.findOne(id);
  }
}
