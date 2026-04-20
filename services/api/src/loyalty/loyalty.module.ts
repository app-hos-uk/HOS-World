import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyAdminController } from './loyalty-admin.controller';
import { LoyaltyPosController } from './loyalty-pos.controller';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyWalletService } from './services/wallet.service';
import { LoyaltyCampaignService } from './services/campaign.service';
import { LoyaltyReferralService } from './services/referral.service';
import { LoyaltyEventService } from './services/loyalty-event.service';
import { LoyaltyBurnEngine } from './engines/burn.engine';
import { LoyaltyEarnEngine } from './engines/earn.engine';
import { LoyaltyTierEngine } from './engines/tier.engine';
import { LoyaltyJobsService } from './jobs/loyalty.jobs';
import { LoyaltyListener } from './listeners/loyalty.listener';
import { LoyaltyStaffAuthGuard } from './guards/loyalty-staff-auth.guard';
import { FandomProfileService } from './services/fandom-profile.service';
import { JourneyModule } from '../journeys/journey.module';
import { SegmentationModule } from '../segmentation/segmentation.module';
import { AmbassadorModule } from '../ambassador/ambassador.module';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ConfigModule,
    forwardRef(() => JourneyModule),
    forwardRef(() => AmbassadorModule),
    SegmentationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'dev-insecure-placeholder',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [LoyaltyController, LoyaltyAdminController, LoyaltyPosController],
  providers: [
    LoyaltyWalletService,
    LoyaltyCampaignService,
    LoyaltyReferralService,
    LoyaltyEventService,
    LoyaltyTierEngine,
    LoyaltyBurnEngine,
    LoyaltyEarnEngine,
    LoyaltyService,
    LoyaltyJobsService,
    LoyaltyListener,
    LoyaltyStaffAuthGuard,
    FandomProfileService,
  ],
  exports: [LoyaltyService, LoyaltyEarnEngine, LoyaltyListener, LoyaltyWalletService, LoyaltyTierEngine, FandomProfileService],
})
export class LoyaltyModule {}
