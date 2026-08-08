import { Module, forwardRef } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { ReturnsEnhancementsService } from './returns-enhancements.service';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ReturnPoliciesModule } from '../return-policies/return-policies.module';
import { RETURN_FULFILMENT } from './return-fulfilment.token';

@Module({
  imports: [
    FinanceModule,
    ReturnPoliciesModule,
    forwardRef(() => NotificationsModule),
    ActivityModule,
    InventoryModule,
  ],
  controllers: [ReturnsController],
  providers: [
    ReturnsService,
    ReturnsEnhancementsService,
    { provide: RETURN_FULFILMENT, useExisting: ReturnsService },
  ],
  exports: [ReturnsService, ReturnsEnhancementsService, RETURN_FULFILMENT],
})
export class ReturnsModule {}
