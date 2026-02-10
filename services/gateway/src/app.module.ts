import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

    // Rate limiting (global)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,  // 1 second window
        limit: 20,  // 20 requests per second
      },
      {
        name: 'medium',
        ttl: 10000, // 10 second window
        limit: 100, // 100 requests per 10 seconds
      },
      {
        name: 'long',
        ttl: 60000, // 1 minute window
        limit: 300, // 300 requests per minute
      },
    ]),

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
