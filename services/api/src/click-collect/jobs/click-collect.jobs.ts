import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService, JobType } from '../../queue/queue.service';
import { ClickCollectService } from '../click-collect.service';

@Injectable()
export class ClickCollectJobsService implements OnModuleInit {
  private readonly logger = new Logger(ClickCollectJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private cc: ClickCollectService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.CLICK_COLLECT_EXPIRY, async () => {
      const n = await this.cc.expireStaleOrders();
      this.logger.log(`Click & collect expired: ${n}`);
    });

    this.queue.registerProcessor(JobType.CLICK_COLLECT_REMINDER, async () => {
      const n = await this.cc.sendPickupReminders();
      this.logger.log(`Click & collect reminders: ${n}`);
    });

    try {
      await this.queue.addRepeatable(
        JobType.CLICK_COLLECT_EXPIRY,
        {},
        this.config.get<string>('CC_EXPIRY_CRON', '0 6 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.CLICK_COLLECT_REMINDER,
        {},
        this.config.get<string>('CC_REMINDER_CRON', '30 */6 * * *'),
      );
      this.logger.log('Click & collect crons scheduled');
    } catch (e) {
      this.logger.warn(`Click & collect cron schedule failed: ${(e as Error).message}`);
    }
  }
}
