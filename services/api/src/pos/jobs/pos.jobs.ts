import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { QueueService, JobType } from '../../queue/queue.service';
import { PosProductSyncService } from '../sync/product-sync.service';
import { PosInventorySyncService } from '../sync/inventory-sync.service';
import { PosSalesImportService } from '../sync/sales-import.service';
import { PosCustomerSyncService } from '../sync/customer-sync.service';
import type { POSSale as ParsedSale } from '../interfaces/pos-types';

@Injectable()
export class PosJobsService implements OnModuleInit {
  private readonly logger = new Logger(PosJobsService.name);

  constructor(
    private queue: QueueService,
    private prisma: PrismaService,
    private productSync: PosProductSyncService,
    private inventorySync: PosInventorySyncService,
    private salesImport: PosSalesImportService,
    private customerSync: PosCustomerSyncService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('POS_ENABLED') !== 'true') {
      this.logger.log('POS jobs skipped (POS_ENABLED != true)');
      return;
    }

    this.queue.registerProcessor(JobType.POS_PRODUCT_SYNC, async (job: Job) => {
      const connectionId = job.data?.connectionId as string | undefined;
      if (!connectionId) return;
      const conn = await this.prisma.pOSConnection.findUnique({ where: { id: connectionId } });
      if (!conn) return;
      await this.productSync.syncAllProductsForStore(conn.storeId);
    });

    this.queue.registerProcessor(JobType.POS_INVENTORY_SYNC, async () => {
      await this.inventorySync.nightlyReconciliation();
    });

    this.queue.registerProcessor(
      JobType.POS_SALE_IMPORT,
      async (job: Job<{ storeId: string; provider: string; parsed: ParsedSale }>) => {
        const { storeId, provider, parsed } = job.data;
        if (!storeId || !provider || !parsed) return;
        await this.salesImport.importParsedSale(storeId, provider, parsed);
      },
    );

    this.queue.registerProcessor(JobType.POS_NIGHTLY_RECON, async () => {
      await this.inventorySync.nightlyReconciliation();
    });

    this.queue.registerProcessor(JobType.POS_CUSTOMER_SYNC, async (job: Job<{ userId: string }>) => {
      const userId = job.data?.userId;
      if (!userId) return;
      await this.customerSync.syncMembershipToAllPosStores(userId);
    });

    this.queue.registerProcessor(JobType.POS_SALES_POLL, async () => {
      const conns = await this.prisma.pOSConnection.findMany({ where: { isActive: true } });
      for (const c of conns) {
        try {
          const n = await this.salesImport.pollStoreSales(c.storeId, 24);
          this.logger.log(`POS poll store ${c.storeId}: ${n} new sales`);
        } catch (e) {
          this.logger.warn(`POS poll failed ${c.storeId}: ${(e as Error).message}`);
        }
      }
    });

    void this.scheduleCrons();
  }

  private async scheduleCrons() {
    try {
      await this.queue.addRepeatable(
        JobType.POS_NIGHTLY_RECON,
        {},
        this.config.get<string>('POS_NIGHTLY_RECON_CRON', '0 2 * * *'),
      );
      await this.queue.addRepeatable(
        JobType.POS_SALES_POLL,
        {},
        this.config.get<string>('POS_SALES_POLL_CRON', '*/15 * * * *'),
      );
      this.logger.log('POS cron jobs scheduled');
    } catch (e) {
      this.logger.warn(`POS cron schedule failed: ${(e as Error).message}`);
    }
  }
}
