import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { FeatureFlagsModule } from '../config/feature-flags.module';
import { CacheModule } from '../cache/cache.module';
import { AccountingService } from './accounting.service';
import { AccountingAdminController } from './accounting-admin.controller';
import { AccountingJobsService } from './accounting.jobs';
import { XeroAuthService } from './xero-auth.service';
import { XeroApiClient } from './xero-api.client';
import { LedgerOutboxService } from './ledger-outbox.service';
import { JournalBuilderService } from './journal-builder.service';
import { ThreeWayReconService } from './three-way-recon.service';
import { DailyJournalService } from './daily-journal.service';

@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, FeatureFlagsModule, CacheModule],
  controllers: [AccountingAdminController],
  providers: [
    AccountingService,
    AccountingJobsService,
    XeroAuthService,
    XeroApiClient,
    LedgerOutboxService,
    JournalBuilderService,
    ThreeWayReconService,
    DailyJournalService,
  ],
  exports: [AccountingService, LedgerOutboxService, JournalBuilderService, DailyJournalService],
})
export class AccountingModule {}
