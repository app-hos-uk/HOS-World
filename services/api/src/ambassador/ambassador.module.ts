import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { SegmentationModule } from '../segmentation/segmentation.module';
import { JourneyModule } from '../journeys/journey.module';
import { AmbassadorService } from './ambassador.service';
import { AmbassadorController } from './ambassador.controller';
import { AmbassadorAdminController } from './ambassador-admin.controller';
import { AmbassadorAchievementService } from './achievements/achievement.service';
import { AmbassadorJobsService } from './jobs/ambassador.jobs';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    QueueModule,
    SegmentationModule,
    JourneyModule,
    forwardRef(() => LoyaltyModule),
  ],
  controllers: [AmbassadorController, AmbassadorAdminController],
  providers: [AmbassadorAchievementService, AmbassadorService, AmbassadorJobsService],
  exports: [AmbassadorService],
})
export class AmbassadorModule {}
