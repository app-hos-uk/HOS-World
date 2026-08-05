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
});
