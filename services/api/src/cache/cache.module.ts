import { Module, Global, Logger } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

const cacheLogger = new Logger('CacheModule');

@Global()
@Module({
  imports: [
    ConfigModule,
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService): Promise<any> => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (redisUrl) {
          try {
            const { redisStore } = await import('cache-manager-redis-yet');
            const store = await redisStore({
              url: redisUrl,
              ttl: 3600 * 1000,
            });
            cacheLogger.log('Using Redis cache backend');
            return { store, ttl: 3600 * 1000 };
          } catch (err) {
            cacheLogger.warn(
              `cache-manager-redis-yet not available, falling back to in-memory: ${err}`,
            );
          }
        }
        cacheLogger.log('Using in-memory cache backend');
        return {
          ttl: 3600 * 1000,
          max: 1000,
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService, RedisService],
  exports: [CacheService, RedisService],
})
export class CacheModule {}
