import { Module, forwardRef } from '@nestjs/common';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { CartController } from './cart.controller';
import { GuestCartController } from './guest-cart.controller';
import { CartService } from './cart.service';
import { CartSchedulerService } from './cart-scheduler.service';
import { PromotionsModule } from '../promotions/promotions.module';
import { ShippingModule } from '../shipping/shipping.module';
import { TaxModule } from '../tax/tax.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => PromotionsModule),
    forwardRef(() => ShippingModule),
    forwardRef(() => LoyaltyModule),
    TaxModule,
    NotificationsModule,
  ],
  controllers: [CartController, GuestCartController],
  providers: [CartService, CartSchedulerService],
  exports: [CartService],
})
export class CartModule {}
