import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GiftCardsService } from './gift-cards.service';

@Injectable()
export class GiftCardsSchedulerService {
  private readonly logger = new Logger(GiftCardsSchedulerService.name);

  constructor(private readonly giftCardsService: GiftCardsService) {}

  /** Hourly — retire cards past their expiry so the stored status matches what redemption enforces. */
  @Cron('0 * * * *')
  async expireOverdueGiftCards(): Promise<void> {
    try {
      await this.giftCardsService.expireOverdueGiftCards();
    } catch (err) {
      this.logger.warn(`Gift card expiry job failed: ${(err as Error).message}`);
    }
  }
}
