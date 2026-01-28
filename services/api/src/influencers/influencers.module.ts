import { Module } from '@nestjs/common';
import { InfluencersService } from './influencers.service';
import { InfluencersController } from './influencers.controller';
import { DatabaseModule } from '../database/database.module';
import { InfluencerStorefrontsModule } from '../influencer-storefronts/influencer-storefronts.module';

@Module({
  imports: [DatabaseModule, InfluencerStorefrontsModule],
  controllers: [InfluencersController],
  providers: [InfluencersService],
  exports: [InfluencersService],
})
export class InfluencersModule {}
