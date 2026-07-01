import { Module, forwardRef } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { AmbassadorModule } from '../ambassador/ambassador.module';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersSchedulerService } from './orders-scheduler.service';
import { TaxModule } from '../tax/tax.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CartModule } from '../cart/cart.module';
import { PaymentProviderModule } from '../payments/payment-provider.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { VendorLedgerModule } from '../vendor-ledger/vendor-ledger.module';
import { CancellationsModule } from '../cancellations/cancellations.module';

@Module({
  imports: [
    ConfigModule,
    TaxModule,
    InventoryModule,
    CartModule,
    PaymentProviderModule,
    ShippingModule,
    PromotionsModule,
    forwardRef(() => LoyaltyModule),
    forwardRef(() => AmbassadorModule),
    forwardRef(() => NotificationsModule),
    ActivityModule,
    VendorLedgerModule,
    FinanceModule,
    forwardRef(() => CancellationsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersSchedulerService],
  exports: [OrdersService],
})
export class OrdersModule {}
