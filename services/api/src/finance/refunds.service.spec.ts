import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';

describe('RefundsService', () => {
  let service: RefundsService;
  let prismaService: PrismaService;
  let transactionsService: TransactionsService;

  const mockPrismaService = {
    returnRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
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
        RefundsService,
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

    service = module.get<RefundsService>(RefundsService);
    prismaService = module.get<PrismaService>(PrismaService);
    transactionsService = module.get<TransactionsService>(TransactionsService);

    jest.clearAllMocks();
  });

  describe('processRefund', () => {
    const refundData = {
      returnId: 'return-1',
      amount: 100,
      currency: 'GBP',
      description: 'Refund for return',
    };

    it('should process refund successfully', async () => {
      const mockReturnRequest = {
        id: 'return-1',
        userId: 'user-1',
        orderId: 'order-1',
        status: 'APPROVED',
        order: {
          id: 'order-1',
          currency: 'GBP',
        },
      };
      const mockTransaction = {
        id: 'transaction-1',
        type: 'REFUND',
        amount: 100,
        status: 'COMPLETED',
      };

      mockPrismaService.returnRequest.findUnique.mockResolvedValue(mockReturnRequest);
      mockTransactionsService.createTransaction.mockResolvedValue(mockTransaction);
      mockTransactionsService.updateTransactionStatus.mockResolvedValue(mockTransaction);
      mockPrismaService.returnRequest.update.mockResolvedValue({
        ...mockReturnRequest,
        refundAmount: 100,
        refundMethod: 'ORIGINAL_PAYMENT',
      });

      const result = await service.processRefund(refundData);

      expect(mockTransactionsService.createTransaction).toHaveBeenCalledWith({
        type: 'REFUND',
        amount: refundData.amount,
        currency: refundData.currency,
        customerId: mockReturnRequest.userId,
        orderId: mockReturnRequest.orderId,
        returnId: refundData.returnId,
        description: expect.any(String),
        status: 'PENDING',
        metadata: expect.any(Object),
      });
      expect(result).toEqual(mockTransaction);
    });

    it('should throw NotFoundException if return request not found', async () => {
      mockPrismaService.returnRequest.findUnique.mockResolvedValue(null);

      await expect(service.processRefund(refundData)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if return not approved', async () => {
      const mockReturnRequest = {
        id: 'return-1',
        status: 'PENDING',
        order: { currency: 'GBP' },
      };

      mockPrismaService.returnRequest.findUnique.mockResolvedValue(mockReturnRequest);

      await expect(service.processRefund(refundData)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRefunds', () => {
    it('should return refunds with filters', async () => {
      const mockRefunds = {
        transactions: [
          { id: 'tx-1', type: 'REFUND', amount: 100 },
        ],
        pagination: { total: 1 },
      };

      mockTransactionsService.getTransactions.mockResolvedValue(mockRefunds);

      const result = await service.getRefunds({
        customerId: 'user-1',
        status: 'COMPLETED',
      });

      expect(mockTransactionsService.getTransactions).toHaveBeenCalledWith({
        customerId: 'user-1',
        status: 'COMPLETED',
        type: 'REFUND',
      });
      expect(result).toEqual(mockRefunds);
    });
  });

  describe('updateRefundStatus', () => {
    it('should update refund status', async () => {
      const transactionId = 'transaction-1';
      const status = 'COMPLETED';
      const mockTransaction = {
        id: transactionId,
        status,
      };

      mockTransactionsService.updateTransactionStatus.mockResolvedValue(mockTransaction);

      const result = await service.updateRefundStatus(transactionId, status);

      expect(mockTransactionsService.updateTransactionStatus).toHaveBeenCalledWith(
        transactionId,
        status,
      );
      expect(result).toEqual(mockTransaction);
    });
  });
});
