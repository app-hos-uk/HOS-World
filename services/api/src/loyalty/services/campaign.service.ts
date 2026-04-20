import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LoyaltyCampaignService {
  constructor(private prisma: PrismaService) {}

  /** Active campaigns overlapping now, optionally filtered by region / channel */
  async getActiveForContext(regionCode: string, channel: string) {
    const now = new Date();
    return this.prisma.loyaltyBonusCampaign.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        AND: [
          { OR: [{ regionCodes: { isEmpty: true } }, { regionCodes: { has: regionCode } }] },
          { OR: [{ channelCodes: { isEmpty: true } }, { channelCodes: { has: channel } }] },
        ],
      },
    });
  }

  /**
   * Apply best multiplier + flat bonus from matching campaigns (simple combine).
   */
  applyCampaignsToBasePoints(
    campaigns: Array<{
      id: string;
      multiplier: { toNumber(): number } | null;
      bonusPoints: number | null;
    }>,
    basePoints: number,
  ): { points: number; campaignId?: string } {
    if (!campaigns.length) return { points: Math.round(basePoints) };
    let bestMult = 1;
    let bonus = 0;
    let campaignId: string | undefined;
    for (const c of campaigns) {
      const m = c.multiplier ? c.multiplier.toNumber() : 1;
      if (m > bestMult) {
        bestMult = m;
        campaignId = c.id;
      }
      if (c.bonusPoints) bonus += c.bonusPoints;
    }
    const scaled = basePoints * bestMult + bonus;
    return { points: Math.max(0, Math.round(scaled)), campaignId };
  }
}
