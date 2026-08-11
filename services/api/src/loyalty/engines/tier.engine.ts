import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyEventService } from '../services/loyalty-event.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class LoyaltyTierEngine {
  private readonly logger = new Logger(LoyaltyTierEngine.name);

  constructor(
    private prisma: PrismaService,
    private events: LoyaltyEventService,
  ) {}

  compositeScore(membership: {
    totalSpend: Decimal;
    purchaseCount: number;
    engagementCount: number;
    tier: { spendWeight: Decimal; frequencyWeight: Decimal; engagementWeight: Decimal };
  }): Decimal {
    const spend = new Decimal(membership.totalSpend);
    const sw = membership.tier.spendWeight;
    const fw = membership.tier.frequencyWeight;
    const ew = membership.tier.engagementWeight;
    return spend
      .mul(sw)
      .add(new Decimal(membership.purchaseCount).mul(fw).mul(100))
      .add(new Decimal(membership.engagementCount).mul(ew).mul(50));
  }

  /**
   * Re-place every member against the current tier configuration.
   *
   * Tier placement is otherwise only recomputed when a member earns points, so
   * an admin who edits a threshold has to be able to apply it to the existing
   * base without waiting for the weekly cron or for each member to transact.
   */
  async reviewAllMemberships(): Promise<{ reviewed: number; changed: number; failed: number }> {
    const members = await this.prisma.loyaltyMembership.findMany({ select: { id: true } });
    let changed = 0;
    let failed = 0;

    for (const member of members) {
      try {
        const result = await this.recalculateTier(member.id);
        if (result.changed) changed++;
      } catch (e) {
        failed++;
        this.logger.warn(`Tier review failed for ${member.id}: ${(e as Error).message}`);
      }
    }

    return { reviewed: members.length, changed, failed };
  }

  async recalculateTier(
    membershipId: string,
  ): Promise<{ upgraded: boolean; changed: boolean; tierId: string }> {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { id: membershipId },
      include: { tier: true },
    });
    if (!membership) throw new Error('Membership not found');

    const score = this.compositeScore(membership);
    await this.prisma.loyaltyMembership.update({
      where: { id: membershipId },
      data: { compositeScore: score },
    });

    const tiers = await this.prisma.loyaltyTier.findMany({
      where: { isActive: true },
      orderBy: { level: 'desc' },
    });

    let chosen: (typeof tiers)[0] | null = null;
    for (const t of tiers) {
      if (t.inviteOnly) continue;
      if (membership.totalPointsEarned >= t.pointsThreshold) {
        chosen = t;
        break;
      }
    }
    if (!chosen) {
      chosen = tiers.find((t) => t.level === 1) || tiers[tiers.length - 1] || null;
    }
    if (!chosen) {
      this.logger.warn('No loyalty tiers configured');
      return { upgraded: false, changed: false, tierId: membership.tierId };
    }

    const oldTierId = membership.tierId;
    if (chosen.id === oldTierId) {
      return { upgraded: false, changed: false, tierId: oldTierId };
    }

    await this.prisma.loyaltyMembership.update({
      where: { id: membershipId },
      data: { tierId: chosen.id },
    });

    const upgraded = chosen.level > membership.tier.level;

    this.events
      .onTierChange({
        membershipId,
        userId: membership.userId,
        oldTierName: membership.tier.name,
        newTierName: chosen.name,
        oldTierLevel: membership.tier.level,
        newTierLevel: chosen.level,
      })
      .catch((e) => this.logger.warn(`Tier event failed: ${(e as Error).message}`));

    return { upgraded, changed: true, tierId: chosen.id };
  }
}
