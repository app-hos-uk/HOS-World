import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { StoreOnboardingService } from './store-onboarding.service';
import { StoreAdminController } from './store-admin.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [StoreAdminController],
  providers: [StoreOnboardingService],
  exports: [StoreOnboardingService],
})
export class StoreAdminModule {}
