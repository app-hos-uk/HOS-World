import { Module, forwardRef } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { ReturnsEnhancementsService } from './returns-enhancements.service';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    FinanceModule,
    forwardRef(() => NotificationsModule),
    ActivityModule,
    InventoryModule,
  ],
  controllers: [ReturnsController],
  providers: [ReturnsService, ReturnsEnhancementsService],
  exports: [ReturnsService, ReturnsEnhancementsService],
})
export class ReturnsModule {}
