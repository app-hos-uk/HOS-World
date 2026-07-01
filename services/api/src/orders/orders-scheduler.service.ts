import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

@Injectable()
export class OrdersSchedulerService {
  private readonly logger = new Logger(OrdersSchedulerService.name);

  constructor(private readonly ordersService: OrdersService) {}

  /** Every 15 minutes — cancel checkout orders that were never paid (default TTL: 60 min). */
  @Cron('*/15 * * * *')
  async expireStaleUnpaidOrders(): Promise<void> {
    try {
      await this.ordersService.expireUnpaidOrders();
    } catch (err) {
      this.logger.warn(`Unpaid order expiry job failed: ${(err as Error).message}`);
    }
  }
}
