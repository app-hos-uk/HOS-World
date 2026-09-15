import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';

const RETENTION_DAYS = 90;

@Injectable()
export class ProductViewSchedulerService {
  private readonly logger = new Logger(ProductViewSchedulerService.name);

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

  @Cron('0 4 * * *')
  async cleanupOldProductViews(): Promise<void> {
    await this.runWithLock('cron:product-view-cleanup', 600, async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

      const deleted = await this.prisma.productView.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });

      this.logger.log(
        `ProductView cleanup: removed ${deleted.count} records older than ${RETENTION_DAYS} days`,
      );
    });
  }
}
