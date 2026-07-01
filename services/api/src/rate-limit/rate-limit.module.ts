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

        // Rate limiting can only ever be disabled OUTSIDE production. This is
        // computed once at startup so it can never be flipped on in prod, even
        // if NODE_ENV or the opt-in flag is misconfigured at request time.
        const nodeEnv = configService.get<string>('NODE_ENV');
        const optedOut =
          nodeEnv === 'test' || configService.get('DISABLE_RATE_LIMIT') === 'true';
        const rateLimitDisabled = nodeEnv !== 'production' && optedOut;

        const options: ThrottlerModuleOptions = {
          throttlers: [{ ttl, limit }],
          // When disabled, this is evaluated by the guard itself, so it also
          // bypasses per-route @Throttle() decorators (e.g. auth limits).
          // Always false in production.
          skipIf: () => rateLimitDisabled,
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
