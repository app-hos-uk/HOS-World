import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../integrations/encryption.service';
import { LoyaltyService } from '../../loyalty/loyalty.service';
import { normalizePhoneToE164 } from '../../common/utils/phone-normalize';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { LightspeedAdapter } from '../adapters/lightspeed/lightspeed.adapter';

/** Account-level ExternalEntityMapping.storeId sentinel (closes Postgres NULL unique hole). */
const ACCOUNT_LEVEL_STORE_ID = '';
const PROVIDER = 'lightspeed';

export type CustomerImportResult = {
  dryRun: boolean;
  scanned: number;
  imported: number;
  alreadyExisted: number;
  skippedNoEmail: number;
  errors: number;
};

@Injectable()
export class PosCustomerImportService {
  private readonly logger = new Logger(PosCustomerImportService.name);

  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
    @Inject(forwardRef(() => LoyaltyService)) private loyalty: LoyaltyService,
  ) {}

  /**
   * Page Lightspeed customers and import each (with email) as a HOS User +
   * LoyaltyMembership, upsert ExternalEntityMapping, and stamp customer_code /
   * custom_field_1 on the Lightspeed side.
   */
  async run(options: {
    dryRun?: boolean;
    connectionId?: string;
  }): Promise<CustomerImportResult> {
    // Treat missing/undefined as dry-run for safety (explicit false required to mutate).
    const dryRun = options.dryRun !== false;
    const result: CustomerImportResult = {
      dryRun,
      scanned: 0,
      imported: 0,
      alreadyExisted: 0,
      skippedNoEmail: 0,
      errors: 0,
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
          `Customer import skip connection ${conn.id}: decrypt failed ${(e as Error).message}`,
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
        this.logger.warn(`Customer import auth failed for ${accountKey}: ${(e as Error).message}`);
        continue;
      }

      await this.processAccount(ls, accountKey, dryRun, result);
    }

    this.logger.log(
      `Customer import done dryRun=${dryRun} scanned=${result.scanned} ` +
        `imported=${result.imported} alreadyExisted=${result.alreadyExisted} ` +
        `skippedNoEmail=${result.skippedNoEmail} errors=${result.errors}`,
    );
    return result;
  }

  private async processAccount(
    ls: LightspeedAdapter,
    accountKey: string,
    dryRun: boolean,
    result: CustomerImportResult,
  ): Promise<void> {
    let after: number | undefined;
    const pageSize = 100;

    for (;;) {
      const page = await ls.listCustomersPage({ after, pageSize });
      if (!page.customers.length) break;

      for (const cust of page.customers) {
        if (!cust.id) continue;
        result.scanned++;
        try {
          await this.processCustomer(ls, accountKey, cust, dryRun, result);
        } catch (e) {
          result.errors++;
          this.logger.warn(
            `Customer import failed for Lightspeed ${cust.id}: ${(e as Error).message}`,
          );
        }
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
      first_name?: string;
      last_name?: string;
      customer_code?: string;
      custom_field_1?: string;
      phone?: string;
      mobile?: string;
    },
    dryRun: boolean,
    result: CustomerImportResult,
  ): Promise<void> {
    const email = cust.email?.trim();
    if (!email) {
      result.skippedNoEmail++;
      return;
    }

    const existingByExternal = await this.prisma.externalEntityMapping.findFirst({
      where: {
        provider: PROVIDER,
        entityType: 'CUSTOMER',
        externalId: cust.id,
        storeId: ACCOUNT_LEVEL_STORE_ID,
      },
    });

    // Fully linked already → count and skip (still repair stamp if live run).
    if (existingByExternal) {
      const membership = await this.prisma.loyaltyMembership.findUnique({
        where: { id: existingByExternal.internalId },
        select: { id: true, cardNumber: true },
      });
      if (membership) {
        const codeOk = (cust.customer_code || '').trim() === membership.id;
        if (codeOk) {
          result.alreadyExisted++;
          return;
        }
        if (dryRun) {
          result.alreadyExisted++;
          return;
        }
        await ls.updateCustomerIdentity(cust.id, {
          customer_code: membership.id,
          custom_field_1: membership.cardNumber ?? '',
        });
        await this.prisma.externalEntityMapping.update({
          where: { id: existingByExternal.id },
          data: {
            accountKey,
            syncStatus: 'SYNCED',
            lastSyncedAt: new Date(),
            syncError: null,
          },
        });
        result.alreadyExisted++;
        return;
      }
      // Orphaned mapping (membership deleted) — remove so we can re-import.
      if (!dryRun) {
        await this.prisma.externalEntityMapping.delete({
          where: { id: existingByExternal.id },
        });
      }
    }

    if (dryRun) {
      const existingUser = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { loyaltyMembership: true },
      });
      if (existingUser && existingUser.role !== UserRole.CUSTOMER) {
        result.errors++;
        this.logger.warn(
          `Customer import dry-run skip ${email}: existing user role ${existingUser.role}`,
        );
        return;
      }
      if (
        existingUser?.loyaltyMembership &&
        (await this.hasConflictingMapping(existingUser.loyaltyMembership.id, cust.id))
      ) {
        result.errors++;
        this.logger.warn(
          `Customer import dry-run conflict ${email}: membership already mapped to another Lightspeed customer`,
        );
        return;
      }
      result.imported++;
      return;
    }

    const phoneRaw = (cust.phone || cust.mobile || '').trim() || null;
    const phoneNormalized = phoneRaw ? normalizePhoneToE164(phoneRaw, 'GB') : null;
    const firstName = cust.first_name?.trim() || null;
    const lastName = cust.last_name?.trim() || null;

    let user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          password: null,
          firstName,
          lastName,
          phone: phoneRaw,
          phoneNormalized,
          role: UserRole.CUSTOMER,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      });
    } else {
      if (user.role !== UserRole.CUSTOMER) {
        result.errors++;
        this.logger.warn(
          `Customer import skip ${email}: existing user role ${user.role} is not CUSTOMER`,
        );
        return;
      }
      const updates: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        phoneNormalized?: string;
      } = {};
      if (firstName && !user.firstName) updates.firstName = firstName;
      if (lastName && !user.lastName) updates.lastName = lastName;
      if (phoneRaw && !user.phone) {
        updates.phone = phoneRaw;
        if (phoneNormalized) updates.phoneNormalized = phoneNormalized;
      } else if (user.phone && !user.phoneNormalized) {
        const existingNorm = normalizePhoneToE164(user.phone, user.country || 'GB');
        if (existingNorm) updates.phoneNormalized = existingNorm;
      }
      if (Object.keys(updates).length) {
        user = await this.prisma.user.update({ where: { id: user.id }, data: updates });
      }
    }

    let membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId: user.id },
    });
    if (!membership) {
      await this.loyalty.enroll(user.id, { enrollmentChannel: 'POS_IMPORT' });
      membership = await this.prisma.loyaltyMembership.findUnique({
        where: { userId: user.id },
      });
    }
    if (!membership) {
      result.errors++;
      this.logger.warn(`Customer import failed to enroll ${email}`);
      return;
    }

    if (await this.hasConflictingMapping(membership.id, cust.id)) {
      result.errors++;
      this.logger.warn(
        `Customer import conflict ${email}: membership ${membership.id} already mapped to another Lightspeed customer`,
      );
      return;
    }

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

    await ls.updateCustomerIdentity(cust.id, {
      customer_code: membership.id,
      custom_field_1: membership.cardNumber ?? '',
    });

    result.imported++;
  }

  /** True when membership is already mapped to a different Lightspeed customer id. */
  private async hasConflictingMapping(
    membershipId: string,
    lightspeedCustomerId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.externalEntityMapping.findUnique({
      where: {
        provider_entityType_internalId_storeId: {
          provider: PROVIDER,
          entityType: 'CUSTOMER',
          internalId: membershipId,
          storeId: ACCOUNT_LEVEL_STORE_ID,
        },
      },
    });
    return !!existing && existing.externalId !== lightspeedCustomerId;
  }
}
