import { ClickCollectService } from './click-collect.service';

describe('ClickCollectService', () => {
  let service: ClickCollectService;
  let prisma: any;
  let inventory: any;
  let config: any;
  let bus: any;
  let earn: any;

  beforeEach(() => {
    prisma = {
      order: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      store: { findUnique: jest.fn(), findMany: jest.fn() },
      clickCollectOrder: {
        create: jest.fn().mockResolvedValue({ id: 'cc1' }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      inventoryLocation: { findMany: jest.fn() },
      stockReservation: { findMany: jest.fn() },
      productChannel: { findMany: jest.fn() },
      pOSSale: { findMany: jest.fn() },
    };
    inventory = { reserveStock: jest.fn(), cancelReservation: jest.fn() };
    config = {
      get: jest.fn((k: string, d?: unknown) => {
        if (k === 'CC_EXPIRY_HOURS') return '72';
        if (k === 'CC_BONUS_POINTS') return '0';
        if (k === 'CC_REMINDER_HOURS_BEFORE') return '24';
        return d;
      }),
    };
    bus = { emit: jest.fn() };
    earn = { processOrderComplete: jest.fn(), applyDeferredClickCollectBonus: jest.fn() };
    service = new ClickCollectService(prisma, inventory, config, bus, earn);
  });

  it('getEligibleStores returns stores with channels for all products', async () => {
    prisma.productChannel.findMany.mockResolvedValue([
      { storeId: 'st1', productId: 'p1' },
      { storeId: 'st1', productId: 'p2' },
      { storeId: 'st2', productId: 'p1' },
    ]);
    prisma.store.findMany.mockResolvedValue([{ id: 'st1', name: 'A' }]);
    const r = await service.getEligibleStores(['p1', 'p2']);
    expect(r).toEqual([{ id: 'st1', name: 'A' }]);
  });

  it('getEligibleStores empty ids returns active stores', async () => {
    prisma.store.findMany.mockResolvedValue([{ id: 'st1' }]);
    const r = await service.getEligibleStores([]);
    expect(r).toHaveLength(1);
    expect(prisma.store.findMany).toHaveBeenCalled();
  });

  it('expireStaleOrders cancels reservations and sets EXPIRED', async () => {
    prisma.clickCollectOrder.findMany.mockResolvedValue([
      { id: 'cc1', orderId: 'o1' },
    ]);
    prisma.stockReservation.findMany.mockResolvedValue([]);
    const n = await service.expireStaleOrders();
    expect(n).toBe(1);
    expect(prisma.clickCollectOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cc1' },
        data: { status: 'EXPIRED' },
      }),
    );
  });

  it('markReady emits marketing event', async () => {
    prisma.clickCollectOrder.findUnique.mockResolvedValue({
      id: 'cc1',
      orderId: 'o1',
      storeId: 's1',
      status: 'PREPARING',
      order: {
        userId: 'u1',
        items: [],
      },
      store: {},
    });
    prisma.clickCollectOrder.update.mockResolvedValue({});
    await service.markReady('cc1');
    expect(bus.emit).toHaveBeenCalledWith(
      'CLICK_COLLECT_READY',
      'u1',
      expect.objectContaining({ orderId: 'o1' }),
    );
  });

  it('markCollected triggers earn when no points yet', async () => {
    prisma.clickCollectOrder.findUnique.mockResolvedValue({
      id: 'cc1',
      orderId: 'o1',
      storeId: 's1',
      status: 'READY',
      order: { userId: 'u1', items: [] },
      store: {},
    });
    prisma.clickCollectOrder.update.mockResolvedValue({});
    prisma.order.findUnique.mockResolvedValue({ loyaltyPointsEarned: 0 });
    await service.markCollected('cc1', 'staff1');
    expect(earn.processOrderComplete).toHaveBeenCalledWith('o1');
  });

  it('markCollected skips earn when points already awarded', async () => {
    prisma.clickCollectOrder.findUnique.mockResolvedValue({
      id: 'cc1',
      orderId: 'o1',
      storeId: 's1',
      status: 'READY',
      order: { userId: 'u1', items: [] },
      store: {},
    });
    prisma.clickCollectOrder.update.mockResolvedValue({});
    prisma.order.findUnique.mockResolvedValue({ loyaltyPointsEarned: 10 });
    await service.markCollected('cc1');
    expect(earn.processOrderComplete).not.toHaveBeenCalled();
  });

  it('findBestInventoryLocationId picks highest availability', async () => {
    prisma.store.findUnique.mockResolvedValue({ country: 'GB' });
    prisma.inventoryLocation.findMany.mockResolvedValue([
      {
        id: 'loc1',
        quantity: 5,
        stockReservations: [],
      },
      {
        id: 'loc2',
        quantity: 10,
        stockReservations: [{ quantity: 2 }],
      },
    ]);
    const id = await service.findBestInventoryLocationId('s1', 'p1');
    expect(id).toBe('loc2');
  });

  it('getStoreAvailability returns grouped counts', async () => {
    prisma.clickCollectOrder.groupBy.mockResolvedValue([
      { status: 'PENDING', _count: { id: 2 } },
      { status: 'READY', _count: { id: 1 } },
    ]);
    const r = await service.getStoreAvailability('s1');
    expect(r.byStatus.PENDING).toBe(2);
    expect(r.byStatus.READY).toBe(1);
  });

  it('cancelClickCollect releases stock', async () => {
    prisma.clickCollectOrder.findUnique.mockResolvedValue({
      id: 'cc1',
      orderId: 'o1',
      status: 'PENDING',
      order: { items: [] },
      store: {},
    });
    prisma.stockReservation.findMany.mockResolvedValue([{ id: 'r1' }]);
    prisma.clickCollectOrder.update.mockResolvedValue({});
    await service.cancelClickCollect('cc1');
    expect(inventory.cancelReservation).toHaveBeenCalledWith('r1');
  });

  it('createClickCollect invokes deferred loyalty bonus hook after success', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      paymentStatus: 'PAID',
      clickCollect: null,
      items: [{ productId: 'p1', quantity: 1 }],
    });
    prisma.store.findUnique.mockResolvedValue({ id: 's1', country: 'GB' });
    prisma.inventoryLocation.findMany.mockResolvedValue([
      { id: 'loc1', quantity: 5, stockReservations: [] },
    ]);
    inventory.reserveStock.mockResolvedValue({});
    await service.createClickCollect('u1', { orderId: 'o1', storeId: 's1' } as any);
    expect(earn.applyDeferredClickCollectBonus).toHaveBeenCalledWith('o1');
  });

  it('createClickCollect fails when any item has no inventory', async () => {
    prisma.order.findFirst.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      paymentStatus: 'PAID',
      clickCollect: null,
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 2 },
      ],
    });
    prisma.store.findUnique.mockResolvedValue({ id: 's1', country: 'GB' });
    prisma.inventoryLocation.findMany
      .mockResolvedValueOnce([{ id: 'loc1', quantity: 5, stockReservations: [] }])
      .mockResolvedValueOnce([]);
    prisma.stockReservation.findMany.mockResolvedValue([{ id: 'r1' }]);

    await expect(
      service.createClickCollect('u1', { orderId: 'o1', storeId: 's1' } as any),
    ).rejects.toThrow('Insufficient stock');
    expect(inventory.cancelReservation).toHaveBeenCalledWith('r1');
  });

  it('markPreparing rejects wrong status', async () => {
    prisma.clickCollectOrder.findUnique.mockResolvedValue({
      id: 'cc1',
      status: 'READY',
      order: { items: [] },
      store: {},
    });
    await expect(service.markPreparing('cc1')).rejects.toThrow();
  });
});
