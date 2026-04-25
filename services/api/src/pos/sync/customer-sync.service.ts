import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../integrations/encryption.service';
import { POSAdapterFactory } from '../pos-adapter.factory';

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

    const creds = this.encryption.decryptJson<Record<string, unknown>>(connection.credentials);
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
            storeId,
          },
        },
        create: {
          provider: connection.provider,
          entityType: 'CUSTOMER',
          internalId: membership.id,
          externalId,
          storeId,
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
      this.logger.warn(`POS customer sync failed: ${(e as Error).message}`);
    }
  }

  async syncMembershipToAllPosStores(userId: string): Promise<void> {
    const connections = await this.prisma.pOSConnection.findMany({
      where: { isActive: true },
      select: { storeId: true },
    });
    for (const c of connections) {
      await this.syncMembershipToStore(userId, c.storeId);
    }
  }
}
