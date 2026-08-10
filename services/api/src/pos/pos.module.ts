import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { CacheModule } from '../cache/cache.module';
import { InventoryModule } from '../inventory/inventory.module';
import { DiscrepanciesModule } from '../discrepancies/discrepancies.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { StoreAdminModule } from '../stores/store-admin.module';
import { POSAdapterFactory } from './pos-adapter.factory';
import { PosProductSyncService } from './sync/product-sync.service';
import { PosInventorySyncService } from './sync/inventory-sync.service';
import { PosCustomerSyncService } from './sync/customer-sync.service';
import { PosCustomerIdentityBackfillService } from './sync/customer-identity-backfill.service';
import { PosSalesImportService } from './sync/sales-import.service';
import { PosGiftCardReconService } from './sync/gift-card-recon.service';
import { PosWebhookController } from './webhooks/pos-webhook.controller';
import { PosAdminController } from './pos-admin.controller';
import { LightspeedOAuthController } from './lightspeed-oauth.controller';
import { PosJobsService } from './jobs/pos.jobs';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    ConfigModule,
    CacheModule,
    InventoryModule,
    DiscrepanciesModule,
    forwardRef(() => LoyaltyModule),
    StoreAdminModule,
  ],
  controllers: [PosWebhookController, PosAdminController, LightspeedOAuthController],
  providers: [
    POSAdapterFactory,
    PosProductSyncService,
    PosInventorySyncService,
    PosCustomerSyncService,
    PosCustomerIdentityBackfillService,
    PosSalesImportService,
    PosGiftCardReconService,
    PosJobsService,
  ],
  exports: [
    POSAdapterFactory,
    PosProductSyncService,
    PosInventorySyncService,
    PosSalesImportService,
  ],
})
export class PosModule {}
