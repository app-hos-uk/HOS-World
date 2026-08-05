import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../integrations/encryption.service';
import { POSAdapterFactory } from '../pos-adapter.factory';

/** Account-level ExternalEntityMapping.storeId sentinel (closes Postgres NULL unique hole). */
const ACCOUNT_LEVEL_STORE_ID = '';

@Injectable()
export class PosCustomerSyncService {
  private readonly logger = new Logger(PosCustomerSyncService.name);

  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
  ) {}

  async syncMembershipToStore(userId: string, storeId: string): Promise<void> {
    const connection = await this.prisma.pOSConnection.findFirst({
      where: { storeId, isActive: true },
    });
    if (!connection) return;

    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!membership?.user?.email) return;

    // Skip when member has not consented to any contact channel used for POS push.
    if (!membership.optInEmail && !membership.optInSms) {
      this.logger.debug(
        `Skipping POS customer sync for user ${userId}: no email/sms opt-in`,
      );
      return;
    }

    const creds = this.encryption.decryptJson<Record<string, unknown>>(connection.credentials);
    const accountKey = String(creds.domainPrefix || '') || null;
    const adapter = this.factory.create(connection.provider, connection.credentials);
    try {
      await adapter.authenticate(creds);
      const externalId = await adapter.syncCustomer({
        internalId: membership.id,
        email: membership.user.email,
        firstName: membership.user.firstName ?? undefined,
        lastName: membership.user.lastName ?? undefined,
        phone: membership.user.phone ?? undefined,
        loyaltyCardNumber: membership.cardNumber ?? undefined,
      });

      await this.prisma.externalEntityMapping.upsert({
        where: {
          provider_entityType_internalId_storeId: {
            provider: connection.provider,
            entityType: 'CUSTOMER',
            internalId: membership.id,
            storeId: ACCOUNT_LEVEL_STORE_ID,
          },
        },
        create: {
          provider: connection.provider,
          entityType: 'CUSTOMER',
          internalId: membership.id,
          externalId,
          storeId: ACCOUNT_LEVEL_STORE_ID,
          accountKey,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
        },
        update: {
          externalId,
          accountKey,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date(),
          syncError: null,
        },
      });
    } catch (e) {
      this.logger.warn(`POS customer sync failed: ${(e as Error).message}`);
    }
  }

  /**
   * Push membership once per distinct Lightspeed account (domainPrefix),
   * not once per store connection sharing the same account.
   */
  async syncMembershipToAllPosStores(userId: string): Promise<void> {
    const connections = await this.prisma.pOSConnection.findMany({
      where: { isActive: true },
      select: { storeId: true, credentials: true },
    });

    const seenAccountKeys = new Set<string>();
    for (const c of connections) {
      let accountKey: string;
      try {
        const creds = this.encryption.decryptJson<Record<string, unknown>>(c.credentials);
        accountKey = String(creds.domainPrefix || '').trim() || c.storeId;
      } catch {
        accountKey = c.storeId;
      }
      if (seenAccountKeys.has(accountKey)) continue;
      seenAccountKeys.add(accountKey);
      await this.syncMembershipToStore(userId, c.storeId);
    }
  }
}
