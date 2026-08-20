import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { PosModule } from '../pos/pos.module';
import { CourierModule } from '../shipping/courier/courier.module';
import { PaymentProviderModule } from '../payments/payment-provider.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { StoreShipmentService } from './store-shipment.service';
import { SkuCustomsService } from './sku-customs.service';
import { StoreShipmentController, StoreShipmentAdminController } from './store-shipment.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    forwardRef(() => PosModule),
    CourierModule,
    PaymentProviderModule,
    NotificationsModule,
    forwardRef(() => LoyaltyModule),
  ],
  controllers: [StoreShipmentController, StoreShipmentAdminController],
  providers: [StoreShipmentService, SkuCustomsService],
  exports: [StoreShipmentService, SkuCustomsService],
})
export class StoreShipmentModule {}
