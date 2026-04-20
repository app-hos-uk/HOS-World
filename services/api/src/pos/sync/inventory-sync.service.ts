import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../../inventory/inventory.service';
import { DiscrepanciesService } from '../../discrepancies/discrepancies.service';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { EncryptionService } from '../../integrations/encryption.service';
import { MovementType } from '../../inventory/dto/create-stock-movement.dto';

@Injectable()
export class PosInventorySyncService {
  private readonly logger = new Logger(PosInventorySyncService.name);

  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private discrepancies: DiscrepanciesService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
    private config: ConfigService,
  ) {}

  private warehouseIdFromSettings(connection: { settings: unknown }): string | undefined {
    const s = connection.settings as { defaultWarehouseId?: string } | null;
    return s?.defaultWarehouseId;
  }

  private async resolveInventoryLocation(
    productId: string,
    preferredWarehouseId?: string,
  ): Promise<{ id: string } | null> {
    if (preferredWarehouseId) {
      const loc = await this.prisma.inventoryLocation.findFirst({
        where: { productId, warehouseId: preferredWarehouseId },
      });
      if (loc) return { id: loc.id };
    }
    const loc = await this.prisma.inventoryLocation.findFirst({
      where: { productId },
    });
    return loc ? { id: loc.id } : null;
  }

  /** Decrement HOS stock when a POS sale is imported. */
  async applyPosSaleToInventory(storeId: string, posSaleId: string): Promise<void> {
    const connection = await this.prisma.pOSConnection.findFirst({
      where: { storeId, isActive: true },
    });
    if (!connection?.autoSyncInventory) return;

    const sale = await this.prisma.pOSSale.findUnique({
      where: { id: posSaleId },
      include: { items: true },
    });
    if (!sale) return;

    const whId = this.warehouseIdFromSettings(connection);

    for (const item of sale.items) {
      if (!item.productId || item.quantity <= 0) continue;
      const loc = await this.resolveInventoryLocation(item.productId, whId);
      if (!loc) {
        this.logger.warn(`No inventory location for product ${item.productId}; skip POS sale line`);
        continue;
      }
      try {
        await this.inventory.recordStockMovement(
          {
            inventoryLocationId: loc.id,
            productId: item.productId,
            quantity: item.quantity,
            movementType: MovementType.OUT,
            referenceType: 'POS_SALE',
            referenceId: posSaleId,
            notes: 'In-store sale (POS import)',
          },
          undefined,
        );
      } catch (e) {
        this.logger.warn(`Stock movement for POS sale failed: ${(e as Error).message}`);
      }
    }
  }

  /** Push online order quantities to POS outlet stock (best-effort). */
  async syncOnlineOrderToPos(orderId: string): Promise<void> {
    if (this.config.get<string>('POS_ENABLED') !== 'true') return;

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, parentOrderId: null },
      include: { items: true },
    });
    if (!order?.items?.length) return;

    for (const line of order.items) {
      const channels = await this.prisma.productChannel.findMany({
        where: {
          productId: line.productId,
          channelType: 'STORE',
          isActive: true,
          storeId: { not: null },
        },
      });

      for (const ch of channels) {
        if (!ch.storeId) continue;
        const conn = await this.prisma.pOSConnection.findFirst({
          where: { storeId: ch.storeId, isActive: true },
        });
        if (!conn?.autoSyncInventory) continue;

        const mapping = await this.prisma.externalEntityMapping.findFirst({
          where: {
            provider: conn.provider,
            entityType: 'PRODUCT',
            internalId: line.productId,
            storeId: ch.storeId,
          },
        });
        if (!mapping?.externalId) continue;

        const outletId = conn.externalOutletId || '';
        if (!outletId) continue;

        try {
          const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
          const adapter = this.factory.create(conn.provider, conn.credentials);
          await adapter.authenticate(creds);
          const current = await adapter.getInventory(mapping.externalId, outletId);
          const next = Math.max(0, current - line.quantity);
          await adapter.updateInventory(mapping.externalId, outletId, next);
        } catch (e) {
          this.logger.warn(`POS stock decrement failed for order ${orderId}: ${(e as Error).message}`);
        }
      }
    }
  }

  async nightlyReconciliation(): Promise<void> {
    if (this.config.get<string>('POS_ENABLED') !== 'true') return;

    const threshold = this.config.get<number>('POS_INVENTORY_DISCREPANCY_THRESHOLD', 0);
    const connections = await this.prisma.pOSConnection.findMany({
      where: { isActive: true },
      include: { store: true },
    });

    for (const conn of connections) {
      const outletId = conn.externalOutletId || conn.store.externalStoreId || '';
      if (!outletId) continue;

      const mappings = await this.prisma.externalEntityMapping.findMany({
        where: {
          provider: conn.provider,
          entityType: 'PRODUCT',
          storeId: conn.storeId,
          syncStatus: 'SYNCED',
        },
      });

      const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
      const adapter = this.factory.create(conn.provider, conn.credentials);
      try {
        await adapter.authenticate(creds);
      } catch {
        continue;
      }

      const whId = this.warehouseIdFromSettings(conn);
      let checked = 0;
      let mismatches = 0;
      let errors = 0;

      for (const m of mappings) {
        try {
          checked++;
          const posQty = await adapter.getInventory(m.externalId, outletId);
          const loc = await this.resolveInventoryLocation(m.internalId, whId);
          const hosQty = loc
            ? (
                await this.prisma.inventoryLocation.findUnique({
                  where: { id: loc.id },
                })
              )?.quantity ?? 0
            : 0;
          if (Math.abs(posQty - hosQty) > threshold) {
            mismatches++;
            await this.discrepancies.createDiscrepancy({
              type: 'INVENTORY',
              productId: m.internalId,
              severity: 'MEDIUM',
              description: `POS vs HOS stock mismatch (store ${conn.store.code})`,
              expectedValue: { source: 'HOS', quantity: hosQty },
              actualValue: { source: 'POS', quantity: posQty },
            });
          }
        } catch (e) {
          errors++;
          this.logger.warn(`Reconciliation row failed: ${(e as Error).message}`);
        }
      }

      const prevSettings = (conn.settings ?? {}) as Record<string, unknown>;
      await this.prisma.pOSConnection.update({
        where: { id: conn.id },
        data: {
          settings: {
            ...prevSettings,
            lastReconciliation: {
              timestamp: new Date().toISOString(),
              productsChecked: checked,
              mismatches,
              errors,
            },
          },
        },
      });
    }
  }
}
