import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { POSSale as ParsedSale } from '../interfaces/pos-types';
import { PosInventorySyncService } from './inventory-sync.service';
import { LoyaltyEarnEngine } from '../../loyalty/engines/earn.engine';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { EncryptionService } from '../../integrations/encryption.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PosSalesImportService {
  private readonly logger = new Logger(PosSalesImportService.name);

  constructor(
    private prisma: PrismaService,
    private inventorySync: PosInventorySyncService,
    private earnEngine: LoyaltyEarnEngine,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
  ) {}

  async importParsedSale(
    storeId: string,
    provider: string,
    parsed: ParsedSale,
  ): Promise<{ id: string; duplicate: boolean }> {
    const existing = await this.prisma.pOSSale.findUnique({
      where: {
        provider_externalSaleId: {
          provider,
          externalSaleId: parsed.externalId,
        },
      },
    });
    if (existing) {
      return { id: existing.id, duplicate: true };
    }

    let customerId: string | null = null;
    let customerEmail: string | null = parsed.customer?.email ?? null;
    if (parsed.customer?.email) {
      const u = await this.prisma.user.findFirst({
        where: { email: { equals: parsed.customer.email, mode: 'insensitive' } },
        select: { id: true },
      });
      customerId = u?.id ?? null;
    }
    if (!customerId && parsed.customer?.phone) {
      const u = await this.prisma.user.findFirst({
        where: { phone: parsed.customer.phone },
        select: { id: true },
      });
      customerId = u?.id ?? null;
    }

    const itemCreates = await Promise.all(
      parsed.items.map(async (it) => {
        let productId: string | null = null;
        if (it.externalProductId) {
          const map = await this.prisma.externalEntityMapping.findFirst({
            where: {
              provider,
              entityType: 'PRODUCT',
              externalId: it.externalProductId,
              storeId,
            },
          });
          productId = map?.internalId ?? null;
        }
        if (!productId && it.sku) {
          const p = await this.prisma.product.findFirst({
            where: { sku: it.sku },
            select: { id: true },
          });
          productId = p?.id ?? null;
        }
        return {
          productId,
          externalProductId: it.externalProductId || null,
          sku: it.sku ?? null,
          name: it.name,
          quantity: it.quantity,
          unitPrice: new Decimal(it.unitPrice),
          totalPrice: new Decimal(it.totalPrice),
          taxAmount: new Decimal(it.taxAmount),
        };
      }),
    );

    const sale = await this.prisma.pOSSale.create({
      data: {
        storeId,
        externalSaleId: parsed.externalId,
        externalInvoice: parsed.invoiceNumber,
        provider,
        saleDate: parsed.saleDate,
        customerId,
        customerEmail,
        totalAmount: new Decimal(parsed.totalAmount),
        currency: parsed.currency,
        taxAmount: new Decimal(parsed.taxAmount),
        discountAmount: new Decimal(parsed.discountAmount),
        status: 'IMPORTED',
        rawPayload: parsed.rawPayload as object,
        items: { create: itemCreates },
      },
    });

    await this.inventorySync.applyPosSaleToInventory(storeId, sale.id);

    try {
      await this.earnEngine.processPosSale(sale.id);
    } catch (e) {
      this.logger.warn(`Loyalty earn for POS sale ${sale.id}: ${(e as Error).message}`);
    }

    await this.prisma.pOSSale.update({
      where: { id: sale.id },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });

    return { id: sale.id, duplicate: false };
  }

  async pollStoreSales(storeId: string, sinceHours = 24): Promise<number> {
    const conn = await this.prisma.pOSConnection.findFirst({
      where: { storeId, isActive: true },
      include: { store: true },
    });
    if (!conn) return 0;

    const since = new Date(Date.now() - sinceHours * 3600 * 1000);
    const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
    const adapter = this.factory.create(conn.provider, conn.credentials);
    await adapter.authenticate(creds);
    const outletId = conn.externalOutletId || conn.store.externalStoreId || undefined;
    const sales = await adapter.getSales(since, outletId);
    let imported = 0;
    for (const s of sales) {
      const r = await this.importParsedSale(storeId, conn.provider, s);
      if (!r.duplicate) imported++;
    }
    return imported;
  }
}
