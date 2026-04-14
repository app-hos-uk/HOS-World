import { Module } from '@nestjs/common';
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
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
