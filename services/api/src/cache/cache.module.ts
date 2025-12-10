import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { ErrorCacheService } from './error-cache.service';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { DatabaseModule } from '../database/database.module';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        // Use in-memory cache by default
        // Redis caching is handled by RedisService for more control
        return {
          ttl: 3600, // Default TTL 1 hour
          max: 1000, // Maximum number of items in cache
        };
      },
      inject: [ConfigService],
    }),
    DatabaseModule,
  ],
  providers: [CacheService, ErrorCacheService, RedisService],
  exports: [CacheService, ErrorCacheService, RedisService],
})
export class CacheModule {}

