import { Module } from '@nestjs/common';
import { InfluencerCommissionsService } from './influencer-commissions.service';
import { InfluencerCommissionsController } from './influencer-commissions.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [InfluencerCommissionsController],
  providers: [InfluencerCommissionsService],
  exports: [InfluencerCommissionsService],
})
export class InfluencerCommissionsModule {}
