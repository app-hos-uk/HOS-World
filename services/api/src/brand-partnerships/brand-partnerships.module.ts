import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { SegmentationModule } from '../segmentation/segmentation.module';
import { JourneyModule } from '../journeys/journey.module';
import { BrandPartnershipsService } from './brand-partnerships.service';
import { BrandPartnershipsAdminController } from './brand-partnerships-admin.controller';
import { BrandPartnershipsController } from './brand-partnerships.controller';
import { BrandCampaignJobsService } from './jobs/brand-campaign.jobs';

@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, SegmentationModule, JourneyModule],
  controllers: [BrandPartnershipsAdminController, BrandPartnershipsController],
  providers: [BrandPartnershipsService, BrandCampaignJobsService],
  exports: [BrandPartnershipsService],
})
export class BrandPartnershipsModule {}
