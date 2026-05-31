import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard, ThrottlerModuleOptions } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): ThrottlerModuleOptions => {
        const ttl = Number(configService.get('RATE_LIMIT_TTL')) || 60000;
        const limit = Number(configService.get('RATE_LIMIT_MAX')) || 100;
        const redisUrl = configService.get<string>('REDIS_URL');
        const options: ThrottlerModuleOptions = {
          throttlers: [{ ttl, limit }],
        };
        if (redisUrl) {
          options.storage = new RedisThrottlerStorage(redisUrl);
        }
        return options;
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class RateLimitModule {}
