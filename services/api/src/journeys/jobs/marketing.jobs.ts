import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { LoyaltyTxType } from '@prisma/client';
import { QueueService, JobType } from '../../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { JourneyService } from '../journey.service';
import { MarketingEventBus } from '../marketing-event.bus';

@Injectable()
export class MarketingJobsService implements OnModuleInit {
  private readonly logger = new Logger(MarketingJobsService.name);

  constructor(
    private queue: QueueService,
    private prisma: PrismaService,
    private config: ConfigService,
    private journeys: JourneyService,
    private bus: MarketingEventBus,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.JOURNEY_STEP_PROCESS, async (_job: Job) => {
      const n = await this.journeys.processDueEnrollments(100);
      if (n > 0) this.logger.debug(`Processed ${n} journey enrollments`);
    });

    this.queue.registerProcessor(JobType.ABANDONED_CART_SCAN, async () => {
      await this.runAbandonedCartScan();
    });

    this.queue.registerProcessor(JobType.INACTIVITY_SCAN, async () => {
      await this.runInactivityScan();
    });

    this.queue.registerProcessor(JobType.MARKETING_POINTS_EXPIRY_WARNING, async () => {
      await this.runPointsExpiryWarningScan();
    });

    try {
      await this.queue.addRepeatable(
        JobType.JOURNEY_STEP_PROCESS,
        {},
        this.config.get<string>('JOURNEY_STEP_CRON', '* * * * *'),
      );
      await this.queue.addRepeatable(
        JobType.ABANDONED_CART_SCAN,
        {},
        this.config.get<string>('ABANDONED_CART_CRON', '*/15 * * * *'),
      );
      await this.queue.addRepeatable(
        JobType.INACTIVITY_SCAN,
        {},
        this.config.get<string>('INACTIVITY_SCAN_CRON', '0 8 * * 1'),
      );
      await this.queue.addRepeatable(
        JobType.MARKETING_POINTS_EXPIRY_WARNING,
        {},
        this.config.get<string>('POINTS_EXPIRY_WARNING_CRON', '0 7 * * *'),
      );
      this.logger.log('Marketing automation cron jobs scheduled');
    } catch (e) {
      this.logger.warn(`Marketing cron schedule failed: ${(e as Error).message}`);
    }
  }

  private async runAbandonedCartScan(): Promise<void> {
    const thresholdMin = this.config.get<number>('ABANDONED_CART_THRESHOLD_MINUTES', 60);
    const since = new Date(Date.now() - thresholdMin * 60 * 1000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const carts = await this.prisma.cart.findMany({
      where: {
        userId: { not: null },
        updatedAt: { lt: since },
        items: { some: {} },
        OR: [{ abandonedEmailSentAt: null }, { abandonedEmailSentAt: { lt: dayAgo } }],
      },
      include: { items: true },
    });

    for (const cart of carts) {
      if (!cart.userId) continue;
      const paidAfter = await this.prisma.order.findFirst({
        where: {
          userId: cart.userId,
          paymentStatus: 'PAID',
          createdAt: { gt: cart.updatedAt },
        },
      });
      if (paidAfter) continue;

      await this.bus.emit('CART_ABANDONED', cart.userId, {
        cartId: cart.id,
        userId: cart.userId,
        itemCount: cart.items.length,
        cartTotal: Number(cart.total).toFixed(2),
      });

      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { abandonedEmailSentAt: new Date() },
      });
    }
  }

  private async runInactivityScan(): Promise<void> {
    const days = this.config.get<number>('INACTIVITY_DAYS_THRESHOLD', 60);
    const since = new Date(Date.now() - days * 86400000);

    const memberships = await this.prisma.loyaltyMembership.findMany({
      where: {
        user: {
          OR: [
            { lastLoginAt: { lt: since } },
            { lastLoginAt: null, updatedAt: { lt: since } },
          ],
        },
      },
      select: { userId: true },
    });

    for (const m of memberships) {
      const recentOrder = await this.prisma.order.findFirst({
        where: {
          userId: m.userId,
          paymentStatus: 'PAID',
          createdAt: { gte: since },
        },
      });
      if (recentOrder) continue;

      const activeWinBack = await this.prisma.journeyEnrollment.findFirst({
        where: {
          userId: m.userId,
          status: 'ACTIVE',
          journey: { slug: 'win-back' },
        },
      });
      if (activeWinBack) continue;

      const lastPaid = await this.prisma.order.findFirst({
        where: { userId: m.userId, paymentStatus: 'PAID' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      const lastPurchaseDate = lastPaid?.createdAt
        ? lastPaid.createdAt.toISOString().split('T')[0]
        : '';
      const daysSince = lastPaid?.createdAt
        ? Math.floor((Date.now() - lastPaid.createdAt.getTime()) / 86400000)
        : days;

      await this.bus.emit('MEMBER_INACTIVE', m.userId, {
        userId: m.userId,
        lastPurchaseDate,
        daysSinceLastPurchase: String(daysSince),
      });
    }
  }

  private async runPointsExpiryWarningScan(): Promise<void> {
    const expiryMonths = this.config.get<number>('LOYALTY_POINTS_EXPIRY_MONTHS', 0);
    if (expiryMonths <= 0) return;

    const txs = await this.prisma.loyaltyTransaction.findMany({
      where: {
        type: LoyaltyTxType.EARN,
        expiresAt: null,
        points: { gt: 0 },
      },
      include: { membership: { include: { user: { select: { id: true } } } } },
      take: 500,
    });

    const now = new Date();
    const emittedUsers = new Set<string>();
    for (const tx of txs) {
      const userId = tx.membership.userId;
      if (emittedUsers.has(userId)) continue;

      const expiryAt = new Date(tx.createdAt);
      expiryAt.setMonth(expiryAt.getMonth() + expiryMonths);
      const warnAt = new Date(expiryAt);
      warnAt.setDate(warnAt.getDate() - 30);
      if (now < warnAt || now > expiryAt) continue;

      const recentEnrollment = await this.prisma.journeyEnrollment.findFirst({
        where: {
          userId,
          journey: { slug: 'points-expiry-warning' },
          startedAt: { gte: new Date(Date.now() - 7 * 86400000) },
        },
      });
      if (recentEnrollment) {
        emittedUsers.add(userId);
        continue;
      }

      await this.bus.emit('POINTS_EXPIRY_WARNING', userId, {
        expiringPoints: tx.points,
        expiryDate: expiryAt.toISOString(),
        membershipId: tx.membershipId,
        pointsStillExpiring: true,
      });
      emittedUsers.add(userId);
    }
  }
}
