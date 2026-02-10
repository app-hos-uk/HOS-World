import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ActivityModule } from './activity/activity.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SupportModule } from './support/support.module';
import { GdprModule } from './gdpr/gdpr.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { IntegrationsModule } from './integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule.register({ serviceName: 'admin-service' }),
    EventBusModule.register({ serviceName: 'admin-service', redisUrl: process.env.REDIS_URL || 'redis://localhost:6379' }),
    DatabaseModule,
    HealthModule,
    ActivityModule,
    AnalyticsModule,
    SupportModule,
    GdprModule,
    WebhooksModule,
    IntegrationsModule,
  ],
})
export class AppModule {}
