import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';
import { LoyaltyTierEngine } from '../engines/tier.engine';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { SegmentationService } from '../../segmentation/segmentation.service';
import { AmbassadorService } from '../../ambassador/ambassador.service';

const PHOTO_IN_REVIEW = /\bhttps?:\/\/\S+\.(jpg|jpeg|png|gif|webp)(\?\S*)?\b/i;

/**
 * Cross-cutting loyalty side-effects. Methods are called imperatively from
 * services (auth, reviews, social, quests, quiz) — not via an event bus.
 */
@Injectable()
export class LoyaltyListener {
  private readonly logger = new Logger(LoyaltyListener.name);

  constructor(
    private prisma: PrismaService,
    private wallet: LoyaltyWalletService,
    private tiers: LoyaltyTierEngine,
    private config: ConfigService,
    private segmentation: SegmentationService,
    @Optional() @Inject(forwardRef(() => AmbassadorService))
    private ambassador?: AmbassadorService,
  ) {}

  private async isWithinLimits(
    membershipId: string,
    source: string,
    rule: { maxPerDay?: number | null; maxPerMonth?: number | null } | null,
  ): Promise<boolean> {
    if (!rule) return true;
    if (rule.maxPerDay != null && rule.maxPerDay > 0) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayCount = await this.prisma.loyaltyTransaction.count({
        where: {
          membershipId,
          source,
          type: LoyaltyTxType.EARN,
          createdAt: { gte: dayStart },
        },
      });
      if (dayCount >= rule.maxPerDay) return false;
    }
    if (rule.maxPerMonth != null && rule.maxPerMonth > 0) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthCount = await this.prisma.loyaltyTransaction.count({
        where: {
          membershipId,
          source,
          type: LoyaltyTxType.EARN,
          createdAt: { gte: monthStart },
        },
      });
      if (monthCount >= rule.maxPerMonth) return false;
    }
    return true;
  }

  /**
   * Apply referral signup bonuses. Requires an existing loyalty membership (call after enroll).
   */
  async onUserRegistered(userId: string, referralCode?: string): Promise<void> {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') return;
    const code = referralCode?.trim();
    if (!code) return;

    const refereeMembership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
    });
    if (!refereeMembership) return;

    try {
      const referral = await this.prisma.loyaltyReferral.findFirst({
        where: { referralCode: { equals: code, mode: 'insensitive' } },
        include: { referrer: true },
      });
      if (!referral || referral.status !== 'PENDING') return;
      if (referral.referrerId === refereeMembership.id) return;

      const refereePoints = this.config.get<number>('LOYALTY_REFERRAL_REFEREE_BONUS', 100);
      const referrerPoints = this.config.get<number>('LOYALTY_REFERRAL_REFERRER_BONUS', 200);

      await this.prisma.$transaction(async (tx) => {
        await tx.loyaltyReferral.update({
          where: { id: referral.id },
          data: {
            refereeId: refereeMembership.id,
            status: 'CONVERTED',
            convertedAt: new Date(),
          },
        });

        await this.wallet.applyDelta(tx, refereeMembership.id, refereePoints, LoyaltyTxType.BONUS, {
          source: 'REFERRAL_BONUS',
          sourceId: referral.id,
          channel: 'WEB',
          description: 'Referral welcome bonus',
        });
        await tx.loyaltyMembership.update({
          where: { id: refereeMembership.id },
          data: { totalPointsEarned: { increment: refereePoints } },
        });

        await this.wallet.applyDelta(tx, referral.referrerId, referrerPoints, LoyaltyTxType.BONUS, {
          source: 'REFERRAL_REWARD',
          sourceId: referral.id,
          channel: 'WEB',
          description: `Referral reward – friend joined`,
        });
        await tx.loyaltyMembership.update({
          where: { id: referral.referrerId },
          data: {
            totalPointsEarned: { increment: referrerPoints },
            engagementCount: { increment: 1 },
          },
        });
      });

      await this.tiers.recalculateTier(refereeMembership.id);
      await this.tiers.recalculateTier(referral.referrerId);
      void this.segmentation.touchActivity(userId);
      void this.ambassador?.onLoyaltyReferralConverted(referral.referrerId);
    } catch (e) {
      this.logger.warn(`Referral conversion failed: ${(e as Error).message}`);
    }
  }

  /**
   * @returns Points awarded (0 if skipped).
   */
  async onReviewSubmitted(userId: string, reviewId: string): Promise<number> {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') return 0;

    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) return 0;

    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!review || review.status !== 'APPROVED') return 0;

    const text = `${review.comment ?? ''} ${review.title ?? ''}`;
    const isPhoto = PHOTO_IN_REVIEW.test(text);
    const action = isPhoto ? 'PHOTO_REVIEW' : 'REVIEW';

    const dup = await this.prisma.loyaltyTransaction.findFirst({
      where: {
        membershipId: membership.id,
        sourceId: reviewId,
        type: LoyaltyTxType.EARN,
        source: { in: ['REVIEW', 'PHOTO_REVIEW'] },
      },
    });
    if (dup) return 0;

    const rule = await this.prisma.loyaltyEarnRule.findFirst({
      where: { action, isActive: true },
    });
    const fallback = isPhoto ? 50 : 25;
    const pts = rule?.pointsAmount ?? fallback;
    if (!(await this.isWithinLimits(membership.id, action, rule))) return 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership.id, pts, LoyaltyTxType.EARN, {
          source: action,
          sourceId: reviewId,
          channel: 'WEB',
          earnRuleId: rule?.id,
          description: isPhoto ? 'Photo product review' : 'Product review reward',
        });
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: pts },
            engagementCount: { increment: 1 },
          },
        });
      });
      await this.tiers.recalculateTier(membership.id);
      void this.segmentation.touchActivity(userId);
      return pts;
    } catch (e) {
      this.logger.warn(`Review reward failed: ${(e as Error).message}`);
      return 0;
    }
  }

  /**
   * @returns Points awarded (0 if skipped / over daily cap).
   */
  async onSocialShare(userId: string, platform: string): Promise<number> {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') return 0;

    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) return 0;

    const rule = await this.prisma.loyaltyEarnRule.findFirst({
      where: { action: 'SOCIAL_SHARE', isActive: true },
    });
    const pts = rule?.pointsAmount ?? 10;
    if (!(await this.isWithinLimits(membership.id, 'SOCIAL_SHARE', rule))) return 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership.id, pts, LoyaltyTxType.EARN, {
          source: 'SOCIAL_SHARE',
          channel: 'WEB',
          earnRuleId: rule?.id,
          description: `Social share on ${platform}`,
          metadata: { platform } as Prisma.InputJsonValue,
        });
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: pts },
            engagementCount: { increment: 1 },
          },
        });
      });
      await this.tiers.recalculateTier(membership.id);
      void this.segmentation.touchActivity(userId);
      return pts;
    } catch (e) {
      this.logger.warn(`Social share reward failed: ${(e as Error).message}`);
      return 0;
    }
  }

  async onQuestCompleted(userId: string, questId: string, questPoints: number): Promise<number> {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') return 0;

    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) return 0;

    const dup = await this.prisma.loyaltyTransaction.findFirst({
      where: { membershipId: membership.id, source: 'QUEST', sourceId: questId, type: LoyaltyTxType.EARN },
    });
    if (dup) return 0;

    const rule = await this.prisma.loyaltyEarnRule.findFirst({
      where: { action: 'QUEST', isActive: true },
    });
    const pts = questPoints > 0 ? questPoints : rule?.pointsAmount ?? 0;
    if (pts <= 0) return 0;
    if (!(await this.isWithinLimits(membership.id, 'QUEST', rule))) return 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership.id, pts, LoyaltyTxType.EARN, {
          source: 'QUEST',
          sourceId: questId,
          channel: 'WEB',
          earnRuleId: rule?.id,
          description: 'Quest completed',
        });
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: pts },
            engagementCount: { increment: 1 },
          },
        });
      });
      await this.tiers.recalculateTier(membership.id);
      void this.segmentation.touchActivity(userId);
      return pts;
    } catch (e) {
      this.logger.warn(`Quest loyalty earn failed: ${(e as Error).message}`);
      return 0;
    }
  }

  async onQuizCompleted(userId: string, quizId: string, points: number): Promise<number> {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') return 0;
    if (points <= 0) return 0;

    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) return 0;

    const dup = await this.prisma.loyaltyTransaction.findFirst({
      where: { membershipId: membership.id, source: 'QUIZ', sourceId: quizId, type: LoyaltyTxType.EARN },
    });
    if (dup) return 0;

    const rule = await this.prisma.loyaltyEarnRule.findFirst({
      where: { action: 'QUIZ', isActive: true },
    });
    if (!(await this.isWithinLimits(membership.id, 'QUIZ', rule))) return 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership.id, points, LoyaltyTxType.EARN, {
          source: 'QUIZ',
          sourceId: quizId,
          channel: 'WEB',
          earnRuleId: rule?.id,
          description: 'Fandom quiz completed',
        });
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: points },
            engagementCount: { increment: 1 },
          },
        });
      });
      await this.tiers.recalculateTier(membership.id);
      void this.segmentation.touchActivity(userId);
      return points;
    } catch (e) {
      this.logger.warn(`Quiz loyalty earn failed: ${(e as Error).message}`);
      return 0;
    }
  }

  /** Reserved for Phase 5 (event attendance). */
  async onEventAttended(_userId: string, _eventId: string): Promise<void> {
    this.logger.debug('onEventAttended: not implemented (Phase 5)');
  }
}
