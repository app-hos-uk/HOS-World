import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { PartnerReferralsService } from './partner-referrals.service';
import { PartnerReferralsAdminController } from './partner-referrals-admin.controller';
import { PartnerReferralsController } from './partner-referrals.controller';
import { PartnerUrlService } from './services/partner-url.service';
import { PartnerIncentiveService } from './services/partner-incentive.service';
import { PartnerAnalyticsService } from './services/partner-analytics.service';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [PartnerReferralsAdminController, PartnerReferralsController],
  providers: [
    PartnerReferralsService,
    PartnerUrlService,
    PartnerIncentiveService,
    PartnerAnalyticsService,
  ],
  exports: [PartnerReferralsService, PartnerIncentiveService],
})
export class PartnerReferralsModule {}
