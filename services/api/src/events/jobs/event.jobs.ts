import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { QueueService, JobType } from '../../queue/queue.service';
import { EventsService } from '../events.service';

@Injectable()
export class EventJobsService implements OnModuleInit {
  private readonly logger = new Logger(EventJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private events: EventsService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.EVENT_REMINDER, async (_job: Job) => {
      await this.events.sendRemindersWindow();
    });

    this.queue.registerProcessor(JobType.EVENT_ATTENDANCE_RECONCILE, async (_job: Job) => {
      await this.events.reconcileEndedEvents();
    });

    try {
      await this.queue.addRepeatable(
        JobType.EVENT_REMINDER,
        {},
        this.config.get<string>('EVENT_REMINDER_CRON', '0 9 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.EVENT_ATTENDANCE_RECONCILE,
        {},
        this.config.get<string>('EVENT_RECONCILE_CRON', '0 1 * * *'),
      );
      this.logger.log('Event reminder & reconcile cron jobs scheduled');
    } catch (e) {
      this.logger.warn(`Event cron schedule failed: ${(e as Error).message}`);
    }
  }
}
