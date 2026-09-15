import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GiftCardsService } from './gift-cards.service';
import { RedisService } from '../cache/redis.service';

@Injectable()
export class GiftCardsSchedulerService {
  private readonly logger = new Logger(GiftCardsSchedulerService.name);

  constructor(
    private readonly giftCardsService: GiftCardsService,
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

  @Cron('0 * * * *')
  async expireOverdueGiftCards(): Promise<void> {
    await this.runWithLock('cron:gift-card-expiry', 300, async () => {
      try {
        await this.giftCardsService.expireOverdueGiftCards();
      } catch (err) {
        this.logger.warn(`Gift card expiry job failed: ${(err as Error).message}`);
      }
    });
  }
}
