import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService, JobType } from '../../queue/queue.service';
import { LoyaltyAnalyticsService } from '../loyalty-analytics.service';

@Injectable()
export class AnalyticsJobsService implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private analytics: LoyaltyAnalyticsService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.LOYALTY_ANALYTICS_SNAPSHOT, async () => {
      await this.analytics.computeDailySnapshot();
      this.logger.log('Daily analytics snapshot computed');
    });

    this.queue.registerProcessor(JobType.LOYALTY_CLV_RECOMPUTE, async () => {
      const r = await this.analytics.recomputeAllClv();
      this.logger.log(`CLV recompute: computed=${r.computed} errors=${r.errors}`);
    });

    this.queue.registerProcessor(JobType.CAMPAIGN_ATTRIBUTION_COMPUTE, async () => {
      const n = await this.analytics.computeAttributionForDate();
      this.logger.log(`Campaign attribution computed: ${n} campaigns`);
    });

    try {
      await this.queue.addRepeatable(
        JobType.LOYALTY_ANALYTICS_SNAPSHOT,
        {},
        this.config.get<string>('LOYALTY_ANALYTICS_SNAPSHOT_CRON', '30 2 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.LOYALTY_CLV_RECOMPUTE,
        {},
        this.config.get<string>('LOYALTY_CLV_RECOMPUTE_CRON', '0 3 * * 0'),
      );
      await this.queue.addRepeatable(
        JobType.CAMPAIGN_ATTRIBUTION_COMPUTE,
        {},
        this.config.get<string>('CAMPAIGN_ATTRIBUTION_CRON', '45 2 * * *'),
      );
      this.logger.log('Analytics crons scheduled');
    } catch (e) {
      this.logger.warn(`Analytics cron schedule failed: ${(e as Error).message}`);
    }
  }
}
