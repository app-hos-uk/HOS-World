import { Module, forwardRef } from '@nestjs/common';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { DatabaseModule } from '../database/database.module';
import { CourierModule } from './courier/courier.module';

@Module({
  imports: [DatabaseModule, forwardRef(() => CourierModule)],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
