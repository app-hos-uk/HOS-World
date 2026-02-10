import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentPrismaService } from '../database/prisma.service';

@Injectable()
export class GamificationService {
  constructor(private prisma: ContentPrismaService) {}

  async getBadges() { return this.prisma.badge.findMany({ where: { isActive: true }, orderBy: { points: 'desc' } }); }
  async getUserBadges(userId: string) { return this.prisma.userBadge.findMany({ where: { userId }, include: { badge: true } }); }
  async awardBadge(userId: string, badgeId: string) {
    return this.prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      create: { userId, badgeId },
      update: {},
      include: { badge: true },
    });
  }

  async getQuests(activeOnly = true) {
    return this.prisma.quest.findMany({ where: activeOnly ? { isActive: true } : {}, orderBy: { points: 'desc' } });
  }
  async getUserQuests(userId: string) { return this.prisma.userQuest.findMany({ where: { userId }, include: { quest: true } }); }
  async startQuest(userId: string, questId: string) {
    return this.prisma.userQuest.upsert({
      where: { userId_questId: { userId, questId } },
      create: { userId, questId, status: 'IN_PROGRESS' },
      update: {},
      include: { quest: true },
    });
  }
  async completeQuest(userId: string, questId: string) {
    return this.prisma.userQuest.update({
      where: { userId_questId: { userId, questId } },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: { quest: true },
    });
  }
}
