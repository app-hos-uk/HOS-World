import { Inject, Injectable, Logger, OnModuleInit, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { LoyaltyTxType } from '@prisma/client';
import { QueueService, JobType } from '../../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyTierEngine } from '../engines/tier.engine';
import { LoyaltyWalletService } from '../services/wallet.service';
import { FandomProfileService } from '../services/fandom-profile.service';
import { LoyaltySettingsService } from '../services/loyalty-settings.service';
import { MarketingEventBus } from '../../journeys/marketing-event.bus';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';

@Injectable()
export class LoyaltyJobsService implements OnModuleInit {
  private readonly logger = new Logger(LoyaltyJobsService.name);

  constructor(
    private queue: QueueService,
    private prisma: PrismaService,
    private tiers: LoyaltyTierEngine,
    private wallet: LoyaltyWalletService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    private fandomProfiles: FandomProfileService,
    private settings: LoyaltySettingsService,
    @Optional()
    @Inject(forwardRef(() => MarketingEventBus))
    private marketingBus?: MarketingEventBus,
  ) {}

  /**
   * Points that aged past the cutoff and were never spent. Spends are assumed
   * to consume the oldest credits first, so all-time debits are netted off the
   * aged credits; the result is capped by the live balance so expiry can never
   * take points a member has already burned.
   */
  private async computeExpirableBudget(membershipId: string, cutoff: Date): Promise<number> {
    const [agedCredits, debits, membership] = await Promise.all([
      this.prisma.loyaltyTransaction.aggregate({
        where: { membershipId, points: { gt: 0 }, createdAt: { lt: cutoff } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyTransaction.aggregate({
        where: { membershipId, points: { lt: 0 } },
        _sum: { points: true },
      }),
      this.prisma.loyaltyMembership.findUnique({
        where: { id: membershipId },
        select: { currentBalance: true },
      }),
    ]);
    const credits = Number(agedCredits._sum.points ?? 0);
    const spent = Math.abs(Number(debits._sum.points ?? 0));
    return Math.max(0, Math.min(credits - spent, membership?.currentBalance ?? 0));
  }

  async onModuleInit() {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
      this.logger.log('Loyalty jobs skipped (LOYALTY_ENABLED / LOYALTY_PROGRAMME not enabled)');
      return;
    }

    this.queue.registerProcessor(JobType.LOYALTY_TIER_REVIEW, async (_job: Job) => {
      this.logger.log('Starting batch tier review…');
      const { reviewed, changed } = await this.tiers.reviewAllMemberships();
      this.logger.log(`Tier review complete: ${changed}/${reviewed} changed`);
    });

    this.queue.registerProcessor(JobType.LOYALTY_POINTS_EXPIRY, async () => {
      const { settings } = await this.settings.getResolved(true);
      const expiryMonths = Math.max(0, Math.floor(Number(settings.pointsExpiryMonths) || 0));
      if (expiryMonths <= 0) {
        this.logger.log('Points expiry disabled (pointsExpiryMonths is 0)');
        return;
      }

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - expiryMonths);

      const expirable = await this.prisma.loyaltyTransaction.findMany({
        where: {
          type: LoyaltyTxType.EARN,
          createdAt: { lt: cutoff },
          expiresAt: null,
          points: { gt: 0 },
        },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });

      this.logger.log(`Found ${expirable.length} transactions eligible for expiry`);

      const byMembership = new Map<string, typeof expirable>();
      for (const tx of expirable) {
        const rows = byMembership.get(tx.membershipId) ?? [];
        rows.push(tx);
        byMembership.set(tx.membershipId, rows);
      }

      for (const [membershipId, rows] of byMembership) {
        try {
          let budget = await this.computeExpirableBudget(membershipId, cutoff);
          for (const tx of rows) {
            // Under FIFO, spends consume the oldest credits first, so only the
            // portion of this earn that was never spent may expire. The row is
            // still stamped when the budget is exhausted — its points are
            // already accounted for by earlier burns.
            const amount = Math.min(tx.points, Math.max(0, budget));
            await this.prisma.$transaction(async (ptx) => {
              if (amount > 0) {
                await this.wallet.applyDelta(ptx, membershipId, -amount, LoyaltyTxType.EXPIRE, {
                  source: 'EXPIRY',
                  sourceId: tx.id,
                  channel: 'SYSTEM',
                  description: `Points expired (earned ${tx.createdAt.toISOString().slice(0, 10)})`,
                  idempotencyKey: `expire:${tx.id}`,
                  metadata: { earnedPoints: tx.points, expiredPoints: amount },
                });
              }
              await ptx.loyaltyTransaction.update({
                where: { id: tx.id },
                data: { expiresAt: new Date() },
              });
            });
            budget -= amount;
          }
        } catch (e) {
          this.logger.warn(`Expiry failed for membership ${membershipId}: ${(e as Error).message}`);
        }
      }
    });

    this.queue.registerProcessor(JobType.LOYALTY_BIRTHDAY_BONUS, async () => {
      const bonusRule = await this.prisma.loyaltyEarnRule.findUnique({
        where: { action: 'BIRTHDAY' },
      });
      if (bonusRule && !bonusRule.isActive) {
        this.logger.log('Birthday bonus skipped (BIRTHDAY earn rule inactive)');
        return;
      }
      const envPtsRaw = this.config.get<string | number>('LOYALTY_BIRTHDAY_BONUS', 200);
      const envPts = typeof envPtsRaw === 'number' ? envPtsRaw : Number(envPtsRaw);
      const pts = Number(
        bonusRule?.pointsAmount ?? (Number.isFinite(envPts) && envPts > 0 ? envPts : 200),
      );
      if (!Number.isFinite(pts) || pts <= 0) {
        this.logger.log('Birthday bonus skipped (points resolved to 0)');
        return;
      }

      // Date-only profile birthdays are stored as UTC midnight (`new Date('YYYY-MM-DD')`).
      // Compare in UTC so negative-offset hosts do not shift the calendar day.
      // Cron hosts should run in UTC (Railway default).
      const today = new Date();
      const month = today.getUTCMonth() + 1;
      const day = today.getUTCDate();

      // Prefer User.birthday (profile), fall back to membership.birthday.
      // Do not swallow query failures — empty catch previously wiped the entire run.
      const members = await this.prisma.loyaltyMembership.findMany({
        include: {
          user: { select: { firstName: true, birthday: true } },
        },
      });

      let awarded = 0;
      for (const m of members) {
        const dob = m.user?.birthday ?? m.birthday;
        if (!dob) continue;
        if (dob.getUTCMonth() + 1 !== month || dob.getUTCDate() !== day) continue;

        // One birthday bonus per calendar year, enforced by the wallet key below;
        // this is just a cheap filter so most members skip the transaction.
        const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
        const alreadyAwarded = await this.prisma.loyaltyTransaction.count({
          where: { membershipId: m.id, source: 'BIRTHDAY', createdAt: { gte: yearStart } },
        });
        if (alreadyAwarded > 0) continue;

        try {
          let applied = false;
          await this.prisma.$transaction(async (ptx) => {
            await this.wallet.lockMembership(ptx, m.id);
            const dup = await ptx.loyaltyTransaction.count({
              where: { membershipId: m.id, source: 'BIRTHDAY', createdAt: { gte: yearStart } },
            });
            if (dup > 0) return;

            const result = await this.wallet.applyDelta(ptx, m.id, pts, LoyaltyTxType.BONUS, {
              source: 'BIRTHDAY',
              channel: 'SYSTEM',
              earnRuleId: bonusRule?.id,
              description: 'Happy birthday bonus',
              idempotencyKey: `bonus:BIRTHDAY:${m.id}:${today.getUTCFullYear()}`,
            });
            if (!result.applied) return;

            await ptx.loyaltyMembership.update({
              where: { id: m.id },
              data: {
                totalPointsEarned: { increment: pts },
                engagementCount: { increment: 1 },
                // Keep membership birthday aligned when only user profile had it
                ...(m.birthday ? {} : dob ? { birthday: dob } : {}),
              },
            });
            applied = true;
          });
          if (!applied) continue;
          awarded++;
          void this.marketingBus
            ?.emit('LOYALTY_BIRTHDAY', m.userId, {
              firstName: m.user?.firstName || '',
              bonusPoints: pts,
              membershipId: m.id,
            })
            .catch(() => {});
        } catch (e) {
          this.logger.warn(`Birthday bonus failed for ${m.id}: ${(e as Error).message}`);
        }
      }
      this.logger.log(`Birthday bonus: ${awarded} members rewarded`);
    });

    this.queue.registerProcessor(JobType.LOYALTY_ANNIVERSARY_BONUS, async () => {
      const bonusRule = await this.prisma.loyaltyEarnRule.findUnique({
        where: { action: 'ANNIVERSARY' },
      });
      if (bonusRule && !bonusRule.isActive) {
        this.logger.log('Anniversary bonus skipped (ANNIVERSARY earn rule inactive)');
        return;
      }
      const envPtsRaw = this.config.get<string | number>('LOYALTY_ANNIVERSARY_BONUS', 150);
      const envPts = typeof envPtsRaw === 'number' ? envPtsRaw : Number(envPtsRaw);
      const pts = Number(
        bonusRule?.pointsAmount ?? (Number.isFinite(envPts) && envPts > 0 ? envPts : 150),
      );
      if (!Number.isFinite(pts) || pts <= 0) {
        this.logger.log('Anniversary bonus skipped (points resolved to 0)');
        return;
      }

      // Use UTC calendar day (same as birthday job / date-only storage).
      const today = new Date();
      const month = today.getUTCMonth() + 1;
      const day = today.getUTCDate();
      const year = today.getUTCFullYear();

      const members = await this.prisma.loyaltyMembership.findMany({
        include: {
          user: { select: { firstName: true } },
        },
      });

      let awarded = 0;
      for (const m of members) {
        // Membership anniversary is based on enrollment date only (full year of tenure).
        const anniversary = m.enrolledAt;
        if (!anniversary) continue;
        if (anniversary.getUTCFullYear() >= year) continue;
        if (anniversary.getUTCMonth() + 1 !== month || anniversary.getUTCDate() !== day) continue;

        // One anniversary bonus per calendar year (wallet key enforces it).
        const yearStart = new Date(Date.UTC(year, 0, 1));
        const alreadyAwarded = await this.prisma.loyaltyTransaction.count({
          where: { membershipId: m.id, source: 'ANNIVERSARY', createdAt: { gte: yearStart } },
        });
        if (alreadyAwarded > 0) continue;

        try {
          let applied = false;
          await this.prisma.$transaction(async (ptx) => {
            await this.wallet.lockMembership(ptx, m.id);
            const dup = await ptx.loyaltyTransaction.count({
              where: { membershipId: m.id, source: 'ANNIVERSARY', createdAt: { gte: yearStart } },
            });
            if (dup > 0) return;

            const result = await this.wallet.applyDelta(ptx, m.id, pts, LoyaltyTxType.BONUS, {
              source: 'ANNIVERSARY',
              channel: 'SYSTEM',
              earnRuleId: bonusRule?.id,
              description: 'Membership anniversary bonus',
              idempotencyKey: `bonus:ANNIVERSARY:${m.id}:${year}`,
            });
            if (!result.applied) return;

            await ptx.loyaltyMembership.update({
              where: { id: m.id },
              data: {
                totalPointsEarned: { increment: pts },
                engagementCount: { increment: 1 },
              },
            });
            applied = true;
          });
          if (applied) awarded++;
        } catch (e) {
          this.logger.warn(`Anniversary bonus failed for ${m.id}: ${(e as Error).message}`);
        }
      }
      this.logger.log(`Anniversary bonus: ${awarded} members rewarded`);
    });

    this.queue.registerProcessor(JobType.FANDOM_PROFILE_RECOMPUTE, async () => {
      const n = await this.fandomProfiles.batchUpdateProfiles();
      this.logger.log(`Fandom profile recompute: ${n} members`);
    });

    try {
      await this.queue.addRepeatable(
        JobType.LOYALTY_TIER_REVIEW,
        {},
        this.config.get<string>('LOYALTY_TIER_REVIEW_CRON', '0 2 * * 0'),
      );
      await this.queue.addRepeatable(
        JobType.LOYALTY_POINTS_EXPIRY,
        {},
        this.config.get<string>('LOYALTY_EXPIRY_CRON', '0 3 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.LOYALTY_BIRTHDAY_BONUS,
        {},
        this.config.get<string>('LOYALTY_BIRTHDAY_CRON', '0 6 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.LOYALTY_ANNIVERSARY_BONUS,
        {},
        this.config.get<string>('LOYALTY_ANNIVERSARY_CRON', '0 6 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.FANDOM_PROFILE_RECOMPUTE,
        {},
        this.config.get<string>('FANDOM_PROFILE_RECOMPUTE_CRON', '0 5 * * 0'),
      );
      this.logger.log('Loyalty cron jobs scheduled');
    } catch (e) {
      this.logger.warn(`Failed to schedule loyalty cron jobs: ${(e as Error).message}`);
    }
  }
}
