import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ProductCampaignsService } from './product-campaigns.service';
import { ProductCampaignsController } from './product-campaigns.controller';
import { ProductCampaignJobsService } from './jobs/product-campaign.jobs';

@Module({
  imports: [DatabaseModule, QueueModule, ConfigModule],
  controllers: [ProductCampaignsController],
  providers: [ProductCampaignsService, ProductCampaignJobsService],
  exports: [ProductCampaignsService],
})
export class ProductCampaignsModule {}
