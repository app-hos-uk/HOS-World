import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { QueueService, JobType } from '../queue/queue.service';
import { FeatureFlagsService, FeatureFlag } from '../config/feature-flags.service';
import { isTruthy } from '../common/utils/config';
import { LedgerOutboxService } from './ledger-outbox.service';

/**
 * Accounting cron/workers — only register when ACCOUNTING_ENABLED=true
 * and FeatureFlag.ACCOUNTING_XERO is on (both default false).
 */
@Injectable()
export class AccountingJobsService implements OnModuleInit {
  private readonly logger = new Logger(AccountingJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    private outbox: LedgerOutboxService,
  ) {}

  onModuleInit() {
    const envOn = isTruthy(this.config.get<string>('ACCOUNTING_ENABLED'));
    const flagOn = this.featureFlags.isEnabled(FeatureFlag.ACCOUNTING_XERO);

    if (!envOn || !flagOn) {
      this.logger.log(
        `Accounting jobs skipped (ACCOUNTING_ENABLED=${envOn}, ACCOUNTING_XERO=${flagOn})`,
      );
      return;
    }

    this.queue.registerProcessor(JobType.ACCOUNTING_LEDGER_DRAIN, async (_job: Job) => {
      const result = await this.outbox.drainPending();
      this.logger.log(`Ledger outbox drain: ${JSON.stringify(result)}`);
      return result;
    });

    void this.scheduleCrons();
  }

  private async scheduleCrons() {
    try {
      await this.queue.addRepeatable(
        JobType.ACCOUNTING_LEDGER_DRAIN,
        {},
        this.config.get<string>('ACCOUNTING_LEDGER_DRAIN_CRON', '*/10 * * * *'),
      );
      this.logger.log('Accounting ledger drain cron scheduled');
    } catch (e) {
      this.logger.warn(`Accounting cron schedule failed: ${(e as Error).message}`);
    }
  }
}
