import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ActivityModule } from '../activity/activity.module';
import { StoreOnboardingService } from './store-onboarding.service';
import { StoreAdminController } from './store-admin.controller';
import { PlatformSellerService } from './platform-seller.service';
import { StoreStaffController } from './store-staff.controller';
import { StoreStaffCustomerService } from './store-staff-customer.service';
import { StoreStaffGuard } from './guards/store-staff.guard';

@Module({
  imports: [DatabaseModule, ActivityModule],
  controllers: [StoreAdminController, StoreStaffController],
  providers: [
    StoreOnboardingService,
    PlatformSellerService,
    StoreStaffCustomerService,
    StoreStaffGuard,
  ],
  exports: [StoreOnboardingService, PlatformSellerService],
})
export class StoreAdminModule {}
