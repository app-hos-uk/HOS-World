import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../services/wallet.service';
import { LoyaltyTierEngine } from '../engines/tier.engine';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { SegmentationService } from '../../segmentation/segmentation.service';
import { AmbassadorService } from '../../ambassador/ambassador.service';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';

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
    private featureFlags: FeatureFlagsService,
    private segmentation: SegmentationService,
    @Optional() @Inject(forwardRef(() => AmbassadorService))
    private ambassador?: AmbassadorService,
  ) {}

  private runtimeEnabled(): boolean {
    return isLoyaltyRuntimeEnabled(this.config, this.featureFlags);
  }

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
   * @returns applied | already_applied | not_applied — so clients can clear stashed codes safely.
   */
  async onUserRegistered(
    userId: string,
    referralCode?: string,
  ): Promise<'applied' | 'already_applied' | 'not_applied'> {
    if (!this.runtimeEnabled()) return 'not_applied';
    const code = referralCode?.trim();
    if (!code) return 'not_applied';

    const refereeMembership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
    });
    if (!refereeMembership) return 'not_applied';

    try {
      // One referral conversion per member — re-enroll with a different code
      // must not collect multiple REFERRAL_BONUS payouts.
      const alreadyReferee = await this.prisma.loyaltyReferral.findFirst({
        where: { refereeId: refereeMembership.id },
      });
      if (alreadyReferee) return 'already_applied';

      const alreadyBonus = await this.prisma.loyaltyTransaction.findFirst({
        where: {
          membershipId: refereeMembership.id,
          source: 'REFERRAL_BONUS',
          type: LoyaltyTxType.BONUS,
        },
      });
      if (alreadyBonus) return 'already_applied';

      const referral = await this.prisma.loyaltyReferral.findFirst({
        where: { referralCode: { equals: code, mode: 'insensitive' } },
        include: { referrer: true },
      });
      if (!referral || referral.status !== 'PENDING') return 'not_applied';
      if (referral.referrerId === refereeMembership.id) return 'not_applied';

      const [refereeRule, referrerRule] = await Promise.all([
        this.prisma.loyaltyEarnRule.findUnique({ where: { action: 'REFERRAL_REFEREE' } }),
        this.prisma.loyaltyEarnRule.findUnique({ where: { action: 'REFERRAL_REFERRER' } }),
      ]);
      const refereePoints = (refereeRule?.isActive && refereeRule.pointsAmount != null)
        ? refereeRule.pointsAmount
        : this.config.get<number>('LOYALTY_REFERRAL_REFEREE_BONUS', 100);
      const referrerPoints = (referrerRule?.isActive && referrerRule.pointsAmount != null)
        ? referrerRule.pointsAmount
        : this.config.get<number>('LOYALTY_REFERRAL_REFERRER_BONUS', 200);

      let claimedOk = false;
      await this.prisma.$transaction(async (tx) => {
        // Only the first successful claim should award points; concurrent
        // signups with the same code must not double-pay.
        const claimed = await tx.loyaltyReferral.updateMany({
          where: {
            id: referral.id,
            status: 'PENDING',
            refereeId: null,
          },
          data: {
            refereeId: refereeMembership.id,
            status: 'CONVERTED',
            convertedAt: new Date(),
          },
        });
        if (claimed.count !== 1) {
          return;
        }

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
        claimedOk = true;
      });

      if (!claimedOk) return 'not_applied';

      // Conversion already committed — don't report not_applied if post-steps fail.
      try {
        await this.tiers.recalculateTier(refereeMembership.id);
        await this.tiers.recalculateTier(referral.referrerId);
      } catch (tierErr) {
        this.logger.warn(
          `Referral tier recalculation failed after convert: ${(tierErr as Error).message}`,
        );
      }
      void this.segmentation.touchActivity(userId);
      void this.ambassador?.onLoyaltyReferralConverted(referral.referrerId);
      return 'applied';
    } catch (e) {
      this.logger.warn(`Referral conversion failed: ${(e as Error).message}`);
      return 'not_applied';
    }
  }

  /**
   * Award review points on submit (PENDING) or approve (APPROVED).
   * Idempotent by review id — approve after submit will not double-award.
   * @returns Points awarded (0 if skipped).
   */
  async onReviewSubmitted(userId: string, reviewId: string): Promise<number> {
    if (!this.runtimeEnabled()) return 0;

    let membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) {
      // Auto-enroll customers who review before joining so REVIEW earn rules still fire
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'CUSTOMER') return 0;
      let tier = await this.prisma.loyaltyTier.findFirst({
        where: { slug: 'initiate', isActive: true },
      });
      if (!tier) return 0;
      try {
        const prefix = this.config.get<string>('LOYALTY_CARD_PREFIX', 'HOS');
        membership = await this.prisma.loyaltyMembership.create({
          data: {
            userId,
            tierId: tier.id,
            regionCode: user.country || 'GB',
            preferredCurrency: user.currencyPreference || 'USD',
            enrollmentChannel: 'AUTO_REVIEW',
            cardNumber: `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`,
            birthday: user.birthday ?? undefined,
          },
        });
      } catch {
        membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
        if (!membership) return 0;
      }
    }

    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    // Award on submit (PENDING) or approve; ignore rejected reviews
    if (!review || (review.status !== 'APPROVED' && review.status !== 'PENDING')) return 0;

    const text = `${review.comment ?? ''} ${review.title ?? ''}`;
    const isPhoto =
      (Array.isArray((review as any).images) && (review as any).images.length > 0) ||
      PHOTO_IN_REVIEW.test(text);
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
    // Prefer configured active rule; fall back so reviews still earn without admin seed
    const fallback = isPhoto ? 50 : 25;
    const pts = rule?.pointsAmount ?? fallback;
    if (pts <= 0) return 0;
    if (!(await this.isWithinLimits(membership.id, action, rule))) return 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, membership!.id, pts, LoyaltyTxType.EARN, {
          source: action,
          sourceId: reviewId,
          channel: 'WEB',
          earnRuleId: rule?.id,
          description: isPhoto ? 'Photo product review' : 'Product review reward',
        });
        await tx.loyaltyMembership.update({
          where: { id: membership!.id },
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
    if (!this.runtimeEnabled()) return 0;

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
    if (!this.runtimeEnabled()) return 0;

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
    if (!this.runtimeEnabled()) return 0;
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

  /**
   * Sync birthday onto membership and award PROFILE_COMPLETE once when
   * first name, last name, and birthday are all present.
   */
  async onProfileUpdated(userId: string): Promise<number> {
    if (!this.runtimeEnabled()) return 0;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        birthday: true,
        phone: true,
        whatsappNumber: true,
      },
    });
    if (!user) return 0;

    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) return 0;

    const userBirthdayMs = user.birthday?.getTime() ?? null;
    const membershipBirthdayMs = membership.birthday?.getTime() ?? null;
    if (userBirthdayMs !== membershipBirthdayMs) {
      await this.prisma.loyaltyMembership.update({
        where: { id: membership.id },
        data: { birthday: user.birthday ?? null },
      });
    }

    const profileComplete =
      Boolean(user.firstName?.trim()) &&
      Boolean(user.lastName?.trim()) &&
      Boolean(user.birthday);

    if (!profileComplete) return 0;

    const rule = await this.prisma.loyaltyEarnRule.findFirst({
      where: { action: 'PROFILE_COMPLETE', isActive: true },
    });
    let pts = 0;
    if (rule) {
      pts = rule.pointsAmount ?? 0;
      if (pts <= 0) return 0;
    } else {
      // Inactive PROFILE_COMPLETE rule means intentional disable (same as SIGNUP).
      const inactive = await this.prisma.loyaltyEarnRule.findFirst({
        where: { action: 'PROFILE_COMPLETE', isActive: false },
      });
      if (inactive) return 0;
      pts = this.config.get<number>('LOYALTY_PROFILE_COMPLETE_BONUS', 50);
      if (pts <= 0) return 0;
    }

    try {
      let awarded = false;
      await this.prisma.$transaction(async (tx) => {
        // Serialize concurrent profile updates on the membership row, then
        // re-check for an existing bonus inside the transaction.
        await tx.$executeRaw(
          Prisma.sql`SELECT 1 FROM loyalty_memberships WHERE id = ${membership.id}::uuid FOR UPDATE`,
        );
        const dup = await tx.loyaltyTransaction.findFirst({
          where: {
            membershipId: membership.id,
            source: 'PROFILE_COMPLETE',
            type: { in: [LoyaltyTxType.BONUS, LoyaltyTxType.EARN] },
          },
        });
        if (dup) return;

        await this.wallet.applyDelta(tx, membership.id, pts, LoyaltyTxType.BONUS, {
          source: 'PROFILE_COMPLETE',
          channel: 'WEB',
          earnRuleId: rule?.id,
          description: 'Profile completion bonus',
        });
        await tx.loyaltyMembership.update({
          where: { id: membership.id },
          data: {
            totalPointsEarned: { increment: pts },
            engagementCount: { increment: 1 },
          },
        });
        awarded = true;
      });
      if (!awarded) return 0;
      await this.tiers.recalculateTier(membership.id);
      void this.segmentation.touchActivity(userId);
      return pts;
    } catch (e) {
      this.logger.warn(`Profile complete bonus failed: ${(e as Error).message}`);
      return 0;
    }
  }

  /** Reserved for Phase 5 (event attendance). */
  async onEventAttended(_userId: string, _eventId: string): Promise<void> {
    this.logger.debug('onEventAttended: not implemented (Phase 5)');
  }
}
