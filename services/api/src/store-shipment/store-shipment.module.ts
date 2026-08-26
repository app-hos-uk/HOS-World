import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { PosModule } from '../pos/pos.module';
import { CourierModule } from '../shipping/courier/courier.module';
import { PaymentProviderModule } from '../payments/payment-provider.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { FeatureFlagsModule } from '../config/feature-flags.module';
import { StoreShipmentService } from './store-shipment.service';
import { SkuCustomsService } from './sku-customs.service';
import { BoxSizeService } from './box-size.service';
import { ShippingSlipService } from './shipping-slip.service';
import { ShippingWorkflowService } from './shipping-workflow.service';
import { StoreShipmentController, StoreShipmentAdminController, BoxSizeAdminController, ShippingRatesAdminController } from './store-shipment.controller';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => PosModule),
    CourierModule,
    PaymentProviderModule,
    NotificationsModule,
    FeatureFlagsModule,
    forwardRef(() => LoyaltyModule),
  ],
  controllers: [StoreShipmentController, StoreShipmentAdminController, BoxSizeAdminController, ShippingRatesAdminController],
  providers: [
    StoreShipmentService,
    SkuCustomsService,
    BoxSizeService,
    ShippingSlipService,
    ShippingWorkflowService,
  ],
  exports: [StoreShipmentService, SkuCustomsService, BoxSizeService, ShippingWorkflowService],
})
export class StoreShipmentModule {}
