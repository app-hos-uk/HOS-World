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
    } catch (error) {
      this.logger.warn('Redis connection failed, using fallback:', error.message);
      this.isConnected = false;
    }
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
   * Delete keys matching pattern
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
}

