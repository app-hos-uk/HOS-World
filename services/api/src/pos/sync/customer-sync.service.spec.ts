import { PosCustomerSyncService } from './customer-sync.service';

function makeMocks() {
  const syncCustomer = jest.fn().mockResolvedValue('ls-cust-1');
  const authenticate = jest.fn();
  const prisma: any = {
    pOSConnection: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    loyaltyMembership: {
      findUnique: jest.fn(),
    },
    externalEntityMapping: {
      upsert: jest.fn().mockResolvedValue({}),
    },
  };
  const factory: any = {
    create: jest.fn().mockReturnValue({ syncCustomer, authenticate }),
  };
  const encryption: any = {
    decryptJson: jest.fn().mockReturnValue({ domainPrefix: 'acct-a' }),
  };
  const service = new PosCustomerSyncService(prisma, factory, encryption);
  return { service, prisma, factory, encryption, syncCustomer, authenticate };
}

describe('PosCustomerSyncService', () => {
  describe('syncMembershipToStore', () => {
    it('upserts CUSTOMER mapping with storeId "" and accountKey from domainPrefix', async () => {
      const { service, prisma, syncCustomer } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'conn-1',
        storeId: 'store-1',
        provider: 'lightspeed',
        credentials: 'enc',
        isActive: true,
      });
      prisma.loyaltyMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        cardNumber: 'CARD-99',
        optInEmail: true,
        optInSms: false,
        user: {
          email: 'a@example.com',
          firstName: 'Ada',
          lastName: 'Lovelace',
          phone: '+441234',
        },
      });

      await service.syncMembershipToStore('user-1', 'store-1');

      expect(syncCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          internalId: 'mem-1',
          email: 'a@example.com',
          loyaltyCardNumber: 'CARD-99',
        }),
      );
      expect(prisma.externalEntityMapping.upsert).toHaveBeenCalledWith({
        where: {
          provider_entityType_internalId_storeId: {
            provider: 'lightspeed',
            entityType: 'CUSTOMER',
            internalId: 'mem-1',
            storeId: '',
          },
        },
        create: expect.objectContaining({
          provider: 'lightspeed',
          entityType: 'CUSTOMER',
          internalId: 'mem-1',
          externalId: 'ls-cust-1',
          storeId: '',
          accountKey: 'acct-a',
          syncStatus: 'SYNCED',
        }),
        update: expect.objectContaining({
          externalId: 'ls-cust-1',
          accountKey: 'acct-a',
          syncStatus: 'SYNCED',
        }),
      });
    });

    it('skips when both optInEmail and optInSms are false', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'conn-1',
        storeId: 'store-1',
        provider: 'lightspeed',
        credentials: 'enc',
      });
      prisma.loyaltyMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        userId: 'user-1',
        optInEmail: false,
        optInSms: false,
        user: { email: 'a@example.com' },
      });

      await service.syncMembershipToStore('user-1', 'store-1');

      expect(factory.create).not.toHaveBeenCalled();
      expect(prisma.externalEntityMapping.upsert).not.toHaveBeenCalled();
    });

    it('skips when no active connection', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue(null);
      await service.syncMembershipToStore('user-1', 'store-1');
      expect(factory.create).not.toHaveBeenCalled();
    });
  });

  describe('syncMembershipToAllPosStores', () => {
    it('dedupes by domainPrefix so one account is synced once', async () => {
      const { service, prisma, encryption } = makeMocks();
      prisma.pOSConnection.findMany.mockResolvedValue([
        { storeId: 'store-1', credentials: 'enc-a' },
        { storeId: 'store-2', credentials: 'enc-a2' },
        { storeId: 'store-3', credentials: 'enc-b' },
      ]);
      encryption.decryptJson
        .mockReturnValueOnce({ domainPrefix: 'acct-a' }) // dedupe pass store-1
        .mockReturnValueOnce({ domainPrefix: 'acct-a' }) // syncMembershipToStore store-1
        .mockReturnValueOnce({ domainPrefix: 'acct-a' }) // dedupe pass store-2 (skip)
        .mockReturnValueOnce({ domainPrefix: 'acct-b' }) // dedupe pass store-3
        .mockReturnValueOnce({ domainPrefix: 'acct-b' }); // syncMembershipToStore store-3

      prisma.pOSConnection.findFirst
        .mockResolvedValueOnce({
          id: 'c1',
          storeId: 'store-1',
          provider: 'lightspeed',
          credentials: 'enc-a',
        })
        .mockResolvedValueOnce({
          id: 'c3',
          storeId: 'store-3',
          provider: 'lightspeed',
          credentials: 'enc-b',
        });

      prisma.loyaltyMembership.findUnique.mockResolvedValue({
        id: 'mem-1',
        optInEmail: true,
        optInSms: true,
        user: { email: 'a@example.com', firstName: 'A', lastName: 'B', phone: null },
        cardNumber: null,
      });

      await service.syncMembershipToAllPosStores('user-1');

      expect(prisma.pOSConnection.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.pOSConnection.findFirst).toHaveBeenNthCalledWith(1, {
        where: { storeId: 'store-1', isActive: true },
      });
      expect(prisma.pOSConnection.findFirst).toHaveBeenNthCalledWith(2, {
        where: { storeId: 'store-3', isActive: true },
      });
    });
  });
});
