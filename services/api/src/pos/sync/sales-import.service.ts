import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  LightspeedCredentials,
  POSCustomer,
  POSSale as ParsedSale,
} from '../interfaces/pos-types';
import { PosInventorySyncService } from './inventory-sync.service';
import { LoyaltyEarnEngine } from '../../loyalty/engines/earn.engine';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { EncryptionService } from '../../integrations/encryption.service';
import { Decimal } from '@prisma/client/runtime/library';
import { isClosedSale, isVoidedSale } from '../adapters/lightspeed/lightspeed.mapper';
import { LightspeedAdapter } from '../adapters/lightspeed/lightspeed.adapter';
import { normalizePhoneToE164 } from '../../common/utils/phone-normalize';

type ConnectionSettings = {
  lastSaleVersion?: number;
  [key: string]: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Lightspeed customer id as stored on the raw sale payload (no POSSale column). */
export function extractCustomerExternalId(rawPayload: unknown): string | null {
  const raw = asRecord(rawPayload);
  if (!raw) return null;
  if (raw.customer_id != null && String(raw.customer_id).trim()) {
    return String(raw.customer_id).trim();
  }
  const customer = asRecord(raw.customer);
  if (customer?.id != null && String(customer.id).trim()) {
    return String(customer.id).trim();
  }
  if (typeof raw.customer === 'string' && raw.customer.trim()) {
    return raw.customer.trim();
  }
  return null;
}

function extractCustomerCode(rawPayload: unknown): string | null {
  const raw = asRecord(rawPayload);
  if (!raw) return null;
  if (raw.customer_code != null && String(raw.customer_code).trim()) {
    return String(raw.customer_code).trim();
  }
  const customer = asRecord(raw.customer);
  if (customer?.customer_code != null && String(customer.customer_code).trim()) {
    return String(customer.customer_code).trim();
  }
  return null;
}

/** Card number is rarely on a sale; only honour explicit metadata. */
function extractCardNumberFromMetadata(rawPayload: unknown): string | null {
  const raw = asRecord(rawPayload);
  if (!raw) return null;
  const meta = asRecord(raw.metadata) ?? asRecord(raw.meta);
  if (!meta) return null;
  const card =
    meta.cardNumber ?? meta.card_number ?? meta.loyaltyCardNumber ?? meta.loyalty_card_number;
  if (card == null || !String(card).trim()) return null;
  return String(card).trim();
}

export function posSaleItemsNeedRefresh(items: Array<{ sku?: string | null }>): boolean {
  if (!items.length) return true;
  return items.some((i) => {
    const sku = i.sku?.trim() || '';
    return !sku || sku.startsWith('ls:');
  });
}

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

  /**
   * Identity ladder — stop at first exact hit. Never match on name.
   * 1. ExternalEntityMapping by Lightspeed customer externalId
   * 2. rawPayload.customer_code → LoyaltyMembership.id
   * 3. Card number from sale metadata (if present)
   * 4. Email (case-insensitive)
   * 5. phoneNormalized (exactly one user; ambiguous → IdentityMatchReview)
   */
  private async resolveCustomerId(
    storeId: string,
    provider: string,
    parsed: ParsedSale,
  ): Promise<string | null> {
    const externalId = parsed.customer?.externalId?.trim() || null;

    // 1. External customer id → mapping (any storeId / accountKey)
    if (externalId) {
      const map = await this.prisma.externalEntityMapping.findFirst({
        where: {
          provider,
          entityType: 'CUSTOMER',
          externalId,
        },
      });
      if (map?.internalId) {
        const membership = await this.prisma.loyaltyMembership.findUnique({
          where: { id: map.internalId },
          select: { userId: true },
        });
        if (membership) return membership.userId;
      }
    }

    // 2. customer_code on sale payload = LoyaltyMembership.id (Lightspeed customer_code)
    const customerCode = extractCustomerCode(parsed.rawPayload);
    if (customerCode) {
      const membership = await this.prisma.loyaltyMembership.findUnique({
        where: { id: customerCode },
        select: { userId: true },
      });
      if (membership) {
        await this.linkCustomerMappingIfNeeded(provider, membership.userId, externalId, storeId);
        return membership.userId;
      }
    }

    // 3. Card number only when present in metadata
    const cardNumber = extractCardNumberFromMetadata(parsed.rawPayload);
    if (cardNumber) {
      const membership = await this.prisma.loyaltyMembership.findFirst({
        where: { cardNumber: { equals: cardNumber, mode: 'insensitive' } },
        select: { userId: true },
      });
      if (membership) {
        await this.linkCustomerMappingIfNeeded(provider, membership.userId, externalId, storeId);
        return membership.userId;
      }
    }

    // 4. Email — unique case-insensitive match
    const email = parsed.customer?.email?.trim() || null;
    if (email) {
      const user = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (user) {
        await this.linkCustomerMappingIfNeeded(provider, user.id, externalId, storeId);
        return user.id;
      }
    }

    // 5. phoneNormalized — unambiguous only (national numbers need store country hint)
    const phoneRaw = parsed.customer?.phone?.trim() || null;
    if (phoneRaw) {
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: { country: true, defaultRegionCode: true },
      });
      const countryHint = store?.country || store?.defaultRegionCode || null;
      const phoneNormalized =
        normalizePhoneToE164(phoneRaw, countryHint) ?? normalizePhoneToE164(phoneRaw);
      if (phoneNormalized) {
        const users = await this.prisma.user.findMany({
          where: { phoneNormalized },
          select: { id: true },
          take: 5,
        });
        if (users.length === 1) {
          await this.linkCustomerMappingIfNeeded(provider, users[0].id, externalId, storeId);
          return users[0].id;
        }
        if (users.length > 1) {
          await this.ensureAmbiguousPhoneReview({
            provider,
            lightspeedCustomerId: externalId,
            email,
            phoneNormalized,
            candidateUserIds: users.map((u) => u.id),
            storeId,
            externalSaleId: parsed.externalId,
          });
          return null;
        }
      }
    }

    return null;
  }

  private async ensureAmbiguousPhoneReview(params: {
    provider: string;
    lightspeedCustomerId: string | null;
    email: string | null;
    phoneNormalized: string;
    candidateUserIds: string[];
    storeId: string;
    externalSaleId: string;
  }): Promise<void> {
    const existing = await this.prisma.identityMatchReview.findFirst({
      where: {
        provider: params.provider,
        reason: 'AMBIGUOUS_PHONE',
        status: 'OPEN',
        phoneNormalized: params.phoneNormalized,
        ...(params.lightspeedCustomerId
          ? { lightspeedCustomerId: params.lightspeedCustomerId }
          : {}),
      },
    });
    if (existing) return;

    await this.prisma.identityMatchReview.create({
      data: {
        provider: params.provider,
        reason: 'AMBIGUOUS_PHONE',
        status: 'OPEN',
        lightspeedCustomerId: params.lightspeedCustomerId,
        email: params.email,
        phoneNormalized: params.phoneNormalized,
        candidateInternalIds: params.candidateUserIds,
        metadata: {
          storeId: params.storeId,
          externalSaleId: params.externalSaleId,
          candidateKind: 'userId',
        },
      },
    });
  }

  /** After email/phone match, upsert account-level CUSTOMER mapping (storeId ''). */
  private async linkCustomerMappingIfNeeded(
    provider: string,
    userId: string,
    externalId: string | null,
    storeId: string,
  ): Promise<void> {
    if (!externalId) return;
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!membership) return;

    try {
      await this.prisma.externalEntityMapping.upsert({
        where: {
          provider_entityType_internalId_storeId: {
            provider,
            entityType: 'CUSTOMER',
            internalId: membership.id,
            storeId: '',
          },
        },
        create: {
          provider,
          entityType: 'CUSTOMER',
          internalId: membership.id,
          externalId,
          storeId: '',
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
        },
        update: {
          externalId,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
        },
      });
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.warn(`CUSTOMER mapping upsert failed for membership ${membership.id}: ${msg}`);
      // Unique conflict on externalId → different membership already owns this LS customer.
      try {
        const existing = await this.prisma.identityMatchReview.findFirst({
          where: {
            provider,
            reason: 'BACKFILL_CONFLICT',
            status: 'OPEN',
            lightspeedCustomerId: externalId,
          },
        });
        if (!existing) {
          await this.prisma.identityMatchReview.create({
            data: {
              provider,
              reason: 'BACKFILL_CONFLICT',
              status: 'OPEN',
              lightspeedCustomerId: externalId,
              proposedInternalId: membership.id,
              metadata: { note: 'mapping_upsert_conflict', error: msg.slice(0, 200) },
            },
          });
        }
      } catch {
        // review create is best-effort
      }
      return;
    }

    await this.retroLinkUnattributedSales(externalId, userId, storeId);
  }

  /**
   * Attach previously imported POS sales that had this Lightspeed customer id
   * but no HOS user, then award loyalty for ones that never earned.
   * POSSale has no externalCustomerId column — match via rawPayload.customer_id.
   */
  async retroLinkUnattributedSales(
    externalCustomerId: string,
    userId: string,
    storeId: string,
  ): Promise<number> {
    const extId = externalCustomerId.trim();
    if (!extId || !userId || !storeId) return 0;

    const unattributed = await this.prisma.pOSSale.findMany({
      where: { storeId, customerId: null },
      select: { id: true, loyaltyPointsEarned: true, status: true, rawPayload: true },
    });
    const matched = unattributed.filter(
      (s) => extractCustomerExternalId(s.rawPayload) === extId,
    );
    if (!matched.length) return 0;

    await this.prisma.pOSSale.updateMany({
      where: { id: { in: matched.map((s) => s.id) }, customerId: null },
      data: { customerId: userId },
    });

    for (const sale of matched) {
      if (sale.loyaltyPointsEarned !== 0 || sale.status === 'VOIDED') continue;
      try {
        await this.earnEngine.processPosSale(sale.id);
      } catch (e) {
        this.logger.warn(
          `Loyalty earn after retro-link for POS sale ${sale.id}: ${(e as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Retro-linked ${matched.length} unattributed POS sale(s) for Lightspeed customer ${extId} → user ${userId} (store ${storeId})`,
    );
    return matched.length;
  }

  async importParsedSale(
    storeId: string,
    provider: string,
    parsed: ParsedSale,
    options?: { refreshItems?: boolean },
  ): Promise<{ id: string; duplicate: boolean; skipped?: boolean }> {
    if (isVoidedSale(parsed)) {
      const existing = await this.prisma.pOSSale.findUnique({
        where: {
          provider_externalSaleId: {
            provider,
            externalSaleId: parsed.externalId,
          },
        },
      });
      if (existing) {
        if (existing.status !== 'VOIDED' && existing.loyaltyPointsEarned > 0) {
          try {
            await this.earnEngine.reversePosSaleEarn(existing.id);
          } catch (e) {
            this.logger.warn(
              `Loyalty clawback for voided POS sale ${existing.id}: ${(e as Error).message}`,
            );
          }
        }
        await this.prisma.pOSSale.update({
          where: { id: existing.id },
          data: { status: 'VOIDED', rawPayload: parsed.rawPayload as object },
        });
        return { id: existing.id, duplicate: true };
      }
      return { id: '', duplicate: false, skipped: true };
    }

    if (!isClosedSale(parsed)) {
      this.logger.debug(
        `Skipping non-closed POS sale ${parsed.externalId} state=${parsed.state ?? 'unknown'}`,
      );
      return { id: '', duplicate: false, skipped: true };
    }

    const existing = await this.prisma.pOSSale.findUnique({
      where: {
        provider_externalSaleId: {
          provider,
          externalSaleId: parsed.externalId,
        },
      },
      include: { items: true },
    });
    if (existing) {
      if (
        options?.refreshItems &&
        posSaleItemsNeedRefresh(existing.items ?? []) &&
        parsed.items.length
      ) {
        const itemCreates = await this.buildSaleItemCreates(storeId, provider, parsed);
        await this.prisma.pOSSale.update({
          where: { id: existing.id },
          data: {
            externalInvoice: parsed.invoiceNumber ?? existing.externalInvoice,
            rawPayload: parsed.rawPayload as object,
            items: { deleteMany: {}, create: itemCreates },
          },
        });
      }
      // Retry earn if a prior import left the sale IMPORTED (earn failed).
      if (existing.status === 'IMPORTED') {
        try {
          await this.earnEngine.processPosSale(existing.id);
          await this.prisma.pOSSale.update({
            where: { id: existing.id },
            data: { status: 'PROCESSED', processedAt: new Date() },
          });
        } catch (e) {
          this.logger.warn(
            `Loyalty earn retry for POS sale ${existing.id}: ${(e as Error).message}`,
          );
        }
      }
      return { id: existing.id, duplicate: true };
    }

    const customerEmail: string | null = parsed.customer?.email ?? null;
    const customerId = await this.resolveCustomerId(storeId, provider, parsed);
    const itemCreates = await this.buildSaleItemCreates(storeId, provider, parsed);

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
      await this.prisma.pOSSale.update({
        where: { id: sale.id },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
    } catch (e) {
      // Leave status IMPORTED so webhook/poll retries can re-earn.
      this.logger.warn(
        `Loyalty earn for POS sale ${sale.id} failed — sale left IMPORTED for retry: ${(e as Error).message}`,
      );
    }

    return { id: sale.id, duplicate: false };
  }

  private async buildSaleItemCreates(storeId: string, provider: string, parsed: ParsedSale) {
    return Promise.all(
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
        const catalogSku = it.sku && !it.sku.startsWith('ls:') ? it.sku : null;
        if (!productId && catalogSku) {
          const p = await this.prisma.product.findFirst({
            where: { sku: catalogSku },
            select: { id: true },
          });
          productId = p?.id ?? null;
        }
        const qty = Number.isFinite(it.quantity) ? Math.trunc(it.quantity) : 0;
        if (!Number.isFinite(it.quantity) || qty === 0) {
          throw new Error(
            `Invalid quantity for POS sale ${parsed.externalId} item ${it.externalProductId}`,
          );
        }
        return {
          productId,
          externalProductId: it.externalProductId || null,
          sku: it.sku ?? null,
          name: it.name,
          quantity: qty,
          unitPrice: new Decimal(it.unitPrice),
          totalPrice: new Decimal(it.totalPrice),
          taxAmount: new Decimal(it.taxAmount),
        };
      }),
    );
  }

  async pollStoreSales(storeId: string, _sinceHours = 24): Promise<number> {
    const conn = await this.prisma.pOSConnection.findFirst({
      where: { storeId, isActive: true },
      include: { store: true },
    });
    if (!conn) return 0;

    const settings = (
      conn.settings && typeof conn.settings === 'object' ? conn.settings : {}
    ) as ConnectionSettings;
    const afterVersion =
      typeof settings.lastSaleVersion === 'number' && Number.isFinite(settings.lastSaleVersion)
        ? settings.lastSaleVersion
        : undefined;

    const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
    const adapter = this.factory.create(conn.provider, conn.credentials);
    await adapter.authenticate(creds);
    const outletId = conn.externalOutletId || conn.store.externalStoreId || undefined;

    // Failures before cursor update must not advance version / lastSaleImportedAt.
    const { sales, maxVersion } = await adapter.getSales({ afterVersion, outletId });

    // GET /sales often has customer_id without email. Hydrate once per unique id
    // so the identity ladder can match on email/phone.
    const customerCache = new Map<string, POSCustomer | null>();
    const idsToLookup = [
      ...new Set(
        sales
          .map((s) => {
            const extId = s.customer?.externalId?.trim();
            const email = s.customer?.email?.trim();
            return extId && !email ? extId : null;
          })
          .filter((id): id is string => !!id),
      ),
    ];
    for (const externalId of idsToLookup) {
      try {
        customerCache.set(externalId, await adapter.lookupCustomer(externalId));
      } catch (e) {
        this.logger.warn(
          `POS customer lookup failed for ${externalId}: ${(e as Error).message}`,
        );
        customerCache.set(externalId, null);
      }
    }

    let imported = 0;
    for (const s of sales) {
      const extId = s.customer?.externalId?.trim();
      const hydrated = extId ? customerCache.get(extId) : undefined;
      const parsed = this.mergeHydratedCustomer(s, hydrated ?? null);
      const r = await this.importParsedSale(storeId, conn.provider, parsed);
      if (!r.duplicate && !r.skipped) imported++;
    }

    const nextSettings: ConnectionSettings = { ...settings };
    if (maxVersion != null) {
      nextSettings.lastSaleVersion = maxVersion;
    }

    const maxSaleDate =
      sales.length > 0
        ? sales.reduce(
            (max, s) => (s.saleDate.getTime() > max.getTime() ? s.saleDate : max),
            sales[0].saleDate,
          )
        : conn.lastSaleImportedAt;

    // Persist refreshed OAuth tokens when adapter is Lightspeed
    let credentialsUpdate: string | undefined;
    if (adapter instanceof LightspeedAdapter) {
      try {
        const refreshed = adapter.getCredentials();
        credentialsUpdate = this.encryption.encryptJson(refreshed as LightspeedCredentials);
      } catch {
        // keep existing credentials
      }
    }

    await this.prisma.pOSConnection.update({
      where: { id: conn.id },
      data: {
        settings: nextSettings as object,
        ...(maxSaleDate ? { lastSaleImportedAt: maxSaleDate } : {}),
        ...(credentialsUpdate ? { credentials: credentialsUpdate } : {}),
      },
    });

    return imported;
  }

  private mergeHydratedCustomer(
    sale: ParsedSale,
    hydrated: POSCustomer | null,
  ): ParsedSale {
    if (!hydrated) return sale;
    return {
      ...sale,
      customer: {
        ...sale.customer,
        externalId: sale.customer?.externalId || hydrated.externalId,
        email: sale.customer?.email?.trim() || hydrated.email?.trim() || undefined,
        phone: sale.customer?.phone?.trim() || hydrated.phone?.trim() || undefined,
      },
    };
  }
}
