import { Module, forwardRef } from '@nestjs/common';
import { CancellationsController } from './cancellations.controller';
import { CancellationsService } from './cancellations.service';
import { OrdersModule } from '../orders/orders.module';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => OrdersModule),
    FinanceModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [CancellationsController],
  providers: [CancellationsService],
  exports: [CancellationsService],
})
export class CancellationsModule {}
