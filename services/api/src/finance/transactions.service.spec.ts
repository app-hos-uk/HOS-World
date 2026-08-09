import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../database/prisma.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prismaService: PrismaService;

  const mockPrismaService = {
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    seller: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    settlement: {
      findUnique: jest.fn(),
    },
    returnRequest: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createTransaction', () => {
    const transactionData = {
      type: 'PAYMENT' as const,
      amount: 100.5,
      currency: 'USD',
      sellerId: 'seller-1',
      description: 'Test transaction',
    };

    it('should create transaction successfully', async () => {
      const mockSeller = { id: 'seller-1' };
      const mockTransaction = {
        id: 'transaction-1',
        ...transactionData,
        status: 'PENDING',
        createdAt: new Date(),
      };

      mockPrismaService.seller.findUnique.mockResolvedValue(mockSeller);
      mockPrismaService.transaction.create.mockResolvedValue(mockTransaction);

      const result = await service.createTransaction(transactionData);

      expect(mockPrismaService.seller.findUnique).toHaveBeenCalledWith({
        where: { id: transactionData.sellerId },
      });
      expect(mockPrismaService.transaction.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('should throw NotFoundException if seller not found', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue(null);

      await expect(service.createTransaction(transactionData)).rejects.toThrow(NotFoundException);
    });

    it('should validate customer if provided', async () => {
      const dataWithCustomer = {
        ...transactionData,
        customerId: 'customer-1',
      };
      const mockSeller = { id: 'seller-1' };
      const mockCustomer = { id: 'customer-1' };
      const mockTransaction = {
        id: 'transaction-1',
        ...dataWithCustomer,
      };

      mockPrismaService.seller.findUnique.mockResolvedValue(mockSeller);
      mockPrismaService.user.findUnique.mockResolvedValue(mockCustomer);
      mockPrismaService.transaction.create.mockResolvedValue(mockTransaction);

      await service.createTransaction(dataWithCustomer);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: dataWithCustomer.customerId },
      });
    });
  });

  describe('getTransactions', () => {
    it('should return transactions with filters', async () => {
      const mockTransactions = [
        { id: 'transaction-1', type: 'PAYMENT', amount: 100 },
        { id: 'transaction-2', type: 'REFUND', amount: 50 },
      ];

      mockPrismaService.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrismaService.transaction.count.mockResolvedValue(2);

      const result = await service.getTransactions({
        sellerId: 'seller-1',
        type: 'PAYMENT',
      });

      expect(mockPrismaService.transaction.findMany).toHaveBeenCalled();
      expect(mockPrismaService.transaction.count).toHaveBeenCalled();
      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('balances');
      expect(result).toHaveProperty('pagination');
      expect(result.transactions).toEqual(mockTransactions);
    });
  });

  describe('exportTransactions', () => {
    const csvRow = {
      id: 'transaction-1',
      type: 'PAYMENT',
      status: 'COMPLETED',
      amount: 100.5,
      currency: 'GBP',
      seller: { storeName: 'Wands, Robes & More', slug: 'wands' },
      customer: { email: 'a@b.com', firstName: 'A', lastName: 'B' },
      order: { orderNumber: 'HOS-1' },
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
    };

    it('returns paginated JSON when format is omitted', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([csvRow]);
      mockPrismaService.transaction.count.mockResolvedValue(1);

      const result: any = await service.exportTransactions({});

      expect(result).toHaveProperty('transactions');
      expect(result.pagination.total).toBe(1);
      expect(result.csv).toBeUndefined();
    });

    it('builds a CSV payload with quoted cells for format=csv', async () => {
      mockPrismaService.transaction.count.mockResolvedValue(1);
      mockPrismaService.transaction.findMany.mockResolvedValue([csvRow]);

      const result: any = await service.exportTransactions({ format: 'CSV' });

      expect(result.format).toBe('csv');
      expect(result.count).toBe(1);
      expect(result.filename).toMatch(/^transactions-\d{4}-\d{2}-\d{2}\.csv$/);

      const [header, row] = result.csv.split('\n');
      expect(header).toBe(
        'id,type,status,amount,currency,seller,customerEmail,orderNumber,createdAt',
      );
      expect(row).toBe(
        'transaction-1,PAYMENT,COMPLETED,100.5,GBP,"Wands, Robes & More",a@b.com,HOS-1,2026-01-02T03:04:05.000Z',
      );
      expect(result.url).toContain('data:text/csv;charset=utf-8,');
    });

    it('neutralises spreadsheet formulas but leaves negative amounts intact', async () => {
      mockPrismaService.transaction.count.mockResolvedValue(1);
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          ...csvRow,
          type: 'REFUND',
          amount: -50.25,
          seller: { storeName: '=HYPERLINK("http://evil","click")', slug: 'x' },
          customer: { email: '@SUM(A1:A9)', firstName: 'A', lastName: 'B' },
        },
      ]);

      const result: any = await service.exportTransactions({ format: 'csv' });
      const row = result.csv.split('\n')[1];

      expect(row).toContain(`"'=HYPERLINK(""http://evil"",""click"")"`);
      expect(row).toContain(`'@SUM(A1:A9)`);
      expect(row).toContain(',-50.25,');
    });

    it('rejects a CSV export that exceeds the row cap instead of truncating', async () => {
      mockPrismaService.transaction.count.mockResolvedValue(5001);

      await expect(service.exportTransactions({ format: 'csv' })).rejects.toThrow(
        /Export matches 5001 transactions; maximum is 5000/,
      );
      expect(mockPrismaService.transaction.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getTransactionById', () => {
    it('should return transaction by id', async () => {
      const transactionId = 'transaction-1';
      const mockTransaction = {
        id: transactionId,
        type: 'PAYMENT',
        amount: 100,
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionById(transactionId);

      expect(mockPrismaService.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: transactionId },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.getTransactionById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
