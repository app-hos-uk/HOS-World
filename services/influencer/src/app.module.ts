import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from '@hos-marketplace/observability';
import { EventBusModule } from '@hos-marketplace/events';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { InfluencersModule } from './influencers/influencers.module';
import { StorefrontsModule } from './storefronts/storefronts.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ReferralsModule } from './referrals/referrals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule.register({ serviceName: 'influencer-service' }),
    EventBusModule.register({ name: 'influencer-service', url: process.env.REDIS_URL || 'redis://localhost:6379' }),
    DatabaseModule,
    HealthModule,
    InfluencersModule,
    StorefrontsModule,
    CampaignsModule,
    ReferralsModule,
  ],
})
export class AppModule {}
