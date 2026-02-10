import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ElasticSearchModule } from './elasticsearch/search.module';
import { MeilisearchModule } from './meilisearch/meilisearch.module';
import { EventHandlersController } from './event-handlers.controller';
import { HealthModule } from './health/health.module';

/**
 * Search Microservice - App Module
 *
 * This microservice handles all search-related concerns:
 * - Elasticsearch product search with advanced filtering
 * - Meilisearch product search with typo tolerance
 * - Event-driven index synchronization
 *
 * It connects to the same PostgreSQL database as the monolith during
 * the migration period for fallback search and product data access.
 *
 * It also connects to Redis as a microservice transport to listen
 * for product domain events and keep indexes in sync.
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

    // Core
    DatabaseModule,

    // Feature modules
    ElasticSearchModule,
    MeilisearchModule,

    // Infra
    HealthModule,
  ],
  controllers: [EventHandlersController],
})
export class AppModule {}
