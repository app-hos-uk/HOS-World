import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { LoyaltyAnalyticsService } from './loyalty-analytics.service';
import { LoyaltyAnalyticsController } from './loyalty-analytics.controller';
import { AnalyticsJobsService } from './jobs/analytics.jobs';

@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, forwardRef(() => LoyaltyModule)],
  controllers: [LoyaltyAnalyticsController],
  providers: [LoyaltyAnalyticsService, AnalyticsJobsService],
  exports: [LoyaltyAnalyticsService],
})
export class LoyaltyAnalyticsModule {}
