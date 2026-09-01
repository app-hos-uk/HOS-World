import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type PartnerIncentiveResult = {
  conversionId: string;
  partnerId: string;
  linkId: string;
  userId: string;
  signupBonusAwarded: number;
  multiplierApplied: boolean;
  multiplierExpiresAt: Date | null;
  couponApplied: string | null;
};

@Injectable()
export class PartnerIncentiveService {
  private readonly logger = new Logger(PartnerIncentiveService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Enrollment hook used by LoyaltyService. Returns null when the code is not
   * a partner referral (e.g. Enchanted Circle HOS-* codes) so callers can try
   * both referral types without treating a miss as an error.
   */
  async applyPartnerIncentives(
    userId: string,
    linkCode: string,
    options?: { landingPage?: string },
  ): Promise<PartnerIncentiveResult | null> {
    if (!linkCode?.trim()) return null;
    try {
      return await this.applySignupIncentives(userId, linkCode, options);
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  /**
   * Apply partner-link incentives when a user registers through `/ref/:code`.
   * Awards signup bonus points, records multiplier/coupon on the conversion, and
   * increments the link's registration count.
   */
  async applySignupIncentives(
    userId: string,
    linkCode: string,
    options?: { landingPage?: string },
  ): Promise<PartnerIncentiveResult> {
    const code = linkCode?.trim();
    if (!code) {
      throw new BadRequestException('Partner referral code is required');
    }

    const link = await this.findLinkByCode(code);
    if (!link) {
      throw new NotFoundException('Partner referral link not found');
    }

    const already = await this.prisma.partnerReferralConversion.findFirst({
      where: { userId },
    });
    if (already) {
      return this.toResult(already, userId);
    }

    this.assertLinkRedeemable(link);

    try {
      return await this.prisma.$transaction(async (tx) => {
      // Row-lock the link so concurrent registrations cannot exceed maxRedemptions.
      await tx.referralPartnerLink.updateMany({
        where: { id: link.id },
        data: { totalClicks: { increment: 0 } },
      });

      const locked = await tx.referralPartnerLink.findUnique({
        where: { id: link.id },
        include: { partner: true },
      });
      if (!locked) {
        throw new NotFoundException('Partner referral link not found');
      }
      this.assertLinkRedeemable(locked);

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const existing = await tx.partnerReferralConversion.findFirst({
        where: { userId },
      });
      if (existing) {
        return this.toResult(existing, userId);
      }

      const bonusPoints = locked.signupBonusPoints ?? 0;
      let awarded = 0;

      if (bonusPoints > 0) {
        awarded = await this.awardSignupBonus(tx, {
          userId,
          bonusPoints,
          linkId: locked.id,
          partnerName: locked.partner.name,
        });
      }

      const multiplierDays = locked.multiplierDays ?? 0;
      const hasMultiplier =
        locked.pointsMultiplier != null && multiplierDays > 0;
      const multiplierExpiresAt = hasMultiplier
        ? new Date(Date.now() + multiplierDays * 24 * 60 * 60 * 1000)
        : null;

      const conversion = await tx.partnerReferralConversion.create({
        data: {
          partnerId: locked.partnerId,
          linkId: locked.id,
          userId,
          utmSource: locked.utmSource,
          utmMedium: locked.utmMedium,
          utmCampaign: locked.utmCampaign,
          utmContent: locked.utmContent,
          utmTerm: locked.utmTerm,
          signupBonusAwarded: awarded,
          multiplierApplied: hasMultiplier,
          multiplierExpiresAt,
          couponApplied: locked.couponCode ?? null,
          landingPage: options?.landingPage ?? null,
        },
      });

        await tx.referralPartnerLink.update({
          where: { id: locked.id },
          data: { totalRegistrations: { increment: 1 } },
        });

        return {
          conversionId: conversion.id,
          partnerId: locked.partnerId,
          linkId: locked.id,
          userId,
          signupBonusAwarded: awarded,
          multiplierApplied: hasMultiplier,
          multiplierExpiresAt,
          couponApplied: locked.couponCode ?? null,
        };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const raced = await this.prisma.partnerReferralConversion.findFirst({ where: { userId } });
        if (raced) return this.toResult(raced, userId);
      }
      throw e;
    }
  }

  private toResult(
    conversion: {
      id: string;
      partnerId: string;
      linkId: string;
      signupBonusAwarded: number;
      multiplierApplied: boolean;
      multiplierExpiresAt: Date | null;
      couponApplied: string | null;
    },
    userId: string,
  ): PartnerIncentiveResult {
    return {
      conversionId: conversion.id,
      partnerId: conversion.partnerId,
      linkId: conversion.linkId,
      userId,
      signupBonusAwarded: conversion.signupBonusAwarded,
      multiplierApplied: conversion.multiplierApplied,
      multiplierExpiresAt: conversion.multiplierExpiresAt,
      couponApplied: conversion.couponApplied,
    };
  }

  private async findLinkByCode(code: string) {
    const exact = await this.prisma.referralPartnerLink.findUnique({
      where: { code },
      include: { partner: true },
    });
    if (exact) return exact;
    if (code.toUpperCase() === code) return null;
    return this.prisma.referralPartnerLink.findUnique({
      where: { code: code.toUpperCase() },
      include: { partner: true },
    });
  }

  private assertLinkRedeemable(link: {
    isActive: boolean;
    expiresAt: Date | null;
    maxRedemptions: number | null;
    totalRegistrations: number;
    partner: { status: string; name: string };
  }): void {
    if (!link.isActive) {
      throw new BadRequestException('This partner referral link is no longer active');
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This partner referral link has expired');
    }
    if (link.partner.status !== 'ACTIVE') {
      throw new BadRequestException('This partner is not currently accepting referrals');
    }
    if (link.maxRedemptions != null && link.totalRegistrations >= link.maxRedemptions) {
      throw new BadRequestException('This partner referral link has reached its maximum redemptions');
    }
  }

  private async awardSignupBonus(
    tx: Prisma.TransactionClient,
    args: { userId: string; bonusPoints: number; linkId: string; partnerName: string },
  ): Promise<number> {
    const membership = await tx.loyaltyMembership.findUnique({ where: { userId: args.userId } });
    if (!membership) {
      this.logger.warn(
        `No loyalty membership for user ${args.userId}; skipping partner referral bonus`,
      );
      return 0;
    }

    const idempotencyKey = `PARTNER_REFERRAL:${args.linkId}:${args.userId}`;
    const existingTx = await tx.loyaltyTransaction.findUnique({ where: { idempotencyKey } });
    if (existingTx) {
      return existingTx.points;
    }

    const balanceBefore = membership.currentBalance;
    const balanceAfter = balanceBefore + args.bonusPoints;

    await tx.loyaltyMembership.update({
      where: { id: membership.id },
      data: {
        currentBalance: balanceAfter,
        totalPointsEarned: { increment: args.bonusPoints },
        partnerReferralLinkId: args.linkId,
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        membershipId: membership.id,
        type: 'BONUS',
        points: args.bonusPoints,
        balanceBefore,
        balanceAfter,
        source: 'PARTNER_REFERRAL',
        sourceId: args.linkId,
        channel: 'WEB',
        description: `Partner referral bonus from ${args.partnerName}`,
        idempotencyKey,
      },
    });

    return args.bonusPoints;
  }
}
