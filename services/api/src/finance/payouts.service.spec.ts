import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let prismaService: PrismaService;
  let transactionsService: TransactionsService;

  const mockPrismaService = {
    seller: {
      findUnique: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
    },
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
    updateTransactionStatus: jest.fn(),
    getTransactions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TransactionsService,
          useValue: mockTransactionsService,
        },
      ],
    }).compile();

    service = module.get<PayoutsService>(PayoutsService);
    prismaService = module.get<PrismaService>(PrismaService);
    transactionsService = module.get<TransactionsService>(TransactionsService);

    jest.clearAllMocks();
  });

  describe('schedulePayout', () => {
    const payoutData = {
      sellerId: 'seller-1',
      amount: 1000,
      currency: 'GBP',
      description: 'Monthly payout',
    };

    it('should schedule payout successfully', async () => {
      const mockSeller = {
        id: 'seller-1',
        storeName: 'Test Store',
      };
      const mockTransaction = {
        id: 'transaction-1',
        type: 'PAYOUT',
        amount: 1000,
        status: 'PENDING',
      };

      mockPrismaService.seller.findUnique.mockResolvedValue(mockSeller);
      mockTransactionsService.createTransaction.mockResolvedValue(mockTransaction);

      const result = await service.schedulePayout(payoutData);

      expect(mockPrismaService.seller.findUnique).toHaveBeenCalledWith({
        where: { id: payoutData.sellerId },
      });
      expect(mockTransactionsService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PAYOUT',
          amount: payoutData.amount,
          currency: payoutData.currency,
          sellerId: payoutData.sellerId,
          status: 'PENDING',
        }),
      );
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if seller not found', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue(null);

      await expect(service.schedulePayout(payoutData)).rejects.toThrow(NotFoundException);
    });
  });

  describe('processPayout', () => {
    it('should process payout successfully', async () => {
      const transactionId = 'transaction-1';
      const mockTransaction = {
        id: transactionId,
        type: 'PAYOUT',
        status: 'PENDING',
      };
      const updatedTransaction = {
        ...mockTransaction,
        status: 'COMPLETED',
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);
      mockTransactionsService.updateTransactionStatus.mockResolvedValue(updatedTransaction);

      const result = await service.processPayout(transactionId);

      expect(mockTransactionsService.updateTransactionStatus).toHaveBeenCalledWith(
        transactionId,
        'COMPLETED',
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockPrismaService.transaction.findUnique.mockResolvedValue(null);

      await expect(service.processPayout('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transaction is not a payout', async () => {
      const mockTransaction = {
        id: 'transaction-1',
        type: 'PAYMENT',
        status: 'PENDING',
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

      await expect(service.processPayout('transaction-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if payout already processed', async () => {
      const mockTransaction = {
        id: 'transaction-1',
        type: 'PAYOUT',
        status: 'COMPLETED',
      };

      mockPrismaService.transaction.findUnique.mockResolvedValue(mockTransaction);

      await expect(service.processPayout('transaction-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPayouts', () => {
    it('should return payouts with filters', async () => {
      const mockPayouts = {
        transactions: [
          { id: 'tx-1', type: 'PAYOUT', amount: 1000 },
          { id: 'tx-2', type: 'PAYOUT', amount: 500 },
        ],
        pagination: { page: 1, limit: 10, total: 2 },
      };

      mockTransactionsService.getTransactions.mockResolvedValue(mockPayouts);

      const result = await service.getPayouts({
        sellerId: 'seller-1',
        status: 'PENDING',
      });

      expect(mockTransactionsService.getTransactions).toHaveBeenCalledWith({
        sellerId: 'seller-1',
        status: 'PENDING',
        type: 'PAYOUT',
      });
      expect(result).toEqual(mockPayouts);
    });
  });

  describe('getSellerPayoutHistory', () => {
    it('should return seller payout history', async () => {
      const sellerId = 'seller-1';
      const mockPayouts = {
        transactions: [{ id: 'tx-1', type: 'PAYOUT' }],
        pagination: { total: 1 },
      };

      mockTransactionsService.getTransactions.mockResolvedValue(mockPayouts);

      const result = await service.getSellerPayoutHistory(sellerId);

      expect(mockTransactionsService.getTransactions).toHaveBeenCalledWith({
        sellerId,
        type: 'PAYOUT',
      });
      expect(result).toEqual(mockPayouts);
    });
  });
});
