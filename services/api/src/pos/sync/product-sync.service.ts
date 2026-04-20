import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../integrations/encryption.service';
import { POSAdapterFactory } from '../pos-adapter.factory';
import type { POSProductPayload } from '../interfaces/pos-types';

@Injectable()
export class PosProductSyncService {
  private readonly logger = new Logger(PosProductSyncService.name);

  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
  ) {}

  async syncProductToStore(productId: string, storeId: string): Promise<void> {
    const connection = await this.prisma.pOSConnection.findFirst({
      where: { storeId, isActive: true },
      include: { store: true },
    });
    if (!connection || !connection.autoSyncProducts) return;

    const channel = await this.prisma.productChannel.findFirst({
      where: {
        productId,
        storeId,
        channelType: 'STORE',
        isActive: true,
      },
    });
    if (!channel) {
      this.logger.debug(`No STORE channel for product ${productId} at ${storeId}; skip POS sync`);
      return;
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        categoryRelation: true,
      },
    });
    if (!product) return;

    const outletId = connection.externalOutletId || connection.store.externalStoreId || '';
    if (!outletId) {
      this.logger.warn(`POS connection ${connection.id} has no externalOutletId; skip sync`);
      return;
    }

    const mapping = await this.prisma.externalEntityMapping.findFirst({
      where: {
        provider: connection.provider,
        entityType: 'PRODUCT',
        internalId: productId,
        storeId,
      },
    });

    const credsPlain = this.encryption.decryptJson<Record<string, unknown>>(connection.credentials);
    const adapter = this.factory.create(connection.provider, connection.credentials);
    await adapter.authenticate(credsPlain);

    const payload: POSProductPayload = {
      internalId: product.id,
      existingExternalId: mapping?.externalId,
      sku: product.sku || product.id.slice(0, 12),
      name: product.name,
      description: product.description ?? undefined,
      retailPrice: Number(channel.sellingPrice),
      costPrice: channel.costPrice != null ? Number(channel.costPrice) : undefined,
      imageUrl: product.images[0]?.url,
      categoryName: product.categoryRelation?.name ?? product.fandom ?? undefined,
      tags: product.tags?.length ? product.tags : undefined,
    };

    try {
      const externalId = await adapter.syncProduct(payload, outletId);
      if (mapping) {
        await this.prisma.externalEntityMapping.update({
          where: { id: mapping.id },
          data: {
            externalId,
            syncStatus: 'SYNCED',
            syncError: null,
            lastSyncedAt: new Date(),
          },
        });
      } else {
        await this.prisma.externalEntityMapping.create({
          data: {
            provider: connection.provider,
            entityType: 'PRODUCT',
            internalId: productId,
            externalId,
            storeId,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
          },
        });
      }
      await this.prisma.pOSConnection.update({
        where: { id: connection.id },
        data: { lastSyncedAt: new Date(), syncStatus: 'SYNCED', syncError: null },
      });
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.warn(`POS product sync failed: ${msg}`);
      await this.prisma.externalEntityMapping.updateMany({
        where: {
          provider: connection.provider,
          entityType: 'PRODUCT',
          internalId: productId,
          storeId,
        },
        data: { syncStatus: 'FAILED', syncError: msg },
      });
      await this.prisma.pOSConnection.update({
        where: { id: connection.id },
        data: { syncStatus: 'FAILED', syncError: msg },
      });
    }
  }

  async syncAllProductsForStore(storeId: string): Promise<void> {
    const channels = await this.prisma.productChannel.findMany({
      where: { storeId, channelType: 'STORE', isActive: true },
      select: { productId: true },
    });
    for (const ch of channels) {
      await this.syncProductToStore(ch.productId, storeId);
    }
  }
}
