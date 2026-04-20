import { PosProductSyncService } from './product-sync.service';

function makeMocks() {
  const prisma: any = {
    pOSConnection: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    productChannel: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    product: { findUnique: jest.fn() },
    externalEntityMapping: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const factory: any = {
    create: jest.fn().mockReturnValue({
      authenticate: jest.fn(),
      syncProduct: jest.fn().mockResolvedValue('ext-123'),
    }),
  };
  const encryption: any = {
    decryptJson: jest.fn().mockReturnValue({ domainPrefix: 'd' }),
  };
  const service = new PosProductSyncService(prisma, factory, encryption);
  return { service, prisma, factory, encryption };
}

describe('PosProductSyncService', () => {
  describe('syncProductToStore', () => {
    it('skips when no active POS connection', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue(null);
      await service.syncProductToStore('p1', 's1');
      expect(factory.create).not.toHaveBeenCalled();
    });

    it('skips when autoSyncProducts is false', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'c1',
        storeId: 's1',
        autoSyncProducts: false,
        store: { externalStoreId: 'ext' },
      });
      await service.syncProductToStore('p1', 's1');
      expect(factory.create).not.toHaveBeenCalled();
    });

    it('skips when no STORE channel for product', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'c1',
        storeId: 's1',
        autoSyncProducts: true,
        externalOutletId: 'out1',
        store: {},
      });
      prisma.productChannel.findFirst.mockResolvedValue(null);
      await service.syncProductToStore('p1', 's1');
      expect(factory.create).not.toHaveBeenCalled();
    });

    it('creates mapping on first sync', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'c1',
        storeId: 's1',
        autoSyncProducts: true,
        externalOutletId: 'out1',
        provider: 'lightspeed',
        credentials: '{}',
        store: { externalStoreId: null },
      });
      prisma.productChannel.findFirst.mockResolvedValue({
        sellingPrice: 29.99,
        costPrice: 10,
      });
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Widget',
        sku: 'WDG-1',
        description: 'A widget',
        images: [{ url: 'https://img.test/1.jpg' }],
        categoryRelation: { name: 'Gadgets' },
        fandom: null,
        tags: ['cool'],
      });
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);

      await service.syncProductToStore('p1', 's1');

      expect(prisma.externalEntityMapping.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            provider: 'lightspeed',
            entityType: 'PRODUCT',
            internalId: 'p1',
            externalId: 'ext-123',
            storeId: 's1',
            syncStatus: 'SYNCED',
          }),
        }),
      );
    });

    it('updates existing mapping on subsequent sync', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'c1',
        storeId: 's1',
        autoSyncProducts: true,
        externalOutletId: 'out1',
        provider: 'lightspeed',
        credentials: '{}',
        store: {},
      });
      prisma.productChannel.findFirst.mockResolvedValue({
        sellingPrice: 29.99,
        costPrice: null,
      });
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Widget',
        sku: 'WDG-1',
        description: null,
        images: [],
        categoryRelation: null,
        fandom: 'Anime',
        tags: [],
      });
      prisma.externalEntityMapping.findFirst.mockResolvedValue({
        id: 'map-1',
        externalId: 'old-ext',
      });

      await service.syncProductToStore('p1', 's1');

      expect(prisma.externalEntityMapping.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'map-1' },
          data: expect.objectContaining({
            externalId: 'ext-123',
            syncStatus: 'SYNCED',
          }),
        }),
      );
    });

    it('marks mapping FAILED when adapter throws', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        id: 'c1',
        storeId: 's1',
        autoSyncProducts: true,
        externalOutletId: 'out1',
        provider: 'lightspeed',
        credentials: '{}',
        store: {},
      });
      prisma.productChannel.findFirst.mockResolvedValue({ sellingPrice: 10 });
      prisma.product.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'W',
        sku: 'S',
        description: null,
        images: [],
        categoryRelation: null,
        fandom: null,
        tags: [],
      });
      prisma.externalEntityMapping.findFirst.mockResolvedValue(null);
      factory.create.mockReturnValue({
        authenticate: jest.fn(),
        syncProduct: jest.fn().mockRejectedValue(new Error('API down')),
      });

      await service.syncProductToStore('p1', 's1');

      expect(prisma.externalEntityMapping.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ syncStatus: 'FAILED', syncError: 'API down' }),
        }),
      );
    });
  });

  describe('syncAllProductsForStore', () => {
    it('syncs each product channel', async () => {
      const { service, prisma } = makeMocks();
      prisma.productChannel.findMany.mockResolvedValue([
        { productId: 'p1' },
        { productId: 'p2' },
      ]);
      const spy = jest.spyOn(service, 'syncProductToStore').mockResolvedValue();
      await service.syncAllProductsForStore('s1');
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenCalledWith('p1', 's1');
      expect(spy).toHaveBeenCalledWith('p2', 's1');
    });
  });
});
