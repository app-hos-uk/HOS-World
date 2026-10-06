import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  enrollmentChannelAliases,
  purchaseEarnCampaigns,
  resolveSignupCampaignAward,
  type SignupCampaignLike,
} from '../signup-bonus';

@Injectable()
export class LoyaltyCampaignService {
  constructor(private prisma: PrismaService) {}

  /**
   * Active campaigns overlapping now, optionally filtered by region / channel / store.
   * `marketId` is accepted so earn and enroll can pass the member's market.
   * LoyaltyBonusCampaign has no marketId column — country regionCodes are the
   * market filter (US, MY, and so on).
   */
  async getActiveForContext(
    regionCode: string,
    channel: string,
    storeId?: string,
    marketId?: string | null,
  ) {
    void marketId;
    const now = new Date();
    // Store-scoped campaigns are outlet-only. Web (no storeId) must not inherit
    // a Times Square campaign just because channelCodes is empty.
    const storeFilter = storeId
      ? {
          OR: [{ storeIds: { isEmpty: true } }, { storeIds: { has: storeId } }],
        }
      : { storeIds: { isEmpty: true } };
    const channelAliases = enrollmentChannelAliases(channel);
    return this.prisma.loyaltyBonusCampaign.findMany({
      where: {
        isActive: true,
        brandCampaignId: null,
        startsAt: { lte: now },
        endsAt: { gte: now },
        AND: [
          { OR: [{ regionCodes: { isEmpty: true } }, { regionCodes: { has: regionCode } }] },
          {
            OR: [
              { channelCodes: { isEmpty: true } },
              { channelCodes: { hasSome: channelAliases } },
            ],
          },
          storeFilter,
        ],
      },
    });
  }

  resolveSignupAward(
    campaigns: SignupCampaignLike[],
    fallbackPoints: number,
  ): { points: number; campaignId?: string; campaignName?: string } {
    return resolveSignupCampaignAward(campaigns, fallbackPoints);
  }

  /**
   * Apply best multiplier + flat bonus from matching purchase campaigns.
   * SIGNUP_BONUS campaigns are ignored here so welcome offers never inflate order earn.
   */
  applyCampaignsToBasePoints(
    campaigns: Array<{
      id: string;
      type?: string | null;
      multiplier: { toNumber(): number } | null;
      bonusPoints: number | null;
    }>,
    basePoints: number,
  ): { points: number; campaignId?: string; mult: number; bonus: number } {
    const earnCampaigns = purchaseEarnCampaigns(campaigns);
    if (!earnCampaigns.length) {
      return { points: Math.round(basePoints), mult: 1, bonus: 0 };
    }
    let bestMult = 1;
    let bonus = 0;
    let campaignId: string | undefined;
    for (const c of earnCampaigns) {
      const m = c.multiplier ? c.multiplier.toNumber() : 1;
      if (m > bestMult) {
        bestMult = m;
        campaignId = c.id;
      }
      if (c.bonusPoints) bonus += c.bonusPoints;
    }
    const scaled = basePoints * bestMult + bonus;
    return { points: Math.max(0, Math.round(scaled)), campaignId, mult: bestMult, bonus };
  }
}
