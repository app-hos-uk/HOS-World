import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { ShippingService } from './shipping.service';
import { PrismaService } from '../database/prisma.service';

describe('ShippingService', () => {
  let service: ShippingService;

  const mockPrisma = {
    seller: {
      findUnique: jest.fn(),
    },
    shippingMethod: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    shippingRule: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(ShippingService);
    jest.clearAllMocks();
  });

  describe('getSellerByUserId', () => {
    it('returns seller id for user', async () => {
      mockPrisma.seller.findUnique.mockResolvedValue({ id: 'seller-1' });

      await expect(service.getSellerByUserId('user-1')).resolves.toEqual({ id: 'seller-1' });
    });
  });

  describe('findShippingMethodById', () => {
    it('throws NotFoundException when method missing', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue(null);

      await expect(service.findShippingMethodById('missing')).rejects.toThrow(NotFoundException);
    });

    it('normalizes decimal rule fields to numbers', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue({
        id: 'method-1',
        name: 'Standard',
        description: '5-7 days',
        type: 'FLAT_RATE',
        rules: [
          {
            id: 'rule-1',
            name: 'US flat',
            priority: 1,
            rate: new Decimal(5.99),
            minimumCharge: new Decimal(3),
            freeShippingThreshold: new Decimal(50),
            estimatedDays: 5,
            conditions: {},
          },
        ],
        seller: null,
      });

      const method = await service.findShippingMethodById('method-1');

      expect(method.rules[0].rate).toBe(5.99);
      expect(method.rules[0].minimumCharge).toBe(3);
      expect(method.rules[0].freeShippingThreshold).toBe(50);
    });
  });

  describe('calculateShippingRate', () => {
    it('returns flat-rate option for matching destination', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'method-1',
          name: 'Standard',
          description: 'Flat rate',
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'rule-1',
              name: 'US',
              priority: 10,
              rate: new Decimal(8),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 3,
              isActive: true,
              conditions: { countries: ['US'] },
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(2, 40, { country: 'US' });

      expect(options).toHaveLength(1);
      expect(options[0].rate).toBe(8);
      expect(options[0].method.name).toBe('Standard');
    });

    it('applies free shipping when cart value meets threshold', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'method-1',
          name: 'Free over 50',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'rule-1',
              name: 'US',
              priority: 10,
              rate: new Decimal(10),
              minimumCharge: null,
              freeShippingThreshold: new Decimal(50),
              estimatedDays: 3,
              isActive: true,
              conditions: { countries: ['US'] },
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(2, 75, { country: 'US' });

      expect(options[0].rate).toBe(0);
      expect(options[0].freeShipping).toBe(true);
    });
  });
});
