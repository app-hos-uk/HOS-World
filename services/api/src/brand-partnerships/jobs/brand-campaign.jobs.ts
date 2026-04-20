import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { QueueService, JobType } from '../../queue/queue.service';
import { BrandPartnershipsService } from '../brand-partnerships.service';

@Injectable()
export class BrandCampaignJobsService implements OnModuleInit {
  private readonly logger = new Logger(BrandCampaignJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private brand: BrandPartnershipsService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.BRAND_CAMPAIGN_ACTIVATE, async () => {
      const n = await this.brand.runScheduledActivations();
      this.logger.log(`Brand campaign activations: ${n}`);
    });

    this.queue.registerProcessor(JobType.BRAND_CAMPAIGN_EXPIRE, async () => {
      const r = await this.brand.runExpiredAndEndingSoon();
      this.logger.log(
        `Brand campaign expire: completed=${r.completed} endingNotified=${r.endingNotified}`,
      );
    });

    this.queue.registerProcessor(JobType.BRAND_CAMPAIGN_REPORT, async (_job: Job) => {
      await this.brand.runReportJob();
      this.logger.log('Brand campaign report job ok');
    });

    try {
      await this.queue.addRepeatable(
        JobType.BRAND_CAMPAIGN_ACTIVATE,
        {},
        this.config.get<string>('BRAND_CAMPAIGN_ACTIVATE_CRON', '0 0 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.BRAND_CAMPAIGN_EXPIRE,
        {},
        this.config.get<string>('BRAND_CAMPAIGN_EXPIRE_CRON', '0 1 * * *'),
      );
      this.logger.log('Brand campaign crons scheduled');
    } catch (e) {
      this.logger.warn(`Brand campaign cron schedule failed: ${(e as Error).message}`);
    }
  }
}
