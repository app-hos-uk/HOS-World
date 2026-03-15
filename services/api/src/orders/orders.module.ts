import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { TaxModule } from '../tax/tax.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [ConfigModule, TaxModule, InventoryModule, CartModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
