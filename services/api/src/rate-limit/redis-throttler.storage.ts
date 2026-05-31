import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  }

  async onModuleDestroy() {
    await this.redis.quit().catch(() => {});
  }

  async increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
    const hits = await this.redis.incr(key);
    if (hits === 1) {
      await this.redis.pexpire(key, ttl);
    }
    const timeToExpire = await this.redis.pttl(key);
    return { totalHits: hits, timeToExpire: timeToExpire > 0 ? timeToExpire : ttl };
  }
}
