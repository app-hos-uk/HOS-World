import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';

/**
 * Auth Microservice - App Module
 *
 * This microservice handles all authentication concerns:
 * - User registration (customer, seller, wholesaler)
 * - Login with email/password
 * - JWT token generation and refresh
 * - OAuth account linking
 * - Character selection and fandom quiz
 * - GDPR consent logging
 *
 * It connects to the same PostgreSQL database as the monolith during
 * the migration period using its own Prisma client.
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
    ObservabilityModule.register({ serviceName: 'auth-service' }),
    EventBusModule.register({ serviceName: 'auth-service', redisUrl: process.env.REDIS_URL }),
    DatabaseModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
