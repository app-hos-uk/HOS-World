import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../database/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    transaction: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getRevenueReport', () => {
    it('should return revenue report', async () => {
      const mockTransactions = [
        { id: 'tx-1', amount: 100, createdAt: new Date() },
        { id: 'tx-2', amount: 200, createdAt: new Date() },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getRevenueReport();

      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalTransactions');
      expect(result).toHaveProperty('averageTransactionValue');
      expect(result.totalRevenue).toBe(300);
      expect(result.totalTransactions).toBe(2);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      await service.getRevenueReport({ startDate, endDate });

      const callArgs = mockPrismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.where.createdAt.gte).toEqual(startDate);
      expect(callArgs.where.createdAt.lte).toEqual(endDate);
    });

    it('should filter by seller', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      await service.getRevenueReport({ sellerId: 'seller-1' });

      const callArgs = mockPrismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.where.sellerId).toBe('seller-1');
    });

    it('should group by period when specified', async () => {
      const mockTransactions = [
        { id: 'tx-1', amount: 100, createdAt: new Date('2024-01-15') },
        { id: 'tx-2', amount: 200, createdAt: new Date('2024-01-20') },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getRevenueReport({ period: 'monthly' });

      expect(result).toHaveProperty('groupedData');
    });
  });

  describe('getSellerPerformance', () => {
    it('should return seller performance metrics', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          amount: 100,
          sellerId: 'seller-1',
          orderId: 'order-1',
          seller: { id: 'seller-1', storeName: 'Store 1' },
          order: { id: 'order-1' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getSellerPerformance();

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('seller');
        expect(result[0]).toHaveProperty('revenue');
        expect(result[0]).toHaveProperty('transactions');
      }
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      await service.getSellerPerformance({ startDate, endDate });

      const callArgs = mockPrismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.where.createdAt.gte).toEqual(startDate);
    });
  });

  describe('getCustomerSpending', () => {
    it('should return customer spending metrics', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          amount: 100,
          customerId: 'customer-1',
          orderId: 'order-1',
          customer: { id: 'customer-1', email: 'customer@example.com' },
          order: { id: 'order-1' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getCustomerSpending();

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('customer');
        expect(result[0]).toHaveProperty('totalSpent');
        expect(result[0]).toHaveProperty('lifetimeValue');
      }
    });

    it('should filter by customer', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      await service.getCustomerSpending({ customerId: 'customer-1' });

      const callArgs = mockPrismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.where.customerId).toBe('customer-1');
    });
  });

  describe('getPlatformFees', () => {
    it('should return platform fees report', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          amount: 10,
          sellerId: 'seller-1',
          seller: { id: 'seller-1', storeName: 'Store 1' },
        },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.getPlatformFees();

      expect(result).toHaveProperty('totalFees');
      expect(result).toHaveProperty('totalTransactions');
      expect(result).toHaveProperty('bySeller');
      expect(result.totalFees).toBe(10);
    });

    it('should filter by seller', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      await service.getPlatformFees({ sellerId: 'seller-1' });

      const callArgs = mockPrismaService.transaction.findMany.mock.calls[0][0];
      expect(callArgs.where.sellerId).toBe('seller-1');
    });
  });
});
