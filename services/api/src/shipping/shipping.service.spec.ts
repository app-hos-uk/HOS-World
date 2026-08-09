import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
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
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    shippingRule: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    shippingCarrier: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShippingService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(ShippingService);
    jest.clearAllMocks();
  });

  describe('getSellerByUserId', () => {
    it('returns seller id for user', async () => {
      mockPrisma.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
      await expect(service.getSellerByUserId('user-1')).resolves.toEqual({ id: 'seller-1' });
    });

    it('returns null when seller not found', async () => {
      mockPrisma.seller.findUnique.mockResolvedValue(null);
      await expect(service.getSellerByUserId('unknown')).resolves.toBeNull();
    });
  });

  describe('createShippingMethod', () => {
    it('creates a shipping method with default isActive', async () => {
      const dto = { name: 'Standard', description: '5 days', type: 'FLAT_RATE', sellerId: null };
      const created = { id: 'sm-1', ...dto, isActive: true, rules: [], seller: null };
      mockPrisma.shippingMethod.create.mockResolvedValue(created);

      const result = await service.createShippingMethod(dto as any);
      expect(result).toEqual(created);
      expect(mockPrisma.shippingMethod.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Standard', isActive: true }),
        }),
      );
    });

    it('creates a shipping method with isActive false', async () => {
      const dto = {
        name: 'Draft',
        description: null,
        type: 'WEIGHT_BASED',
        sellerId: 's-1',
        isActive: false,
      };
      const created = { id: 'sm-2', ...dto, rules: [], seller: { id: 's-1', storeName: 'Shop' } };
      mockPrisma.shippingMethod.create.mockResolvedValue(created);

      const result = await service.createShippingMethod(dto as any);
      expect(result.isActive).toBe(false);
    });
  });

  describe('findAllShippingMethods', () => {
    it('returns methods with rules normalized to numbers', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'sm-1',
          name: 'Standard',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'US',
              priority: 10,
              rate: new Decimal(5.99),
              minimumCharge: new Decimal(2),
              freeShippingThreshold: new Decimal(75),
              estimatedDays: 5,
              isActive: true,
              conditions: { country: 'US' },
            },
          ],
          seller: null,
        },
      ]);

      const result = await service.findAllShippingMethods();
      expect(result).toHaveLength(1);
      expect(result[0].rules[0].rate).toBe(5.99);
      expect(result[0].rules[0].minimumCharge).toBe(2);
      expect(result[0].rules[0].freeShippingThreshold).toBe(75);
    });

    it('handles null minimumCharge and freeShippingThreshold', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'sm-2',
          name: 'Express',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-2',
              name: 'Global',
              priority: 5,
              rate: new Decimal(12),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 2,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const result = await service.findAllShippingMethods();
      expect(result[0].rules[0].minimumCharge).toBeNull();
      expect(result[0].rules[0].freeShippingThreshold).toBeNull();
    });

    it('filters by sellerId when provided', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([]);
      await service.findAllShippingMethods('seller-1');
      expect(mockPrisma.shippingMethod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sellerId: 'seller-1' }),
        }),
      );
    });

    it('filters platform-wide when no sellerId', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([]);
      await service.findAllShippingMethods();
      expect(mockPrisma.shippingMethod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sellerId: null }),
        }),
      );
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

  describe('createShippingRule', () => {
    it('creates rule with proper Decimal conversion', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue({
        id: 'sm-1',
        name: 'Std',
        type: 'FLAT_RATE',
        rules: [],
        seller: null,
      });
      mockPrisma.shippingRule.create.mockResolvedValue({
        id: 'rule-1',
        shippingMethodId: 'sm-1',
        name: 'US Standard',
        shippingMethod: { id: 'sm-1' },
      });

      const dto = {
        shippingMethodId: 'sm-1',
        name: 'US Standard',
        priority: 10,
        rate: 5.99,
        minimumCharge: 2,
        freeShippingThreshold: 75,
        estimatedDays: 5,
        conditions: { country: 'US' },
      };

      await service.createShippingRule(dto as any);
      expect(mockPrisma.shippingRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'US Standard',
            priority: 10,
          }),
        }),
      );
    });

    it('throws NotFoundException when shipping method does not exist', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue(null);

      await expect(
        service.createShippingRule({ shippingMethodId: 'missing', name: 'X', rate: 5 } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('handles null minimumCharge and freeShippingThreshold in dto', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue({
        id: 'sm-1',
        name: 'Std',
        type: 'FLAT_RATE',
        rules: [],
        seller: null,
      });
      mockPrisma.shippingRule.create.mockResolvedValue({ id: 'rule-2' });

      const dto = {
        shippingMethodId: 'sm-1',
        name: 'Basic',
        rate: 10,
        minimumCharge: null,
        freeShippingThreshold: null,
        estimatedDays: 3,
      };

      await service.createShippingRule(dto as any);
      expect(mockPrisma.shippingRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            minimumCharge: null,
            freeShippingThreshold: null,
          }),
        }),
      );
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

    it('calculates weight-based rate', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'method-2',
          name: 'Weight Based',
          description: null,
          type: 'WEIGHT_BASED',
          rules: [
            {
              id: 'rule-2',
              name: 'Per kg',
              priority: 10,
              rate: new Decimal(3),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 5,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(5, 40, { country: 'US' });
      expect(options[0].rate).toBe(15); // 3 per kg * 5 kg
    });

    it('returns 0 for FREE_SHIPPING type', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'method-3',
          name: 'Free',
          description: null,
          type: 'FREE_SHIPPING',
          rules: [
            {
              id: 'rule-3',
              name: 'All',
              priority: 1,
              rate: new Decimal(10),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 7,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 10, { country: 'US' });
      expect(options[0].rate).toBe(0);
      expect(options[0].freeShipping).toBe(true);
    });

    it('returns 0 for PICKUP_IN_STORE type', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'method-4',
          name: 'Pickup',
          description: null,
          type: 'PICKUP_IN_STORE',
          rules: [
            {
              id: 'rule-4',
              name: 'Store',
              priority: 1,
              rate: new Decimal(5),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 0,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 10, { country: 'US' });
      expect(options[0].rate).toBe(0);
    });

    it('applies minimum charge floor', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'method-5',
          name: 'Weight Min',
          description: null,
          type: 'WEIGHT_BASED',
          rules: [
            {
              id: 'rule-5',
              name: 'Light',
              priority: 1,
              rate: new Decimal(1),
              minimumCharge: new Decimal(5),
              freeShippingThreshold: null,
              estimatedDays: 3,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      // 1 kg * $1 = $1, but minimumCharge = $5
      const options = await service.calculateShippingRate(1, 20, { country: 'US' });
      expect(options[0].rate).toBe(5);
    });

    it('does not apply minimum charge for FREE_SHIPPING type', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'method-6',
          name: 'Free',
          description: null,
          type: 'FREE_SHIPPING',
          rules: [
            {
              id: 'rule-6',
              name: 'Promo',
              priority: 1,
              rate: new Decimal(0),
              minimumCharge: new Decimal(10),
              freeShippingThreshold: null,
              estimatedDays: 7,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 10, { country: 'US' });
      expect(options[0].rate).toBe(0);
    });

    it('returns empty array when no rules match', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'method-7',
          name: 'US Only',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'rule-7',
              name: 'US',
              priority: 1,
              rate: new Decimal(10),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 5,
              isActive: true,
              conditions: { country: 'US' },
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 10, { country: 'DE' });
      expect(options).toHaveLength(0);
    });

    it('sorts options by rate (lowest first)', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Express',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'Express US',
              priority: 10,
              rate: new Decimal(20),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 2,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
        {
          id: 'm-2',
          name: 'Standard',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-2',
              name: 'Standard US',
              priority: 5,
              rate: new Decimal(5),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 7,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 10, { country: 'US' });
      expect(options[0].rate).toBe(5);
      expect(options[1].rate).toBe(20);
    });

    it('matches country aliases (United States -> US)', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'US Shipping',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'US',
              priority: 10,
              rate: new Decimal(8),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 3,
              isActive: true,
              conditions: { country: 'US' },
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 20, { country: 'United States' });
      expect(options).toHaveLength(1);
      expect(options[0].rate).toBe(8);
    });

    it('matches United Kingdom -> GB alias', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'GB Shipping',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'GB',
              priority: 10,
              rate: new Decimal(12),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 5,
              isActive: true,
              conditions: { countries: ['GB'] },
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 20, { country: 'United Kingdom' });
      expect(options).toHaveLength(1);
    });

    it('respects weight range conditions', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Heavy',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'Heavy only',
              priority: 10,
              rate: new Decimal(25),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 5,
              isActive: true,
              conditions: { weightRange: { min: 10, max: 50 } },
            },
          ],
          seller: null,
        },
      ]);

      const optionsLight = await service.calculateShippingRate(2, 40, { country: 'US' });
      expect(optionsLight).toHaveLength(0);

      const optionsHeavy = await service.calculateShippingRate(15, 40, { country: 'US' });
      expect(optionsHeavy).toHaveLength(1);
      expect(optionsHeavy[0].rate).toBe(25);
    });

    it('respects cartValueRange conditions', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'High Value',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'Min 100',
              priority: 10,
              rate: new Decimal(0),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 3,
              isActive: true,
              conditions: { cartValueRange: { min: 100 } },
            },
          ],
          seller: null,
        },
      ]);

      const lowCart = await service.calculateShippingRate(1, 50, { country: 'US' });
      expect(lowCart).toHaveLength(0);

      const highCart = await service.calculateShippingRate(1, 150, { country: 'US' });
      expect(highCart).toHaveLength(1);
    });

    it('respects state condition', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'CA Only',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'California',
              priority: 10,
              rate: new Decimal(5),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 2,
              isActive: true,
              conditions: { state: 'CA' },
            },
          ],
          seller: null,
        },
      ]);

      const wrongState = await service.calculateShippingRate(1, 20, { country: 'US', state: 'NY' });
      expect(wrongState).toHaveLength(0);

      const rightState = await service.calculateShippingRate(1, 20, { country: 'US', state: 'CA' });
      expect(rightState).toHaveLength(1);
    });

    it('respects postalCode condition', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Local',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'Zip 90210',
              priority: 10,
              rate: new Decimal(3),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 1,
              isActive: true,
              conditions: { postalCode: '90210' },
            },
          ],
          seller: null,
        },
      ]);

      const wrongZip = await service.calculateShippingRate(1, 20, {
        country: 'US',
        postalCode: '10001',
      });
      expect(wrongZip).toHaveLength(0);

      const rightZip = await service.calculateShippingRate(1, 20, {
        country: 'US',
        postalCode: '90210',
      });
      expect(rightZip).toHaveLength(1);
    });

    it('uses DISTANCE_BASED type as flat rate fallback', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Distance',
          description: null,
          type: 'DISTANCE_BASED',
          rules: [
            {
              id: 'r-1',
              name: 'Dist',
              priority: 1,
              rate: new Decimal(7),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 4,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 20, { country: 'US' });
      expect(options[0].rate).toBe(7);
    });

    it('uses HYPERLOCAL type as flat rate', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Hyperlocal',
          description: null,
          type: 'HYPERLOCAL',
          rules: [
            {
              id: 'r-1',
              name: 'Local',
              priority: 1,
              rate: new Decimal(4),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 0,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 10, { country: 'US' });
      expect(options[0].rate).toBe(4);
    });

    it('selects highest priority matching rule', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Multi-rule',
          description: null,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-low',
              name: 'Low Priority',
              priority: 1,
              rate: new Decimal(20),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 7,
              isActive: true,
              conditions: {},
            },
            {
              id: 'r-high',
              name: 'High Priority',
              priority: 100,
              rate: new Decimal(5),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 3,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const options = await service.calculateShippingRate(1, 10, { country: 'US' });
      expect(options[0].rate).toBe(5);
      expect(options[0].rule.name).toBe('High Priority');
    });
  });

  describe('getShippingOptions', () => {
    it('calculates total weight from cart items', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Weight',
          description: null,
          type: 'WEIGHT_BASED',
          rules: [
            {
              id: 'r-1',
              name: 'Per kg',
              priority: 1,
              rate: new Decimal(2),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 5,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const cartItems = [
        { weight: 2, quantity: 3 }, // 6 kg
        { weight: 1, quantity: 2 }, // 2 kg
      ];

      const options = await service.getShippingOptions(cartItems as any, 50, { country: 'US' });
      // Total weight: 8 kg, rate $2/kg = $16
      expect(options[0].rate).toBe(16);
    });

    it('uses default 0.5kg when item has no weight', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'm-1',
          name: 'Weight',
          description: null,
          type: 'WEIGHT_BASED',
          rules: [
            {
              id: 'r-1',
              name: 'Per kg',
              priority: 1,
              rate: new Decimal(10),
              minimumCharge: null,
              freeShippingThreshold: null,
              estimatedDays: 5,
              isActive: true,
              conditions: {},
            },
          ],
          seller: null,
        },
      ]);

      const cartItems = [{ weight: null, quantity: 4 }]; // 0.5 * 4 = 2kg

      const options = await service.getShippingOptions(cartItems as any, 50, { country: 'US' });
      expect(options[0].rate).toBe(20); // 10 * 2
    });
  });

  describe('updateShippingMethod', () => {
    it('updates method name', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue({
        id: 'sm-1',
        name: 'Old',
        rules: [],
        seller: null,
      });
      mockPrisma.shippingMethod.update.mockResolvedValue({ id: 'sm-1', name: 'New', rules: [] });

      const result = await service.updateShippingMethod('sm-1', { name: 'New' } as any);
      expect(result.name).toBe('New');
    });

    it('throws NotFoundException when method not found', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue(null);
      await expect(service.updateShippingMethod('missing', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateShippingRule', () => {
    it('updates rule rate with Decimal conversion', async () => {
      mockPrisma.shippingRule.findUnique.mockResolvedValue({ id: 'r-1', rate: new Decimal(5) });
      mockPrisma.shippingRule.update.mockResolvedValue({ id: 'r-1', rate: new Decimal(8) });

      await service.updateShippingRule('r-1', { rate: 8 } as any);
      expect(mockPrisma.shippingRule.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when rule not found', async () => {
      mockPrisma.shippingRule.findUnique.mockResolvedValue(null);
      await expect(service.updateShippingRule('missing', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('handles null minimumCharge update', async () => {
      mockPrisma.shippingRule.findUnique.mockResolvedValue({ id: 'r-1' });
      mockPrisma.shippingRule.update.mockResolvedValue({ id: 'r-1' });

      await service.updateShippingRule('r-1', { minimumCharge: null } as any);
      expect(mockPrisma.shippingRule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ minimumCharge: null }),
        }),
      );
    });

    it('handles conditions update', async () => {
      mockPrisma.shippingRule.findUnique.mockResolvedValue({ id: 'r-1' });
      mockPrisma.shippingRule.update.mockResolvedValue({ id: 'r-1' });

      await service.updateShippingRule('r-1', { conditions: { country: 'CA' } } as any);
      expect(mockPrisma.shippingRule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ conditions: { country: 'CA' } }),
        }),
      );
    });
  });

  describe('deleteMethod', () => {
    it('deletes method and its rules', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue({ id: 'sm-1' });
      mockPrisma.shippingRule.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.shippingMethod.delete.mockResolvedValue({ id: 'sm-1' });

      await service.deleteMethod('sm-1');
      expect(mockPrisma.shippingRule.deleteMany).toHaveBeenCalledWith({
        where: { shippingMethodId: 'sm-1' },
      });
      expect(mockPrisma.shippingMethod.delete).toHaveBeenCalledWith({ where: { id: 'sm-1' } });
    });

    it('throws NotFoundException when method not found', async () => {
      mockPrisma.shippingMethod.findUnique.mockResolvedValue(null);
      await expect(service.deleteMethod('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRule', () => {
    it('deletes the rule', async () => {
      mockPrisma.shippingRule.findUnique.mockResolvedValue({ id: 'r-1' });
      mockPrisma.shippingRule.delete.mockResolvedValue({ id: 'r-1' });

      await service.deleteRule('r-1');
      expect(mockPrisma.shippingRule.delete).toHaveBeenCalledWith({ where: { id: 'r-1' } });
    });

    it('throws NotFoundException when rule not found', async () => {
      mockPrisma.shippingRule.findUnique.mockResolvedValue(null);
      await expect(service.deleteRule('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllShippingMethodsAdmin', () => {
    it('returns all platform methods including inactive', async () => {
      mockPrisma.shippingMethod.findMany.mockResolvedValue([
        {
          id: 'sm-1',
          name: 'Inactive',
          isActive: false,
          type: 'FLAT_RATE',
          rules: [
            {
              id: 'r-1',
              name: 'Rule',
              rate: new Decimal(5),
              minimumCharge: null,
              freeShippingThreshold: null,
              conditions: {},
              priority: 1,
            },
          ],
        },
      ]);

      const result = await service.findAllShippingMethodsAdmin();
      expect(result).toHaveLength(1);
      expect(result[0].rules[0].rate).toBe(5);
      expect(mockPrisma.shippingMethod.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: null },
        }),
      );
    });
  });

  describe('Shipping Carriers', () => {
    describe('findActiveShippingCarriers', () => {
      it('returns only active carriers', async () => {
        mockPrisma.shippingCarrier.findMany.mockResolvedValue([
          { id: 'c-1', name: 'UPS', code: 'ups', isActive: true },
        ]);

        const result = await service.findActiveShippingCarriers();
        expect(result).toHaveLength(1);
        expect(mockPrisma.shippingCarrier.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { isActive: true },
          }),
        );
      });
    });

    describe('findAllShippingCarriersAdmin', () => {
      it('returns all carriers', async () => {
        mockPrisma.shippingCarrier.findMany.mockResolvedValue([
          { id: 'c-1', name: 'UPS', isActive: true },
          { id: 'c-2', name: 'Inactive', isActive: false },
        ]);

        const result = await service.findAllShippingCarriersAdmin();
        expect(result).toHaveLength(2);
      });
    });

    describe('createShippingCarrier', () => {
      it('creates a carrier successfully', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue(null);
        mockPrisma.shippingCarrier.create.mockResolvedValue({
          id: 'c-1',
          name: 'FedEx',
          code: 'fedex',
          isActive: true,
        });

        const result = await service.createShippingCarrier({
          name: 'FedEx',
          code: 'fedex',
        } as any);
        expect(result.name).toBe('FedEx');
      });

      it('throws BadRequestException for empty name', async () => {
        await expect(service.createShippingCarrier({ name: '   ' } as any)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws BadRequestException for duplicate name', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue({ id: 'c-existing' });

        await expect(service.createShippingCarrier({ name: 'UPS' } as any)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws BadRequestException for duplicate code', async () => {
        mockPrisma.shippingCarrier.findUnique
          .mockResolvedValueOnce(null) // name check
          .mockResolvedValueOnce({ id: 'c-existing' }); // code check

        await expect(
          service.createShippingCarrier({ name: 'New', code: 'ups' } as any),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateShippingCarrier', () => {
      it('updates carrier fields', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue({ id: 'c-1', name: 'Old' });
        mockPrisma.shippingCarrier.findFirst.mockResolvedValue(null);
        mockPrisma.shippingCarrier.update.mockResolvedValue({ id: 'c-1', name: 'New' });

        const result = await service.updateShippingCarrier('c-1', { name: 'New' } as any);
        expect(result.name).toBe('New');
      });

      it('throws NotFoundException when carrier not found', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue(null);
        await expect(service.updateShippingCarrier('missing', {} as any)).rejects.toThrow(
          NotFoundException,
        );
      });

      it('throws BadRequestException for empty name', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue({ id: 'c-1' });
        await expect(service.updateShippingCarrier('c-1', { name: '  ' } as any)).rejects.toThrow(
          BadRequestException,
        );
      });

      it('throws BadRequestException for duplicate name', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue({ id: 'c-1', name: 'Old' });
        mockPrisma.shippingCarrier.findFirst.mockResolvedValue({ id: 'c-other', name: 'Taken' });

        await expect(
          service.updateShippingCarrier('c-1', { name: 'Taken' } as any),
        ).rejects.toThrow(BadRequestException);
      });

      it('throws BadRequestException for duplicate code', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue({ id: 'c-1', code: 'old' });
        mockPrisma.shippingCarrier.findFirst.mockResolvedValue({ id: 'c-other', code: 'taken' });

        await expect(
          service.updateShippingCarrier('c-1', { code: 'taken' } as any),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('deleteShippingCarrier', () => {
      it('deletes the carrier', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue({ id: 'c-1' });
        mockPrisma.shippingCarrier.delete.mockResolvedValue({ id: 'c-1' });

        await service.deleteShippingCarrier('c-1');
        expect(mockPrisma.shippingCarrier.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } });
      });

      it('throws NotFoundException when carrier not found', async () => {
        mockPrisma.shippingCarrier.findUnique.mockResolvedValue(null);
        await expect(service.deleteShippingCarrier('missing')).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('ensurePlatformShippingDefaults', () => {
    it('returns 0 when platform methods already exist', async () => {
      mockPrisma.shippingMethod.count.mockResolvedValue(2);
      const count = await service.ensurePlatformShippingDefaults();
      expect(count).toBe(0);
    });

    it('creates default methods when none exist', async () => {
      mockPrisma.shippingMethod.count.mockResolvedValue(0);
      mockPrisma.shippingMethod.create
        .mockResolvedValueOnce({ id: 'std-1' })
        .mockResolvedValueOnce({ id: 'exp-1' });
      mockPrisma.shippingRule.create.mockResolvedValue({ id: 'rule-1' });

      const count = await service.ensurePlatformShippingDefaults();
      expect(count).toBe(2);
      expect(mockPrisma.shippingMethod.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.shippingRule.create).toHaveBeenCalledTimes(2);
    });
  });
});
