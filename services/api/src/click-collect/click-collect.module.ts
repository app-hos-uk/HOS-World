import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { InventoryModule } from '../inventory/inventory.module';
import { JourneyModule } from '../journeys/journey.module';
import { QueueModule } from '../queue/queue.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { ClickCollectService } from './click-collect.service';
import { ClickCollectAdminController } from './click-collect-admin.controller';
import { ClickCollectCustomerController } from './click-collect-customer.controller';
import { ClickCollectJobsService } from './jobs/click-collect.jobs';

@Module({
  imports: [
    DatabaseModule,
    InventoryModule,
    JourneyModule,
    QueueModule,
    ConfigModule,
    forwardRef(() => LoyaltyModule),
  ],
  controllers: [ClickCollectAdminController, ClickCollectCustomerController],
  providers: [ClickCollectService, ClickCollectJobsService],
  exports: [ClickCollectService],
})
export class ClickCollectModule {}
