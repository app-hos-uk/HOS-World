import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FandomProfileService {
  private readonly logger = new Logger(FandomProfileService.name);

  constructor(private prisma: PrismaService) {}

  /** Weighted raw scores before normalization (spec §7.2). Uses DB aggregates. */
  async computeProfile(userId: string): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};

    const orderScores: Array<{ fandom: string; score: number }> = await this.prisma.$queryRaw`
      SELECT TRIM(p.fandom) AS fandom, COUNT(*)::int * 4 AS score
      FROM order_items oi
      JOIN orders o ON oi."orderId" = o.id
      JOIN products p ON oi."productId" = p.id
      WHERE o."userId" = ${userId}::uuid
        AND o."paymentStatus" = 'PAID'
        AND p.fandom IS NOT NULL AND TRIM(p.fandom) <> ''
      GROUP BY TRIM(p.fandom)
    `;
    for (const row of orderScores) {
      scores[row.fandom] = (scores[row.fandom] || 0) + Number(row.score);
    }

    const wishlistScores: Array<{ fandom: string; score: number }> = await this.prisma.$queryRaw`
      SELECT TRIM(p.fandom) AS fandom, COUNT(*)::float * 1.5 AS score
      FROM wishlist_items wi
      JOIN products p ON wi."productId" = p.id
      WHERE wi."userId" = ${userId}::uuid
        AND p.fandom IS NOT NULL AND TRIM(p.fandom) <> ''
      GROUP BY TRIM(p.fandom)
    `;
    for (const row of wishlistScores) {
      scores[row.fandom] = (scores[row.fandom] || 0) + Number(row.score);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteFandoms: true },
    });
    for (const f of user?.favoriteFandoms ?? []) {
      const key = f.trim();
      if (key) scores[key] = (scores[key] || 0) + 2;
    }

    const quizScores: Array<{ fandom: string; score: number }> = await this.prisma.$queryRaw`
      SELECT TRIM(f.name) AS fandom, COUNT(*)::int AS score
      FROM fandom_quiz_attempts fqa
      JOIN fandom_quizzes fq ON fqa."quizId" = fq.id
      JOIN fandoms f ON fq."fandomId" = f.id
      WHERE fqa."userId" = ${userId}::uuid
        AND f.name IS NOT NULL AND TRIM(f.name) <> ''
      GROUP BY TRIM(f.name)
    `;
    for (const row of quizScores) {
      scores[row.fandom] = (scores[row.fandom] || 0) + Number(row.score);
    }

    const questScores: Array<{ fandom: string; score: number }> = await this.prisma.$queryRaw`
      SELECT TRIM(f.name) AS fandom, COUNT(*)::int AS score
      FROM user_quests uq
      JOIN quests q ON uq."questId" = q.id
      JOIN fandoms f ON q."fandomId" = f.id
      WHERE uq."userId" = ${userId}::uuid
        AND uq.status = 'COMPLETED'
        AND f.name IS NOT NULL AND TRIM(f.name) <> ''
      GROUP BY TRIM(f.name)
    `;
    for (const row of questScores) {
      scores[row.fandom] = (scores[row.fandom] || 0) + Number(row.score);
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
    const chunkSize = 50;
    let cursor: string | undefined;
    let updated = 0;

    for (;;) {
      const memberships = await this.prisma.loyaltyMembership.findMany({
        select: { id: true, userId: true },
        take: chunkSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });
      if (memberships.length === 0) break;

      for (const m of memberships) {
        try {
          await this.updateMemberProfile(m.userId);
          updated++;
        } catch (e) {
          this.logger.warn(`Fandom profile failed for ${m.userId}: ${(e as Error).message}`);
        }
      }

      cursor = memberships[memberships.length - 1].id;
      if (memberships.length < chunkSize) break;
    }

    return updated;
  }
}
