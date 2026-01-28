import { Module } from '@nestjs/common';
import { InfluencerStorefrontsService } from './influencer-storefronts.service';
import { InfluencerStorefrontsController } from './influencer-storefronts.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InfluencerStorefrontsController],
  providers: [InfluencerStorefrontsService],
  exports: [InfluencerStorefrontsService],
})
export class InfluencerStorefrontsModule {}
