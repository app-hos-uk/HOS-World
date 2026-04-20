import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { InventoryModule } from '../inventory/inventory.module';
import { DiscrepanciesModule } from '../discrepancies/discrepancies.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { POSAdapterFactory } from './pos-adapter.factory';
import { PosProductSyncService } from './sync/product-sync.service';
import { PosInventorySyncService } from './sync/inventory-sync.service';
import { PosCustomerSyncService } from './sync/customer-sync.service';
import { PosSalesImportService } from './sync/sales-import.service';
import { PosWebhookController } from './webhooks/pos-webhook.controller';
import { PosAdminController } from './pos-admin.controller';
import { PosJobsService } from './jobs/pos.jobs';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ConfigModule,
    InventoryModule,
    DiscrepanciesModule,
    forwardRef(() => LoyaltyModule),
  ],
  controllers: [PosWebhookController, PosAdminController],
  providers: [
    POSAdapterFactory,
    PosProductSyncService,
    PosInventorySyncService,
    PosCustomerSyncService,
    PosSalesImportService,
    PosJobsService,
  ],
  exports: [POSAdapterFactory, PosProductSyncService, PosInventorySyncService, PosSalesImportService],
})
export class PosModule {}
