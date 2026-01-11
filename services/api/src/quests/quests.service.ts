import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class QuestsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.quest.findMany({
      where: { isActive: true },
      include: {
        fandom: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        badge: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
      orderBy: { points: 'desc' },
    });
  }

  async findOne(id: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id },
      include: {
        fandom: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        badge: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    return quest;
  }

  async getAvailableQuests(userId: string) {
    // Get all active quests
    const allQuests = await this.prisma.quest.findMany({
      where: { isActive: true },
      include: {
        fandom: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        badge: {
          select: {
            id: true,
            name: true,
            icon: true,
          },
        },
      },
    });

    // Get user's quests
    const userQuests = await this.prisma.userQuest.findMany({
      where: { userId },
    });

    const userQuestIds = new Set(userQuests.map((uq) => uq.questId));

    // Filter out quests user has already started or completed
    const available = allQuests.filter((quest) => !userQuestIds.has(quest.id));

    return available;
  }

  async getActiveQuests(userId: string) {
    const userQuests = await this.prisma.userQuest.findMany({
      where: {
        userId,
        status: 'IN_PROGRESS',
      },
      include: {
        quest: {
          include: {
            fandom: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            badge: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
    });

    return userQuests.map((uq) => ({
      id: uq.id,
      questId: uq.quest.id,
      name: uq.quest.name,
      description: uq.quest.description,
      type: uq.quest.type,
      fandom: uq.quest.fandom,
      points: uq.quest.points,
      badge: uq.quest.badge,
      progress: uq.progress,
      status: uq.status,
      startedAt: new Date().toISOString(), // UserQuest doesn't have createdAt field
    }));
  }

  async getCompletedQuests(userId: string) {
    const userQuests = await this.prisma.userQuest.findMany({
      where: {
        userId,
        status: 'COMPLETED',
      },
      include: {
        quest: {
          include: {
            fandom: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            badge: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });

    return userQuests.map((uq) => ({
      id: uq.id,
      questId: uq.quest.id,
      name: uq.quest.name,
      description: uq.quest.description,
      type: uq.quest.type,
      fandom: uq.quest.fandom,
      points: uq.quest.points,
      badge: uq.quest.badge,
      progress: uq.progress,
      status: uq.status,
      completedAt: uq.completedAt?.toISOString(),
    }));
  }

  async startQuest(userId: string, questId: string) {
    // Check if quest exists
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
    });

    if (!quest) {
      throw new NotFoundException('Quest not found');
    }

    if (!quest.isActive) {
      throw new BadRequestException('Quest is not active');
    }

    // Check if user already has this quest
    const existing = await this.prisma.userQuest.findFirst({
      where: {
        userId,
        questId,
      },
    });

    if (existing) {
      throw new BadRequestException('Quest already started or completed');
    }

    // Create user quest
    const userQuest = await this.prisma.userQuest.create({
      data: {
        userId,
        questId,
        status: 'IN_PROGRESS',
        progress: {},
      },
      include: {
        quest: {
          include: {
            fandom: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            badge: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
        },
      },
    });

    return {
      id: userQuest.id,
      questId: userQuest.quest.id,
      name: userQuest.quest.name,
      description: userQuest.quest.description,
      type: userQuest.quest.type,
      fandom: userQuest.quest.fandom,
      points: userQuest.quest.points,
      badge: userQuest.quest.badge,
      progress: userQuest.progress,
      status: userQuest.status,
      startedAt: new Date().toISOString(),
    };
  }

  async completeQuest(userId: string, questId: string) {
    const userQuest = await this.prisma.userQuest.findFirst({
      where: {
        userId,
        questId,
      },
      include: {
        quest: true,
      },
    });

    if (!userQuest) {
      throw new NotFoundException('Quest not found or not started');
    }

    if (userQuest.status === 'COMPLETED') {
      throw new BadRequestException('Quest already completed');
    }

    // Update quest status
    const updated = await this.prisma.userQuest.update({
      where: { id: userQuest.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      include: {
        quest: {
          include: {
            fandom: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            badge: {
              select: {
                id: true,
                name: true,
                icon: true,
              },
            },
          },
        },
      },
    });

    // Award points
    if (updated.quest.points > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          gamificationPoints: {
            increment: updated.quest.points,
          },
        },
      });
    }

    // Award badge if quest has one
    if (updated.quest.badgeId) {
      try {
        await this.prisma.userBadge.create({
          data: {
            userId,
            badgeId: updated.quest.badgeId,
          },
        });
      } catch (error) {
        // Badge already earned, ignore
      }
    }

    return {
      id: updated.id,
      questId: updated.quest.id,
      name: updated.quest.name,
      description: updated.quest.description,
      type: updated.quest.type,
      fandom: updated.quest.fandom,
      points: updated.quest.points,
      badge: updated.quest.badge,
      progress: updated.progress,
      status: updated.status,
      completedAt: updated.completedAt?.toISOString(),
    };
  }
}
