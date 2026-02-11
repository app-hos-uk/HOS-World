import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { MeilisearchModule } from './meilisearch/meilisearch.module';
import { EventHandlersController } from './event-handlers.controller';
import { HealthModule } from './health/health.module';

/**
 * Search Microservice - App Module
 *
 * This microservice handles all search-related concerns:
 * - Meilisearch product search (primary) with typo tolerance and faceted filtering
 * - Event-driven index synchronization
 *
 * It connects to the same PostgreSQL database as the monolith during
 * the migration period for fallback search and product data access.
 *
 * It also connects to Redis as a microservice transport to listen
 * for product domain events and keep the Meilisearch index in sync.
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
    ObservabilityModule.register({ serviceName: 'search-service' }),
    EventBusModule.register({ serviceName: 'search-service', redisUrl: process.env.REDIS_URL }),

    // Core
    DatabaseModule,

    // Feature modules (Meilisearch only)
    MeilisearchModule,

    // Infra
    HealthModule,
  ],
  controllers: [EventHandlersController],
})
export class AppModule {}
