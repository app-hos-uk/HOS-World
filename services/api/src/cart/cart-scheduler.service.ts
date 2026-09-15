import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';

const GUEST_CART_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const EMPTY_USER_CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ABANDON_IDLE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class CartSchedulerService {
  private readonly logger = new Logger(CartSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private redisService?: RedisService,
  ) {}

  private async runWithLock(lockKey: string, ttlSeconds: number, fn: () => Promise<void>) {
    if (!this.redisService?.isRedisConnected()) {
      await fn();
      return;
    }
    let acquired = false;
    try {
      acquired = await this.redisService.setNX(lockKey, '1', ttlSeconds);
    } catch {
      await fn();
      return;
    }
    if (!acquired) {
      this.logger.debug(`Skipping ${lockKey} — another instance holds the lock`);
      return;
    }
    try {
      await fn();
    } finally {
      await this.redisService.del(lockKey).catch(() => {});
    }
  }

  @Cron('0 3 * * *')
  async cleanupStaleCarts(): Promise<void> {
    await this.runWithLock('cron:cart-cleanup', 300, async () => {
      const guestCutoff = new Date(Date.now() - GUEST_CART_MAX_AGE_MS);
      const guestDelete = await this.prisma.cart.deleteMany({
        where: {
          userId: null,
          updatedAt: { lt: guestCutoff },
        },
      });

      const emptyUserCutoff = new Date(Date.now() - EMPTY_USER_CART_MAX_AGE_MS);
      const staleEmpty = await this.prisma.cart.findMany({
        where: {
          userId: { not: null },
          updatedAt: { lt: emptyUserCutoff },
          items: { none: {} },
        },
        take: 5000,
        select: { id: true },
      });

      if (staleEmpty.length) {
        await this.prisma.cart.deleteMany({
          where: { id: { in: staleEmpty.map((c) => c.id) } },
        });
      }

      this.logger.log(
        `Cart cleanup: removed ${guestDelete.count} guest cart(s), ${staleEmpty.length} empty user cart(s)`,
      );
    });
  }

  @Cron('0 9 * * *')
  async logAbandonedCartStats(): Promise<void> {
    await this.runWithLock('cron:cart-stats', 120, async () => {
      const idleCutoff = new Date(Date.now() - ABANDON_IDLE_MS);

      const userCartsWithItems = await this.prisma.cart.count({
        where: {
          userId: { not: null },
          items: { some: {} },
        },
      });

      const pendingAbandonEmail = await this.prisma.cart.count({
        where: {
          userId: { not: null },
          abandonedEmailSentAt: null,
          updatedAt: { lt: idleCutoff },
          items: { some: {} },
        },
      });

      const emailed = await this.prisma.cart.count({
        where: {
          abandonedEmailSentAt: { not: null },
          items: { some: {} },
        },
      });

      this.logger.log(
        `Abandoned cart stats: user_carts_with_items=${userCartsWithItems} pending_email=${pendingAbandonEmail} carts_emailed=${emailed}`,
      );
    });
  }
}
