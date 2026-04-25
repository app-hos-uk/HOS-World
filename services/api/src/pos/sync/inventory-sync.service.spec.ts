import { PosInventorySyncService } from './inventory-sync.service';

function makeMocks() {
  const prisma: any = {
    pOSConnection: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    pOSSale: { findUnique: jest.fn() },
    inventoryLocation: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    order: { findFirst: jest.fn() },
    productChannel: { findMany: jest.fn().mockResolvedValue([]) },
    externalEntityMapping: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const inventory: any = {
    recordStockMovement: jest.fn().mockResolvedValue({}),
  };
  const discrepancies: any = {
    createDiscrepancy: jest.fn().mockResolvedValue({}),
  };
  const factory: any = {
    create: jest.fn().mockReturnValue({
      authenticate: jest.fn(),
      getInventory: jest.fn().mockResolvedValue(10),
      updateInventory: jest.fn(),
    }),
  };
  const encryption: any = {
    decryptJson: jest.fn().mockReturnValue({}),
  };
  const config: any = {
    get: jest.fn().mockImplementation((key: string, def?: any) => {
      if (key === 'POS_ENABLED') return 'true';
      if (key === 'POS_INVENTORY_DISCREPANCY_THRESHOLD') return 0;
      return def;
    }),
  };

  const service = new PosInventorySyncService(
    prisma,
    inventory,
    discrepancies,
    factory,
    encryption,
    config,
  );
  return { service, prisma, inventory, discrepancies, factory, config };
}

describe('PosInventorySyncService', () => {
  describe('applyPosSaleToInventory', () => {
    it('skips when no active connection', async () => {
      const { service, prisma, inventory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue(null);
      await service.applyPosSaleToInventory('s1', 'sale-1');
      expect(inventory.recordStockMovement).not.toHaveBeenCalled();
    });

    it('skips when autoSyncInventory is false', async () => {
      const { service, prisma, inventory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        autoSyncInventory: false,
      });
      await service.applyPosSaleToInventory('s1', 'sale-1');
      expect(inventory.recordStockMovement).not.toHaveBeenCalled();
    });

    it('records stock movements for each sale item', async () => {
      const { service, prisma, inventory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        autoSyncInventory: true,
        settings: null,
      });
      prisma.pOSSale.findUnique.mockResolvedValue({
        id: 'sale-1',
        items: [
          { productId: 'p1', quantity: 2 },
          { productId: 'p2', quantity: 1 },
        ],
      });
      prisma.inventoryLocation.findFirst.mockResolvedValue({ id: 'loc-1' });

      await service.applyPosSaleToInventory('s1', 'sale-1');

      expect(inventory.recordStockMovement).toHaveBeenCalledTimes(2);
      expect(inventory.recordStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          inventoryLocationId: 'loc-1',
          productId: 'p1',
          quantity: 2,
          movementType: 'OUT',
          referenceType: 'POS_SALE',
          referenceId: 'sale-1',
        }),
        undefined,
      );
    });

    it('skips items with no productId', async () => {
      const { service, prisma, inventory } = makeMocks();
      prisma.pOSConnection.findFirst.mockResolvedValue({
        autoSyncInventory: true,
        settings: null,
      });
      prisma.pOSSale.findUnique.mockResolvedValue({
        id: 'sale-1',
        items: [{ productId: null, quantity: 3 }],
      });
      await service.applyPosSaleToInventory('s1', 'sale-1');
      expect(inventory.recordStockMovement).not.toHaveBeenCalled();
    });
  });

  describe('syncOnlineOrderToPos', () => {
    it('skips when POS is disabled', async () => {
      const { service, config, factory } = makeMocks();
      config.get.mockReturnValue('false');
      await service.syncOnlineOrderToPos('ord-1');
      expect(factory.create).not.toHaveBeenCalled();
    });

    it('decrements POS stock for mapped products', async () => {
      const { service, prisma, factory } = makeMocks();
      prisma.order.findFirst.mockResolvedValue({
        id: 'ord-1',
        items: [{ productId: 'p1', quantity: 3 }],
      });
      prisma.productChannel.findMany.mockResolvedValue([
        { storeId: 's1', productId: 'p1', channelType: 'STORE' },
      ]);
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: '{}',
        autoSyncInventory: true,
        externalOutletId: 'out-1',
      });
      prisma.externalEntityMapping.findMany.mockResolvedValue([]);
      const findFirstMapping = jest.fn().mockResolvedValue({ externalId: 'ext-p1' });
      prisma.externalEntityMapping.findFirst = findFirstMapping;

      const adapter = {
        authenticate: jest.fn(),
        getInventory: jest.fn().mockResolvedValue(20),
        updateInventory: jest.fn(),
      };
      factory.create.mockReturnValue(adapter);

      await service.syncOnlineOrderToPos('ord-1');

      expect(adapter.getInventory).toHaveBeenCalledWith('ext-p1', 'out-1');
      expect(adapter.updateInventory).toHaveBeenCalledWith('ext-p1', 'out-1', 17);
    });
  });

  describe('nightlyReconciliation', () => {
    it('skips when POS disabled', async () => {
      const { service, prisma, config, discrepancies } = makeMocks();
      config.get.mockImplementation((key: string) =>
        key === 'POS_ENABLED' ? 'false' : undefined,
      );
      await service.nightlyReconciliation();
      expect(discrepancies.createDiscrepancy).not.toHaveBeenCalled();
    });

    it('creates discrepancy when quantities differ', async () => {
      const { service, prisma, factory, discrepancies } = makeMocks();
      prisma.pOSConnection.findMany.mockResolvedValue([
        {
          id: 'c1',
          provider: 'lightspeed',
          storeId: 's1',
          externalOutletId: 'out-1',
          credentials: '{}',
          isActive: true,
          settings: null,
          store: { code: 'S1', externalStoreId: null },
        },
      ]);
      prisma.externalEntityMapping.findMany.mockResolvedValue([
        {
          externalId: 'ext-p1',
          internalId: 'p1',
          syncStatus: 'SYNCED',
        },
      ]);
      const adapter = {
        authenticate: jest.fn(),
        getInventory: jest.fn().mockResolvedValue(5),
      };
      factory.create.mockReturnValue(adapter);
      prisma.inventoryLocation.findFirst.mockResolvedValue({ id: 'loc-1' });
      prisma.inventoryLocation.findUnique.mockResolvedValue({ quantity: 10 });

      await service.nightlyReconciliation();

      expect(discrepancies.createDiscrepancy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INVENTORY',
          productId: 'p1',
          expectedValue: expect.objectContaining({ source: 'HOS', quantity: 10 }),
          actualValue: expect.objectContaining({ source: 'POS', quantity: 5 }),
        }),
      );
    });
  });
});
