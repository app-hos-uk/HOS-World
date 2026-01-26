import { Module } from '@nestjs/common';
import { DigitalProductsController } from './digital-products.controller';
import { DigitalProductsService } from './digital-products.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DigitalProductsController],
  providers: [DigitalProductsService],
  exports: [DigitalProductsService],
})
export class DigitalProductsModule {}
