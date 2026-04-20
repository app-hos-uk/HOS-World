import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FandomProfileService {
  private readonly logger = new Logger(FandomProfileService.name);

  constructor(private prisma: PrismaService) {}

  /** Weighted raw scores before normalization (spec §7.2). */
  async computeProfile(userId: string): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};

    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { userId, paymentStatus: 'PAID' } },
      include: { product: { select: { fandom: true } } },
    });
    for (const item of orderItems) {
      const f = item.product?.fandom?.trim();
      if (f) scores[f] = (scores[f] || 0) + 4;
    }

    const wishlistItems = await this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: { select: { fandom: true } } },
    });
    for (const item of wishlistItems) {
      const f = item.product?.fandom?.trim();
      if (f) scores[f] = (scores[f] || 0) + 1.5;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteFandoms: true },
    });
    for (const f of user?.favoriteFandoms ?? []) {
      const key = f.trim();
      if (key) scores[key] = (scores[key] || 0) + 2;
    }

    const quizAttempts = await this.prisma.fandomQuizAttempt.findMany({
      where: { userId },
      include: { quiz: { include: { fandom: { select: { name: true } } } } },
    });
    for (const a of quizAttempts) {
      const name = a.quiz.fandom?.name?.trim();
      if (name) scores[name] = (scores[name] || 0) + 1;
    }

    const quests = await this.prisma.userQuest.findMany({
      where: { userId, status: 'COMPLETED' },
      include: { quest: { include: { fandom: { select: { name: true } } } } },
    });
    for (const uq of quests) {
      const name = uq.quest.fandom?.name?.trim();
      if (name) scores[name] = (scores[name] || 0) + 1;
    }

    const maxScore = Math.max(...Object.values(scores), 1);
    const normalized: Record<string, number> = {};
    for (const [fandom, score] of Object.entries(scores)) {
      normalized[fandom] = Math.round((score / maxScore) * 100) / 100;
    }
    return normalized;
  }

  async updateMemberProfile(userId: string): Promise<void> {
    const profile = await this.computeProfile(userId);
    await this.prisma.loyaltyMembership.updateMany({
      where: { userId },
      data: { fandomProfile: profile },
    });
  }

  async batchUpdateProfiles(): Promise<number> {
    const memberships = await this.prisma.loyaltyMembership.findMany({
      select: { userId: true },
    });
    let updated = 0;
    for (const m of memberships) {
      try {
        await this.updateMemberProfile(m.userId);
        updated++;
      } catch (e) {
        this.logger.warn(`Fandom profile failed for ${m.userId}: ${(e as Error).message}`);
      }
    }
    return updated;
  }
}
