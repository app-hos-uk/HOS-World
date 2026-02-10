import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { CmsModule } from './cms/cms.module';
import { PromotionsModule } from './promotions/promotions.module';
import { GamificationModule } from './gamification/gamification.module';
import { FandomsModule } from './fandoms/fandoms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule.register({ serviceName: 'content-service' }),
    EventBusModule.register({ serviceName: 'content-service', redisUrl: process.env.REDIS_URL || 'redis://localhost:6379' }),
    DatabaseModule,
    HealthModule,
    CmsModule,
    PromotionsModule,
    GamificationModule,
    FandomsModule,
  ],
})
export class AppModule {}
