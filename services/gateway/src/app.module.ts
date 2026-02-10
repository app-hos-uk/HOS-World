import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ProxyModule } from './proxy/proxy.module';
import { HealthModule } from './health/health.module';

/**
 * Gateway App Module
 *
 * The API Gateway is a lightweight NestJS application that:
 * 1. Validates JWT tokens centrally
 * 2. Routes requests to the appropriate microservice
 * 3. Applies rate limiting and security headers
 * 4. Provides aggregated health checks
 *
 * During migration, ALL requests are proxied to the monolith.
 * As microservices are extracted, their routes are redirected via
 * environment variables (e.g., AUTH_SERVICE_URL).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true'
          ? undefined
          : '.env',
      ignoreEnvFile:
        process.env.NODE_ENV === 'test' || process.env.IGNORE_ENV_FILE === 'true',
    }),

    // Rate limiting (global). Override via env: THROTTLE_TTL_SHORT, THROTTLE_LIMIT_SHORT, etc.
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const num = (key: string, fallback: number) =>
          parseInt(config.get(key) ?? '', 10) || fallback;
        return [
          {
            name: 'short',
            ttl: num('THROTTLE_TTL_SHORT', 1000),
            limit: num('THROTTLE_LIMIT_SHORT', 20),
          },
          {
            name: 'medium',
            ttl: num('THROTTLE_TTL_MEDIUM', 10000),
            limit: num('THROTTLE_LIMIT_MEDIUM', 100),
          },
          {
            name: 'long',
            ttl: num('THROTTLE_TTL_LONG', 60000),
            limit: num('THROTTLE_LIMIT_LONG', 300),
          },
        ];
      },
    }),

    HealthModule,
    ProxyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
