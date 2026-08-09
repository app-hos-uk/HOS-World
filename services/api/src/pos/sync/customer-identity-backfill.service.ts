import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../integrations/encryption.service';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { LightspeedAdapter } from '../adapters/lightspeed/lightspeed.adapter';
import { normalizePhoneToE164 } from '../../common/utils/phone-normalize';

const ACCOUNT_LEVEL_STORE_ID = '';
const PROVIDER = 'lightspeed';

export type CustomerIdentityBackfillResult = {
  dryRun: boolean;
  scanned: number;
  matched: number;
  updated: number;
  mappingsCreated: number;
  noMatch: number;
  multipleMatch: number;
  conflicts: number;
  skipped: number;
};

@Injectable()
export class PosCustomerIdentityBackfillService {
  private readonly logger = new Logger(PosCustomerIdentityBackfillService.name);

  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
  ) {}

  /**
   * Page Lightspeed customers, match HOS users by email, stamp customer_code + card,
   * create ExternalEntityMapping, or open IdentityMatchReview for ambiguous cases.
   */
  async run(options: {
    dryRun: boolean;
    connectionId?: string;
  }): Promise<CustomerIdentityBackfillResult> {
    // Treat missing/undefined as dry-run for safety (explicit false required to mutate).
    const dryRun = options.dryRun !== false;
    const result: CustomerIdentityBackfillResult = {
      dryRun,
      scanned: 0,
      matched: 0,
      updated: 0,
      mappingsCreated: 0,
      noMatch: 0,
      multipleMatch: 0,
      conflicts: 0,
      skipped: 0,
    };

    const connections = options.connectionId
      ? await this.prisma.pOSConnection.findMany({
          where: { id: options.connectionId, isActive: true, provider: PROVIDER },
        })
      : await this.prisma.pOSConnection.findMany({
          where: { isActive: true, provider: PROVIDER },
        });

    const seenAccounts = new Set<string>();
    for (const conn of connections) {
      let accountKey: string;
      let creds: Record<string, unknown>;
      try {
        creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
        accountKey = String(creds.domainPrefix || '').trim();
      } catch (e) {
        this.logger.warn(
          `Backfill skip connection ${conn.id}: decrypt failed ${(e as Error).message}`,
        );
        continue;
      }
      if (!accountKey) accountKey = conn.id;
      if (seenAccounts.has(accountKey)) continue;
      seenAccounts.add(accountKey);

      const adapter = this.factory.create(conn.provider, conn.credentials);
      if (!(adapter instanceof LightspeedAdapter) && adapter.providerName !== PROVIDER) {
        continue;
      }
      const ls = adapter as LightspeedAdapter;

      try {
        await ls.authenticate(creds);
      } catch (e) {
        this.logger.warn(`Backfill auth failed for ${accountKey}: ${(e as Error).message}`);
        continue;
      }

      await this.processAccount(ls, accountKey, dryRun, result);
    }

    this.logger.log(
      `Customer identity backfill done dryRun=${dryRun} scanned=${result.scanned} ` +
        `matched=${result.matched} updated=${result.updated} noMatch=${result.noMatch} ` +
        `multiple=${result.multipleMatch} conflicts=${result.conflicts} skipped=${result.skipped}`,
    );
    return result;
  }

  private async processAccount(
    ls: LightspeedAdapter,
    accountKey: string,
    dryRun: boolean,
    result: CustomerIdentityBackfillResult,
  ): Promise<void> {
    let after: number | undefined;
    const pageSize = 100;

    for (;;) {
      const page = await ls.listCustomersPage({ after, pageSize });
      if (!page.customers.length) break;

      for (const cust of page.customers) {
        if (!cust.id) continue;
        result.scanned++;
        await this.processCustomer(ls, accountKey, cust, dryRun, result);
      }

      if (page.customers.length < pageSize) break;
      if (page.maxVersion == null) break;
      if (after != null && page.maxVersion <= after) break;
      after = page.maxVersion;
    }
  }

  private async processCustomer(
    ls: LightspeedAdapter,
    accountKey: string,
    cust: {
      id: string;
      email?: string;
      customer_code?: string;
      custom_field_1?: string;
      phone?: string;
      mobile?: string;
    },
    dryRun: boolean,
    result: CustomerIdentityBackfillResult,
  ): Promise<void> {
    const email = cust.email?.trim();
    if (!email) {
      result.skipped++;
      return;
    }

    // Idempotent: already mapped for this account → skip unless conflict check needed.
    const existingByExternal = await this.prisma.externalEntityMapping.findFirst({
      where: {
        provider: PROVIDER,
        entityType: 'CUSTOMER',
        externalId: cust.id,
        storeId: ACCOUNT_LEVEL_STORE_ID,
      },
    });

    const users = await this.prisma.user.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { loyaltyMembership: true },
      take: 10,
    });

    if (users.length === 0) {
      result.noMatch++;
      await this.ensureReview({
        reason: 'NO_MATCH',
        lightspeedCustomerId: cust.id,
        email,
        phoneNormalized: normalizePhoneToE164(cust.phone || cust.mobile || '') ?? undefined,
        dryRun,
        metadata: { accountKey, customer_code: cust.customer_code },
      });
      return;
    }

    if (users.length > 1) {
      result.multipleMatch++;
      await this.ensureReview({
        reason: 'MULTIPLE_MATCH',
        lightspeedCustomerId: cust.id,
        email,
        phoneNormalized: normalizePhoneToE164(cust.phone || cust.mobile || '') ?? undefined,
        candidateInternalIds: users
          .map((u) => u.loyaltyMembership?.id)
          .filter((id): id is string => !!id),
        dryRun,
        metadata: { accountKey, userIds: users.map((u) => u.id) },
      });
      return;
    }

    const user = users[0];
    const membership = user.loyaltyMembership;
    if (!membership) {
      result.noMatch++;
      await this.ensureReview({
        reason: 'NO_MATCH',
        lightspeedCustomerId: cust.id,
        email,
        dryRun,
        metadata: { accountKey, note: 'user_has_no_membership' },
      });
      return;
    }

    result.matched++;

    // Conflict: mapping or stamped customer_code already points at a different membership.
    const existingCode = (cust.customer_code || '').trim();
    let codeBelongsToOther = false;
    if (existingCode && existingCode !== membership.id) {
      const otherMembership = await this.prisma.loyaltyMembership.findUnique({
        where: { id: existingCode },
        select: { id: true },
      });
      codeBelongsToOther = !!otherMembership;
    }
    const mappingConflict = !!existingByExternal && existingByExternal.internalId !== membership.id;

    if (codeBelongsToOther || mappingConflict) {
      result.conflicts++;
      await this.ensureReview({
        reason: 'BACKFILL_CONFLICT',
        lightspeedCustomerId: cust.id,
        email,
        cardNumber: membership.cardNumber ?? undefined,
        proposedInternalId: membership.id,
        candidateInternalIds: [
          ...new Set(
            [membership.id, existingByExternal?.internalId, existingCode].filter(
              (id): id is string => !!id && id !== membership.id,
            ),
          ),
        ],
        dryRun,
        metadata: {
          accountKey,
          existingCustomerCode: existingCode || null,
          existingMappingInternalId: existingByExternal?.internalId ?? null,
        },
      });
      return;
    }

    if (
      existingByExternal &&
      existingByExternal.internalId === membership.id &&
      existingCode === membership.id
    ) {
      result.skipped++;
      return;
    }

    if (dryRun) {
      result.updated++;
      if (!existingByExternal) result.mappingsCreated++;
      return;
    }

    await ls.updateCustomerIdentity(cust.id, {
      customer_code: membership.id,
      custom_field_1: membership.cardNumber ?? '',
    });
    result.updated++;

    if (existingByExternal) {
      await this.prisma.externalEntityMapping.update({
        where: { id: existingByExternal.id },
        data: {
          internalId: membership.id,
          accountKey,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });
    } else {
      await this.prisma.externalEntityMapping.upsert({
        where: {
          provider_entityType_internalId_storeId: {
            provider: PROVIDER,
            entityType: 'CUSTOMER',
            internalId: membership.id,
            storeId: ACCOUNT_LEVEL_STORE_ID,
          },
        },
        create: {
          provider: PROVIDER,
          entityType: 'CUSTOMER',
          internalId: membership.id,
          externalId: cust.id,
          storeId: ACCOUNT_LEVEL_STORE_ID,
          accountKey,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
        },
        update: {
          externalId: cust.id,
          accountKey,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });
      result.mappingsCreated++;
    }
  }

  private async ensureReview(params: {
    reason: string;
    lightspeedCustomerId: string;
    email?: string;
    phoneNormalized?: string;
    cardNumber?: string;
    proposedInternalId?: string;
    candidateInternalIds?: string[];
    metadata?: Record<string, unknown>;
    dryRun: boolean;
  }): Promise<void> {
    if (params.dryRun) return;

    const existing = await this.prisma.identityMatchReview.findFirst({
      where: {
        provider: PROVIDER,
        lightspeedCustomerId: params.lightspeedCustomerId,
        reason: params.reason,
        status: 'OPEN',
      },
    });
    if (existing) return;

    await this.prisma.identityMatchReview.create({
      data: {
        provider: PROVIDER,
        reason: params.reason,
        status: 'OPEN',
        lightspeedCustomerId: params.lightspeedCustomerId,
        email: params.email,
        phoneNormalized: params.phoneNormalized,
        cardNumber: params.cardNumber,
        proposedInternalId: params.proposedInternalId,
        candidateInternalIds: params.candidateInternalIds ?? [],
        metadata: (params.metadata as object | undefined) ?? undefined,
      },
    });
  }
}
