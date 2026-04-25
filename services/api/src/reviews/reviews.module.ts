import { Module, forwardRef } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ProductsModule } from '../products/products.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [ProductsModule, forwardRef(() => LoyaltyModule)],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
