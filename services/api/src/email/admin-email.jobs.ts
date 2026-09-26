import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'bullmq';
import { JobType, QueueService } from '../queue/queue.service';
import { AdminEmailService } from './admin-email.service';

@Injectable()
export class AdminEmailJobsService implements OnModuleInit {
  private readonly logger = new Logger(AdminEmailJobsService.name);

  constructor(
    private queue: QueueService,
    private adminEmail: AdminEmailService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(
      JobType.ADMIN_EMAIL_CAMPAIGN,
      async (job: Job<{ campaignId: string }>) => {
        const campaignId = job.data?.campaignId;
        if (!campaignId) {
          this.logger.warn('ADMIN_EMAIL_CAMPAIGN job missing campaignId');
          return;
        }
        this.logger.log(`Processing admin email campaign ${campaignId}`);
        await this.adminEmail.processCampaign(campaignId);
        this.logger.log(`Finished admin email campaign ${campaignId}`);
      },
    );
  }
}
