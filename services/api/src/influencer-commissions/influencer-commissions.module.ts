import { Module, forwardRef } from '@nestjs/common';
import { InfluencerCommissionsService } from './influencer-commissions.service';
import { InfluencerCommissionsController } from './influencer-commissions.controller';
import { DatabaseModule } from '../database/database.module';
import { AmbassadorModule } from '../ambassador/ambassador.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => AmbassadorModule)],
  controllers: [InfluencerCommissionsController],
  providers: [InfluencerCommissionsService],
  exports: [InfluencerCommissionsService],
})
export class InfluencerCommissionsModule {}
