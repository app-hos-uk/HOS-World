import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType;
  private isConnected = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL') || 'redis://localhost:6379';

    // Don't block startup - connect in background
    // Return immediately so NestJS doesn't wait
    (async () => {
      try {
        this.client = createClient({
          url: redisUrl,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > 10) {
                this.logger.error('Redis connection failed after 10 retries');
                return new Error('Redis connection failed');
              }
              return Math.min(retries * 100, 3000);
            },
          },
        });

        this.client.on('error', (err) => {
          this.logger.error('Redis client error:', err);
          this.isConnected = false;
        });

        this.client.on('connect', () => {
          this.logger.log('Redis client connecting...');
        });

        this.client.on('ready', () => {
          this.logger.log('Redis client ready');
          this.isConnected = true;
        });

        await this.client.connect();
      } catch (error: any) {
        this.logger.warn(
          `Redis connection failed, using fallback: ${error?.message || 'Unknown error'}`,
          'RedisService',
        );
        this.logger.debug(error?.stack, 'RedisService');
        this.isConnected = false;
      }
    })().catch((error: any) => {
      this.logger.error(
        `Redis initialization error: ${error?.message || 'Unknown error'}`,
        'RedisService',
      );
      this.logger.debug(error?.stack, 'RedisService');
      this.isConnected = false;
    });
    // Return immediately - don't wait for connection
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.logger.log('Redis client disconnected');
    }
  }

  /**
   * Get Redis client instance
   */
  getClient(): RedisClientType | null {
    return this.isConnected ? this.client : null;
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Set value with expiration
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error(`Failed to set Redis key ${key}:`, error);
    }
  }

  /**
   * Get value
   */
  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Failed to get Redis key ${key}:`, error);
      return null;
    }
  }

  /**
   * Delete key
   */
  async del(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete Redis key ${key}:`, error);
    }
  }

  /**
   * Delete keys matching pattern (uses KEYS — acceptable for low-cardinality patterns)
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      this.logger.error(`Failed to delete Redis keys matching ${pattern}:`, error);
    }
  }

  /**
   * Delete keys matching pattern using SCAN (non-blocking, production-safe).
   * Iterates the keyspace in batches of 100 to avoid blocking the Redis server.
   */
  async deleteByPattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;

    let deleted = 0;
    try {
      let cursor = 0;
      do {
        const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result.cursor;
        if (result.keys.length > 0) {
          await this.client.del(result.keys);
          deleted += result.keys.length;
        }
      } while (cursor !== 0);
    } catch (error) {
      this.logger.error(`Failed to deleteByPattern Redis keys matching ${pattern}:`, error);
    }
    return deleted;
  }

  /**
   * Set hash field
   */
  async hSet(key: string, field: string, value: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.hSet(key, field, value);
    } catch (error) {
      this.logger.error(`Failed to set Redis hash ${key}.${field}:`, error);
    }
  }

  /**
   * Get hash field
   */
  async hGet(key: string, field: string): Promise<string | null> {
    if (!this.isConnected) return null;

    try {
      return await this.client.hGet(key, field);
    } catch (error) {
      this.logger.error(`Failed to get Redis hash ${key}.${field}:`, error);
    }
    return null;
  }

  /**
   * Increment value (useful for rate limiting, counters)
   */
  async incr(key: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Failed to increment Redis key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Increment with expiration (useful for rate limiting)
   */
  async incrEx(key: string, ttl: number): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const count = await this.client.incr(key);
      if (count === 1) {
        // First increment, set expiration
        await this.client.expire(key, ttl);
      }
      return count;
    } catch (error) {
      this.logger.error(`Failed to increment Redis key ${key} with TTL:`, error);
      return 0;
    }
  }

  /**
   * Set expiration on existing key
   */
  async expire(key: string, ttl: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      this.logger.error(`Failed to set expiration on Redis key ${key}:`, error);
    }
  }

  // ==================== Sorted Set Operations ====================

  /**
   * Add member to sorted set with score
   * @param key - The sorted set key
   * @param score - The score for the member
   * @param member - The member value
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.client.zAdd(key, { score, value: member });
    } catch (error) {
      this.logger.error(`Failed to zadd to Redis sorted set ${key}:`, error);
      return 0;
    }
  }

  /**
   * Remove member from sorted set
   * @param key - The sorted set key
   * @param member - The member to remove
   */
  async zrem(key: string, member: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.client.zRem(key, member);
    } catch (error) {
      this.logger.error(`Failed to zrem from Redis sorted set ${key}:`, error);
      return 0;
    }
  }

  /**
   * Get members from sorted set by score range
   *
   * NOTE: Uses zRange with BY: 'SCORE' instead of zRangeByScore.
   * zRangeByScore has a known bug in node-redis v4.x where LIMIT options
   * can return empty arrays. zRange with BY: 'SCORE' is the recommended approach.
   *
   * @param key - The sorted set key
   * @param minScore - Minimum score (inclusive)
   * @param maxScore - Maximum score (inclusive)
   * @param offset - Optional offset for pagination
   * @param count - Optional count for pagination
   */
  async zrangebyscore(
    key: string,
    minScore: number,
    maxScore: number,
    offset?: number,
    count?: number,
  ): Promise<string[]> {
    if (!this.isConnected) return [];

    try {
      // Use zRange with BY: 'SCORE' - this is the recommended approach in node-redis v4
      // zRangeByScore has known issues with LIMIT options in some versions
      const options: {
        BY: 'SCORE';
        LIMIT?: { offset: number; count: number };
      } = {
        BY: 'SCORE',
      };

      if (offset !== undefined && count !== undefined) {
        options.LIMIT = { offset, count };
      }

      return await this.client.zRange(key, minScore, maxScore, options);
    } catch (error) {
      this.logger.error(`Failed to zrangebyscore from Redis sorted set ${key}:`, error);
      return [];
    }
  }

  /**
   * Get the number of members in a sorted set
   * @param key - The sorted set key
   */
  async zcard(key: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      return await this.client.zCard(key);
    } catch (error) {
      this.logger.error(`Failed to zcard Redis sorted set ${key}:`, error);
      return 0;
    }
  }

  // ==================== Atomic Operations for Distributed Locking ====================

  /**
   * Set a key only if it doesn't exist (SETNX) with optional TTL
   * Used for distributed locking across multiple server instances.
   *
   * @param key - The key to set
   * @param value - The value to set
   * @param ttlSeconds - Optional TTL in seconds (prevents deadlocks)
   * @returns true if the key was set, false if it already existed
   */
  async setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      // Use SET with NX (only set if not exists) and optionally EX (expire) flags
      // This is atomic and race-condition safe
      // Build options object conditionally to avoid passing undefined values
      const options: { NX: true; EX?: number } = { NX: true };

      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        options.EX = ttlSeconds;
      }

      const result = await this.client.set(key, value, options);

      // Redis returns 'OK' if set, null if key already existed
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Failed to setNX Redis key ${key}:`, error);
      return false;
    }
  }
}
