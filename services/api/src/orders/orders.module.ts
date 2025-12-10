import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CurrencyModule } from '../currency/currency.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CurrencyModule, CacheModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}


