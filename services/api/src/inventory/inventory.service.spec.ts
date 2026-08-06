import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../database/prisma.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockPrisma = {
    warehouse: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    seller: {
      findUnique: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    inventoryLocation: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
    stockReservation: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(InventoryService);
    jest.clearAllMocks();
  });

  describe('createWarehouse', () => {
    it('throws when warehouse code already exists', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1', code: 'MAIN' });

      await expect(
        service.createWarehouse({
          name: 'Main',
          code: 'main',
          address: '1 Warehouse Rd',
          city: 'London',
          country: 'GB',
          postalCode: 'E1 1AA',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates warehouse with uppercased code', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);
      mockPrisma.warehouse.create.mockResolvedValue({ id: 'wh-1', code: 'MAIN' });

      await service.createWarehouse({
        name: 'Main',
        code: 'main',
        address: '1 Warehouse Rd',
        city: 'London',
        country: 'GB',
        postalCode: 'E1 1AA',
      } as any);

      expect(mockPrisma.warehouse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'MAIN' }),
        }),
      );
    });
  });

  describe('findWarehouseById', () => {
    it('throws NotFoundException when warehouse missing', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(service.findWarehouseById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertInventoryLocation', () => {
    it('rejects non-integer quantity', async () => {
      await expect(
        service.upsertInventoryLocation({
          warehouseId: 'wh-1',
          productId: 'prod-1',
          quantity: 1.5,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('forbids sellers from updating another seller product inventory', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        sellerId: 'seller-other',
      });
      mockPrisma.seller.findUnique.mockResolvedValue({ id: 'seller-me' });

      await expect(
        service.upsertInventoryLocation(
          { warehouseId: 'wh-1', productId: 'prod-1', quantity: 5 } as any,
          'user-1',
          'SELLER',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getProductInventory', () => {
    it('aggregates quantity and reservations across locations', async () => {
      mockPrisma.inventoryLocation.findMany.mockResolvedValue([
        {
          id: 'loc-1',
          productId: 'prod-1',
          quantity: 10,
          warehouse: { id: 'wh-1' },
          stockReservations: [{ quantity: 3 }],
        },
        {
          id: 'loc-2',
          productId: 'prod-1',
          quantity: 5,
          warehouse: { id: 'wh-2' },
          stockReservations: [{ quantity: 1 }],
        },
      ]);

      const result = await service.getProductInventory('prod-1');

      expect(result.summary).toEqual({
        totalQuantity: 15,
        totalReserved: 4,
        totalAvailable: 11,
      });
    });
  });

  describe('reserveStock', () => {
    it('throws when quantity is not a positive integer', async () => {
      await expect(
        service.reserveStock({ inventoryLocationId: 'loc-1', quantity: 0 } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when requested quantity exceeds available stock', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          $executeRaw: jest.fn(),
          inventoryLocation: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'loc-1',
              quantity: 5,
              stockReservations: [{ quantity: 4 }],
            }),
            update: jest.fn(),
          },
          stockReservation: { create: jest.fn() },
        }),
      );

      await expect(
        service.reserveStock({
          inventoryLocationId: 'loc-1',
          quantity: 2,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllWarehouses', () => {
    it('returns only active warehouses by default', async () => {
      mockPrisma.warehouse.findMany.mockResolvedValue([{ id: 'wh-1', isActive: true }]);

      await service.findAllWarehouses(false);

      expect(mockPrisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        }),
      );
    });

    it('includes inactive warehouses when includeInactive=true', async () => {
      mockPrisma.warehouse.findMany.mockResolvedValue([]);

      await service.findAllWarehouses(true);

      expect(mockPrisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('scopes to seller warehouses for seller roles', async () => {
      (mockPrisma as any).seller = { findUnique: jest.fn().mockResolvedValue({ id: 'seller-1' }) };
      mockPrisma.warehouse.findMany.mockResolvedValue([]);

      await service.findAllWarehouses(false, 'user-1', 'SELLER');

      expect(mockPrisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sellerId: 'seller-1' }),
        }),
      );
    });
  });

  describe('confirmReservation', () => {
    it('throws NotFoundException when reservation is missing', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          $executeRaw: jest.fn(),
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
          },
          inventoryLocation: { update: jest.fn() },
        }),
      );

      await expect(service.confirmReservation('res-1', 'ord-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when reservation is not active', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          $executeRaw: jest.fn(),
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'res-1',
              status: 'CONFIRMED',
              inventoryLocation: { id: 'loc-1' },
            }),
            update: jest.fn(),
          },
          inventoryLocation: { update: jest.fn() },
        }),
      );

      await expect(service.confirmReservation('res-1', 'ord-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws when reservation is expired', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          $executeRaw: jest.fn(),
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'res-1',
              status: 'ACTIVE',
              expiresAt: new Date(Date.now() - 3600_000),
              inventoryLocation: { id: 'loc-1' },
              inventoryLocationId: 'loc-1',
            }),
            update: jest.fn(),
          },
          inventoryLocation: { update: jest.fn() },
        }),
      );

      await expect(service.confirmReservation('res-1', 'ord-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelReservation', () => {
    it('throws NotFoundException when reservation missing', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          $executeRaw: jest.fn(),
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
          },
          seller: { findUnique: jest.fn() },
          inventoryLocation: { update: jest.fn() },
        }),
      );

      await expect(service.cancelReservation('res-1')).rejects.toThrow(NotFoundException);
    });

    it('throws when reservation is already cancelled', async () => {
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          $executeRaw: jest.fn(),
          stockReservation: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'res-1',
              status: 'CANCELLED',
              inventoryLocation: { id: 'loc-1', warehouse: {} },
              inventoryLocationId: 'loc-1',
            }),
            update: jest.fn(),
          },
          seller: { findUnique: jest.fn() },
          inventoryLocation: { update: jest.fn() },
        }),
      );

      await expect(service.cancelReservation('res-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getLowStockAlerts', () => {
    it('returns items where quantity <= threshold', async () => {
      mockPrisma.inventoryLocation.findMany.mockResolvedValue([
        {
          quantity: 3,
          lowStockThreshold: 10,
          warehouse: { name: 'Main' },
          product: { id: 'p1', name: 'Wand', sku: 'WND-01' },
        },
        {
          quantity: 0,
          lowStockThreshold: 5,
          warehouse: { name: 'Main' },
          product: { id: 'p2', name: 'Robe', sku: 'RBE-01' },
        },
        {
          quantity: 50,
          lowStockThreshold: 10,
          warehouse: { name: 'Main' },
          product: { id: 'p3', name: 'Hat', sku: 'HAT-01' },
        },
      ]);

      const alerts = await service.getLowStockAlerts();
      expect(alerts).toHaveLength(2);
      expect(alerts[0].status).toBe('LOW_STOCK');
      expect(alerts[1].status).toBe('OUT_OF_STOCK');
    });
  });

  describe('allocateStockForOrder', () => {
    it('throws BadRequestException when insufficient stock', async () => {
      mockPrisma.inventoryLocation.findMany.mockResolvedValue([]);

      await expect(
        service.allocateStockForOrder([{ productId: 'p1', quantity: 5 }]),
      ).rejects.toThrow(BadRequestException);
    });

    it('allocates across multiple warehouses', async () => {
      mockPrisma.inventoryLocation.findMany.mockResolvedValue([
        {
          id: 'loc-1',
          warehouseId: 'wh-1',
          quantity: 3,
          warehouse: { name: 'A', isActive: true },
          stockReservations: [],
        },
        {
          id: 'loc-2',
          warehouseId: 'wh-2',
          quantity: 5,
          warehouse: { name: 'B', isActive: true },
          stockReservations: [],
        },
      ]);

      const allocations = await service.allocateStockForOrder([{ productId: 'p1', quantity: 7 }]);
      const totalAllocated = allocations.reduce((s: number, a: any) => s + a.quantity, 0);
      expect(totalAllocated).toBe(7);
    });
  });

  describe('transferStock', () => {
    it('throws when source and destination are the same', async () => {
      await expect(
        service.transferStock(
          { fromWarehouseId: 'wh-1', toWarehouseId: 'wh-1', productId: 'p1', quantity: 5 } as any,
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when quantity is not a positive integer', async () => {
      await expect(
        service.transferStock(
          { fromWarehouseId: 'wh-1', toWarehouseId: 'wh-2', productId: 'p1', quantity: -1 } as any,
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateWarehouse', () => {
    it('throws NotFoundException when warehouse missing', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);
      await expect(service.updateWarehouse('wh-missing', { name: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteWarehouse', () => {
    it('throws NotFoundException when warehouse missing', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);
      await expect(service.deleteWarehouse('wh-missing')).rejects.toThrow(NotFoundException);
    });

    it('throws when warehouse has inventory', async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue({
        id: 'wh-1',
        inventory: [{ id: 'inv-1' }],
        transfersFrom: [],
        transfersTo: [],
      });
      await expect(service.deleteWarehouse('wh-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordStockMovement', () => {
    it('throws when quantity is not a positive integer', async () => {
      await expect(
        service.recordStockMovement({
          inventoryLocationId: 'loc-1',
          productId: 'p1',
          quantity: 0,
          movementType: 'IN',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
