import { Module, forwardRef } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PromotionsModule } from '../promotions/promotions.module';
import { ShippingModule } from '../shipping/shipping.module';
import { TaxModule } from '../tax/tax.module';

@Module({
  imports: [
    forwardRef(() => PromotionsModule),
    forwardRef(() => ShippingModule),
    TaxModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}


