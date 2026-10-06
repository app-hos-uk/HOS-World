import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../integrations/encryption.service';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { LightspeedAdapter } from '../adapters/lightspeed/lightspeed.adapter';
import { ActivityService } from '../../activity/activity.service';
import type { POSProductRecord } from '../interfaces/pos-types';

export type PosProductFormPrefill = POSProductRecord & {
  alreadyLinkedProductId: string | null;
};

type CachedError = { message: string; timestamp: number };

/**
 * Read-only Lightspeed product lookup for the submission form.
 * Never calls POST, PUT, or DELETE /products.
 * Logs search/preview/link operations as activity and caches connection errors.
 */
@Injectable()
export class PosProductImportService {
  private readonly logger = new Logger(PosProductImportService.name);
  private readonly errorCache = new Map<string, CachedError>();
  private static readonly ERROR_TTL_MS = 60_000;

  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
    @Optional() private activityService?: ActivityService,
  ) {}

  async search(params: {
    connectionId: string;
    sku?: string;
    query?: string;
    externalId?: string;
    userId?: string;
  }): Promise<PosProductFormPrefill[]> {
    this.throwIfCachedError(params.connectionId);

    let results: PosProductFormPrefill[];
    try {
      const { adapter, storeId, provider } = await this.connect(params.connectionId);
      if (params.externalId?.trim()) {
        const one = await adapter.getProduct(params.externalId.trim());
        results = one ? [await this.withLink(provider, storeId, one)] : [];
      } else if (params.sku?.trim()) {
        const one = await adapter.findProductBySku(params.sku.trim());
        results = one ? [await this.withLink(provider, storeId, one)] : [];
      } else {
        const page = await adapter.listProductsPage({ pageSize: 100 });
        const q = params.query?.trim().toLowerCase();
        const rows = q
          ? page.products.filter(
              (p) => p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false),
            )
          : page.products;
        results = await Promise.all(rows.slice(0, 50).map((row) => this.withLink(provider, storeId, row)));
      }
    } catch (error) {
      this.cacheConnectionError(params.connectionId, error);
      throw error;
    }

    this.clearCachedError(params.connectionId);
    this.logActivity({
      action: 'POS_PRODUCT_SEARCH',
      description: `Searched POS products: ${params.query || params.sku || params.externalId || 'browse'} — ${results.length} result(s)`,
      entityId: params.connectionId,
      userId: params.userId,
      metadata: {
        connectionId: params.connectionId,
        query: params.query,
        sku: params.sku,
        externalId: params.externalId,
        resultCount: results.length,
      },
    });

    return results;
  }

  async preview(connectionId: string, externalId: string, userId?: string): Promise<PosProductFormPrefill> {
    this.throwIfCachedError(connectionId);

    let result: PosProductFormPrefill;
    try {
      const rows = await this.search({ connectionId, externalId, userId });
      if (!rows[0]) throw new NotFoundException('Lightspeed product not found');
      result = rows[0];
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        this.cacheConnectionError(connectionId, error);
      }
      throw error;
    }

    this.logActivity({
      action: 'POS_PRODUCT_PREVIEW',
      description: `Previewed POS product ${result.name} (${externalId})`,
      entityId: connectionId,
      userId,
      metadata: { connectionId, externalId, name: result.name, sku: result.sku },
    });

    return result;
  }

  /**
   * Attach an approved catalogue product to an existing Lightspeed id.
   * Inserts a mapping only. Does not call the Lightspeed write API.
   */
  async linkProduct(params: {
    storeId: string;
    hosProductId: string;
    externalId: string;
    userId?: string;
  }): Promise<void> {
    const externalId = params.externalId.trim();
    if (!externalId || !params.storeId || !params.hosProductId) return;
    const conn = await this.prisma.pOSConnection.findFirst({
      where: { storeId: params.storeId, isActive: true },
    });
    if (!conn) return;
    const existing = await this.prisma.externalEntityMapping.findFirst({
      where: {
        provider: conn.provider,
        entityType: 'PRODUCT',
        externalId,
        storeId: params.storeId,
      },
    });
    if (existing) {
      if (existing.internalId === params.hosProductId) return;
      const occupant = await this.prisma.externalEntityMapping.findFirst({
        where: {
          provider: conn.provider,
          entityType: 'PRODUCT',
          internalId: params.hosProductId,
          storeId: params.storeId,
        },
      });
      if (occupant && occupant.id !== existing.id) return;
      await this.prisma.externalEntityMapping.update({
        where: { id: existing.id },
        data: {
          internalId: params.hosProductId,
          syncStatus: 'SYNCED',
          syncError: null,
          lastSyncedAt: new Date(),
        },
      });
      return;
    }
    const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
    const accountKey = typeof creds.domainPrefix === 'string' ? creds.domainPrefix : undefined;
    await this.prisma.externalEntityMapping.create({
      data: {
        provider: conn.provider,
        entityType: 'PRODUCT',
        internalId: params.hosProductId,
        externalId,
        storeId: params.storeId,
        accountKey,
        syncStatus: 'SYNCED',
        lastSyncedAt: new Date(),
      },
    });

    this.logActivity({
      action: 'POS_PRODUCT_LINKED',
      description: `Linked HOS product ${params.hosProductId} to POS product ${externalId}`,
      entityId: params.hosProductId,
      userId: params.userId,
      metadata: {
        storeId: params.storeId,
        hosProductId: params.hosProductId,
        externalId,
        provider: conn.provider,
      },
    });
  }

  /** Fire-and-forget activity log write. Failures are logged but never bubble. */
  private logActivity(dto: {
    action: string;
    description: string;
    entityId?: string;
    userId?: string;
    metadata?: Record<string, unknown>;
  }): void {
    if (!this.activityService) return;
    this.activityService
      .createLog({
        action: dto.action,
        entityType: 'POS_PRODUCT_PULL',
        entityId: dto.entityId,
        description: dto.description,
        userId: dto.userId,
        metadata: dto.metadata,
      })
      .catch((err) => {
        this.logger.warn(`Activity log failed: ${(err as Error).message}`);
      });
  }

  private cacheConnectionError(connectionId: string, error: unknown): void {
    const rawMessage =
      error instanceof Error ? error.message : 'Unknown POS connection error';
    const safeMessage = rawMessage
      .replace(/\/[\w/.-]+\.(ts|js):\d+:\d+/g, '')
      .replace(/https?:\/\/[^\s]+/g, '[url]')
      .slice(0, 200);
    this.errorCache.set(connectionId, { message: safeMessage, timestamp: Date.now() });
    this.logger.warn(`POS connection ${connectionId} error cached: ${rawMessage}`);
  }

  private throwIfCachedError(connectionId: string): void {
    const cached = this.errorCache.get(connectionId);
    if (!cached) return;
    if (Date.now() - cached.timestamp > PosProductImportService.ERROR_TTL_MS) {
      this.errorCache.delete(connectionId);
      return;
    }
    const retryAfter = Math.ceil(
      (PosProductImportService.ERROR_TTL_MS - (Date.now() - cached.timestamp)) / 1000,
    );
    throw new BadRequestException(
      `POS connection temporarily unavailable. Please retry after ${retryAfter}s.`,
    );
  }

  private clearCachedError(connectionId: string): void {
    this.errorCache.delete(connectionId);
  }

  private async connect(connectionId: string): Promise<{
    adapter: LightspeedAdapter;
    storeId: string;
    provider: string;
  }> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id: connectionId } });
    if (!conn) throw new NotFoundException('POS connection not found');
    if (conn.provider.toLowerCase() !== 'lightspeed') {
      throw new BadRequestException('Product pull is only available for Lightspeed');
    }
    const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
    const adapter = this.factory.create(conn.provider, conn.credentials);
    if (!(adapter instanceof LightspeedAdapter)) {
      throw new BadRequestException('Product pull is only available for Lightspeed');
    }
    await adapter.authenticate(creds);
    return { adapter, storeId: conn.storeId, provider: conn.provider };
  }

  private async withLink(
    provider: string,
    storeId: string,
    product: POSProductRecord,
  ): Promise<PosProductFormPrefill> {
    const mapping = await this.prisma.externalEntityMapping.findFirst({
      where: {
        provider,
        entityType: 'PRODUCT',
        externalId: product.externalId,
        storeId,
      },
      select: { internalId: true },
    });
    return { ...product, alreadyLinkedProductId: mapping?.internalId ?? null };
  }
}
