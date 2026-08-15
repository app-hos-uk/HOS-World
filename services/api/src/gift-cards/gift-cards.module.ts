import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GiftCardsController } from './gift-cards.controller';
import { GiftCardsService } from './gift-cards.service';
import { GiftCardsSchedulerService } from './gift-cards-scheduler.service';

@Module({
  imports: [ConfigModule],
  controllers: [GiftCardsController],
  providers: [GiftCardsService, GiftCardsSchedulerService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
