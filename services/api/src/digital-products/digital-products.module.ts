import { Module } from '@nestjs/common';
import { DigitalProductsController } from './digital-products.controller';
import { DigitalProductsService } from './digital-products.service';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [DatabaseModule, StorageModule],
  controllers: [DigitalProductsController],
  providers: [DigitalProductsService],
  exports: [DigitalProductsService],
})
export class DigitalProductsModule {}
