import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService, JobType } from '../../queue/queue.service';
import { ProductCampaignsService } from '../product-campaigns.service';

@Injectable()
export class ProductCampaignJobsService implements OnModuleInit {
  private readonly logger = new Logger(ProductCampaignJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private campaigns: ProductCampaignsService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.PRODUCT_CAMPAIGN_ACTIVATE, async () => {
      const n = await this.campaigns.runScheduledActivations();
      this.logger.log(`Product campaign activations: ${n}`);
    });

    this.queue.registerProcessor(JobType.PRODUCT_CAMPAIGN_EXPIRE, async () => {
      const n = await this.campaigns.runExpiredCompletions();
      this.logger.log(`Product campaign expired completions: ${n}`);
    });

    try {
      await this.queue.addRepeatable(
        JobType.PRODUCT_CAMPAIGN_ACTIVATE,
        {},
        this.config.get<string>('PRODUCT_CAMPAIGN_ACTIVATE_CRON', '0 0 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.PRODUCT_CAMPAIGN_EXPIRE,
        {},
        this.config.get<string>('PRODUCT_CAMPAIGN_EXPIRE_CRON', '0 1 * * *'),
      );
      this.logger.log('Product campaign crons scheduled');
    } catch (e) {
      this.logger.warn(`Product campaign cron schedule failed: ${(e as Error).message}`);
    }
  }
}
