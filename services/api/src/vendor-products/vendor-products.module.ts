import { Module } from '@nestjs/common';
import { VendorProductsController } from './vendor-products.controller';
import { VendorProductsService } from './vendor-products.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [VendorProductsController],
  providers: [VendorProductsService],
  exports: [VendorProductsService],
})
export class VendorProductsModule {}
