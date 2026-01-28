import { Module } from '@nestjs/common';
import { InfluencerCampaignsService } from './influencer-campaigns.service';
import { InfluencerCampaignsController } from './influencer-campaigns.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InfluencerCampaignsController],
  providers: [InfluencerCampaignsService],
  exports: [InfluencerCampaignsService],
})
export class InfluencerCampaignsModule {}
