import { Module, forwardRef } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { AmbassadorModule } from '../ambassador/ambassador.module';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { TaxModule } from '../tax/tax.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CartModule } from '../cart/cart.module';
import { PaymentProviderModule } from '../payments/payment-provider.module';
import { ShippingModule } from '../shipping/shipping.module';
import { PromotionsModule } from '../promotions/promotions.module';

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
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
