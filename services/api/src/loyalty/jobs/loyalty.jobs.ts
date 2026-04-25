import { Inject, Injectable, Logger, OnModuleInit, Optional, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { LoyaltyTxType } from '@prisma/client';
import { QueueService, JobType } from '../../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyTierEngine } from '../engines/tier.engine';
import { LoyaltyWalletService } from '../services/wallet.service';
import { FandomProfileService } from '../services/fandom-profile.service';
import { MarketingEventBus } from '../../journeys/marketing-event.bus';

@Injectable()
export class LoyaltyJobsService implements OnModuleInit {
  private readonly logger = new Logger(LoyaltyJobsService.name);

  constructor(
    private queue: QueueService,
    private prisma: PrismaService,
    private tiers: LoyaltyTierEngine,
    private wallet: LoyaltyWalletService,
    private config: ConfigService,
    private fandomProfiles: FandomProfileService,
    @Optional() @Inject(forwardRef(() => MarketingEventBus))
    private marketingBus?: MarketingEventBus,
  ) {}

  async onModuleInit() {
    if (this.config.get<string>('LOYALTY_ENABLED') !== 'true') {
      this.logger.log('Loyalty jobs skipped (LOYALTY_ENABLED != true)');
      return;
    }

    this.queue.registerProcessor(JobType.LOYALTY_TIER_REVIEW, async (_job: Job) => {
      this.logger.log('Starting batch tier review…');
      const members = await this.prisma.loyaltyMembership.findMany({ select: { id: true } });
      let updated = 0;
      for (const m of members) {
        try {
          const result = await this.tiers.recalculateTier(m.id);
          if (result.upgraded) updated++;
        } catch (e) {
          this.logger.warn(`Tier review failed for ${m.id}: ${(e as Error).message}`);
        }
      }
      this.logger.log(`Tier review complete: ${updated}/${members.length} changed`);
    });

    this.queue.registerProcessor(JobType.LOYALTY_POINTS_EXPIRY, async () => {
      const expiryMonths = this.config.get<number>('LOYALTY_POINTS_EXPIRY_MONTHS', 0);
      if (expiryMonths <= 0) {
        this.logger.log('Points expiry disabled (LOYALTY_POINTS_EXPIRY_MONTHS not set)');
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
        include: { membership: true },
        take: 500,
      });

      this.logger.log(`Found ${expirable.length} transactions eligible for expiry`);

      for (const tx of expirable) {
        try {
          await this.prisma.$transaction(async (ptx) => {
            const membership = await ptx.loyaltyMembership.findUnique({
              where: { id: tx.membershipId },
            });
            if (!membership || membership.currentBalance < tx.points) return;

            await this.wallet.applyDelta(ptx, tx.membershipId, -tx.points, LoyaltyTxType.EXPIRE, {
              source: 'EXPIRY',
              sourceId: tx.id,
              channel: 'SYSTEM',
              description: `Points expired (earned ${tx.createdAt.toISOString().slice(0, 10)})`,
            });

            await ptx.loyaltyTransaction.update({
              where: { id: tx.id },
              data: { expiresAt: new Date() },
            });
          });
        } catch (e) {
          this.logger.warn(`Expiry failed for tx ${tx.id}: ${(e as Error).message}`);
        }
      }
    });

    this.queue.registerProcessor(JobType.LOYALTY_BIRTHDAY_BONUS, async () => {
      const bonusRule = await this.prisma.loyaltyEarnRule.findUnique({
        where: { action: 'BIRTHDAY' },
      });
      const pts = bonusRule?.pointsAmount ?? 50;

      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();

      // Birthday stored in LoyaltyMembership.birthday (Date?) — filter in app
      // because SQL date-part filtering varies. If birthday column doesn't exist
      // yet, the query returns all memberships and we filter on the JS side.
      const members = await this.prisma.loyaltyMembership
        .findMany({
          include: { user: { select: { firstName: true } } },
        })
        .catch(() => [] as { id: string; birthday: Date | null; userId: string; user: { firstName: string | null } }[]);

      let awarded = 0;
      for (const m of members) {
        const dob = m.birthday;
        if (!dob) continue;
        if (dob.getMonth() + 1 !== month || dob.getDate() !== day) continue;

        const alreadyAwarded = await this.prisma.loyaltyTransaction.count({
          where: {
            membershipId: m.id,
            source: 'BIRTHDAY',
            createdAt: {
              gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            },
          },
        });
        if (alreadyAwarded > 0) continue;

        try {
          await this.prisma.$transaction(async (ptx) => {
            await this.wallet.applyDelta(ptx, m.id, pts, LoyaltyTxType.BONUS, {
              source: 'BIRTHDAY',
              channel: 'SYSTEM',
              earnRuleId: bonusRule?.id,
              description: 'Happy birthday bonus',
            });
            await ptx.loyaltyMembership.update({
              where: { id: m.id },
              data: {
                totalPointsEarned: { increment: pts },
                engagementCount: { increment: 1 },
              },
            });
          });
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
