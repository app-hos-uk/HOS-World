import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GiftCardsController } from './gift-cards.controller';
import { GiftCardsService } from './gift-cards.service';
import { GiftCardsSchedulerService } from './gift-cards-scheduler.service';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [ConfigModule, forwardRef(() => LoyaltyModule)],
  controllers: [GiftCardsController],
  providers: [GiftCardsService, GiftCardsSchedulerService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
