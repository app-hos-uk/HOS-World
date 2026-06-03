import { Module } from '@nestjs/common';
import { VendorProductsController } from './vendor-products.controller';
import { VendorProductsService } from './vendor-products.service';
import { DatabaseModule } from '../database/database.module';
import { SellersModule } from '../sellers/sellers.module';

@Module({
  imports: [DatabaseModule, SellersModule],
  controllers: [VendorProductsController],
  providers: [VendorProductsService],
  exports: [VendorProductsService],
})
export class VendorProductsModule {}
