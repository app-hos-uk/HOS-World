import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { LoyaltyTxType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from '../../loyalty/services/wallet.service';
import { MarketingEventBus } from '../../journeys/marketing-event.bus';
import { AMBASSADOR_ACHIEVEMENTS, achievementBySlug } from './achievement-definitions';
import { evaluateAmbassadorTier, ambassadorTierIndex } from '../engines/ambassador-tier.engine';

@Injectable()
export class AmbassadorAchievementService {
  private readonly logger = new Logger(AmbassadorAchievementService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => LoyaltyWalletService))
    private wallet: LoyaltyWalletService,
    private marketingBus: MarketingEventBus,
  ) {}

  /**
   * Create achievement row, award points to wallet, increment ambassador points, emit marketing event.
   */
  async grant(
    ambassadorId: string,
    membershipId: string,
    userId: string,
    slug: string,
  ): Promise<void> {
    const def = achievementBySlug(slug);
    if (!def) return;

    const exists = await this.prisma.ambassadorAchievement.findUnique({
      where: {
        ambassadorId_achievementSlug: { ambassadorId, achievementSlug: slug },
      },
    });
    if (exists) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.ambassadorAchievement.create({
        data: {
          ambassadorId,
          achievementSlug: slug,
          name: def.name,
          description: def.description,
          icon: def.icon,
          pointsAwarded: def.points,
        },
      });

      if (def.points > 0) {
        await this.wallet.applyDelta(tx, membershipId, def.points, LoyaltyTxType.BONUS, {
          source: 'AMBASSADOR_ACHIEVEMENT',
          sourceId: slug,
          channel: 'WEB',
          description: `Ambassador achievement: ${def.name}`,
        });
        await tx.loyaltyMembership.update({
          where: { id: membershipId },
          data: { totalPointsEarned: { increment: def.points } },
        });
        await tx.ambassadorProfile.update({
          where: { id: ambassadorId },
          data: { totalPointsEarnedAsAmb: { increment: def.points } },
        });
      }
    });

    void this.marketingBus
      .emit('AMBASSADOR_ACHIEVEMENT', userId, {
        achievementSlug: slug,
        achievementName: def.name,
      })
      .catch(() => {});
  }

  async checkAndAward(ambassadorId: string): Promise<void> {
    const profile = await this.prisma.ambassadorProfile.findUnique({
      where: { id: ambassadorId },
      include: {
        achievements: true,
        membership: true,
      },
    });
    if (!profile || profile.status !== 'ACTIVE') return;

    const earned = new Set(profile.achievements.map((a) => a.achievementSlug));
    const { membershipId, userId } = profile;

    const tier = evaluateAmbassadorTier({
      totalReferralSignups: profile.totalReferralSignups,
      totalUgcApproved: profile.totalUgcApproved,
      totalPointsEarnedAsAmb: profile.totalPointsEarnedAsAmb,
    });

    const distinctPlatforms = await this.prisma.uGCSubmission.findMany({
      where: {
        ambassadorId,
        status: { in: ['APPROVED', 'FEATURED'] },
        platform: { not: null },
      },
      distinct: ['platform'],
      select: { platform: true },
    });
    const platformCount = distinctPlatforms.filter((p) => p.platform && p.platform.length > 0).length;

    for (const def of AMBASSADOR_ACHIEVEMENTS) {
      if (earned.has(def.slug) || def.slug === 'ambassador-unlocked') continue;

      let ok = false;
      switch (def.slug) {
        case 'first-referral':
          ok = profile.totalReferralSignups >= 1;
          break;
        case 'referral-5':
          ok = profile.totalReferralSignups >= 5;
          break;
        case 'referral-15':
          ok = profile.totalReferralSignups >= 15;
          break;
        case 'referral-50':
          ok = profile.totalReferralSignups >= 50;
          break;
        case 'ugc-first':
          ok = profile.totalUgcApproved >= 1;
          break;
        case 'ugc-star':
          ok = profile.totalUgcApproved >= 10;
          break;
        case 'ugc-featured':
          ok =
            (await this.prisma.uGCSubmission.count({
              where: { ambassadorId, status: 'FEATURED' },
            })) >= 1;
          break;
        case 'champion-tier':
          ok = ambassadorTierIndex(tier.slug) >= 1;
          break;
        case 'legend-tier':
          ok = ambassadorTierIndex(tier.slug) >= 2;
          break;
        case 'points-1000':
          ok = profile.totalPointsEarnedAsAmb >= 1000;
          break;
        case 'social-butterfly':
          ok = platformCount >= 3;
          break;
        default:
          ok = false;
      }

      if (ok) {
        try {
          await this.grant(ambassadorId, membershipId, userId, def.slug);
          earned.add(def.slug);
        } catch (e) {
          this.logger.warn(`Achievement ${def.slug}: ${(e as Error).message}`);
        }
      }
    }
  }
}
