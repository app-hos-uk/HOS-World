import { Module } from '@nestjs/common';
import { InfluencerPayoutsService } from './influencer-payouts.service';
import { InfluencerPayoutsController } from './influencer-payouts.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InfluencerPayoutsController],
  providers: [InfluencerPayoutsService],
  exports: [InfluencerPayoutsService],
})
export class InfluencerPayoutsModule {}
