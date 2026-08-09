import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';
import { PaymentProviderService } from '../payments/payment-provider.service';
import { LoyaltyReversalService } from '../loyalty/services/loyalty-reversal.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';
import { RETURN_FULFILMENT } from '../returns/return-fulfilment.token';

describe('RefundsService', () => {
  let service: RefundsService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let prismaService: PrismaService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let transactionsService: TransactionsService;

  const mockPrismaService = {
    returnRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    giftCardTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    giftCard: {
      findUnique: jest.fn().mockResolvedValue({ id: 'gc-1', balance: 0 }),
      update: jest.fn(),
    },
    transaction: {
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    seller: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    payment: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(mockPrismaService)),
  };

  const mockTransactionsService = {
    createTransaction: jest.fn(),
    updateTransactionStatus: jest.fn(),
    getTransactions: jest.fn(),
    getTransactionById: jest.fn(),
  };

  const mockPaymentProviderService = {
    ensureAvailableProviders: jest.fn().mockResolvedValue(['stripe']),
    isProviderAvailable: jest.fn().mockReturnValue(true),
    getProvider: jest.fn().mockReturnValue({
      refundPayment: jest.fn().mockResolvedValue({
        success: true,
        refundId: 're_test',
        amount: 100,
        status: 'succeeded',
      }),
    }),
  };

  const mockLoyaltyReversalService = {
    onReturnRefunded: jest.fn().mockResolvedValue(undefined),
    onOrderCancelled: jest.fn().mockResolvedValue(undefined),
  };

  const mockVendorLedgerService = {
    recordRefund: jest.fn().mockResolvedValue(undefined),
  };

  const mockReturnsService = {
    finalizeSettledReturn: jest.fn().mockResolvedValue(undefined),
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
        {
          provide: PaymentProviderService,
          useValue: mockPaymentProviderService,
        },
        {
          provide: LoyaltyReversalService,
          useValue: mockLoyaltyReversalService,
        },
        {
          provide: VendorLedgerService,
          useValue: mockVendorLedgerService,
        },
        {
          provide: RETURN_FULFILMENT,
          useValue: mockReturnsService,
        },
      ],
    }).compile();

    service = module.get<RefundsService>(RefundsService);
    prismaService = module.get<PrismaService>(PrismaService);
    transactionsService = module.get<TransactionsService>(TransactionsService);

    jest.clearAllMocks();

    mockPrismaService.giftCardTransaction.findMany.mockResolvedValue([]);
    mockPrismaService.giftCardTransaction.count.mockResolvedValue(0);
    mockPrismaService.giftCardTransaction.groupBy.mockResolvedValue([]);
    mockPrismaService.giftCard.findUnique.mockResolvedValue({ id: 'gc-1', balance: 0 });
    mockPrismaService.transaction.findMany.mockResolvedValue([]);
    mockPrismaService.seller.findUnique.mockResolvedValue(null);
    mockPrismaService.payment.findFirst.mockResolvedValue(null);
    mockPrismaService.$transaction.mockImplementation(async (fn: any) => fn(mockPrismaService));
    mockPaymentProviderService.ensureAvailableProviders.mockResolvedValue(['stripe']);
    mockPaymentProviderService.isProviderAvailable.mockReturnValue(true);
  });

  describe('processRefund', () => {
    const refundData = {
      returnId: 'return-1',
      amount: 100,
      currency: 'USD',
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
          currency: 'USD',
          total: 100,
          sellerId: null,
          childOrders: [],
          stripePaymentIntentId: 'pi_test',
        },
      };
      const mockTransaction = {
        id: 'transaction-1',
        type: 'REFUND',
        amount: 100,
        status: 'COMPLETED',
      };

      mockPrismaService.returnRequest.findUnique.mockResolvedValue(mockReturnRequest);
      mockTransactionsService.getTransactions.mockResolvedValue({ transactions: [] });
      mockTransactionsService.createTransaction.mockResolvedValue(mockTransaction);
      mockTransactionsService.updateTransactionStatus.mockResolvedValue(mockTransaction);
      mockTransactionsService.getTransactionById.mockResolvedValue(mockTransaction);
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
      expect(result).toEqual({
        transaction: mockTransaction,
        stripeRefundSucceeded: true,
        cardRefundAmount: 100,
        giftCardRefundAmount: 0,
        error: undefined,
      });
    });

    describe('gift-card portion', () => {
      const mixedReturnRequest = {
        id: 'return-1',
        userId: 'user-1',
        orderId: 'order-1',
        status: 'APPROVED',
        order: {
          id: 'order-1',
          currency: 'USD',
          total: 100,
          subtotal: 100,
          sellerId: null,
          childOrders: [],
          stripePaymentIntentId: 'pi_test',
        },
      };

      // £40 of the £100 order was paid with a gift card, so a full refund splits
      // £60 to the card and £40 back to the gift card.
      const arrangeMixedOrder = (refundsOnTheCard: Array<{ amount: number }>) => {
        mockPrismaService.returnRequest.findUnique.mockResolvedValue(mixedReturnRequest);
        mockTransactionsService.getTransactions.mockResolvedValue({ transactions: [] });
        mockTransactionsService.createTransaction.mockResolvedValue({ id: 'transaction-1' });
        mockTransactionsService.getTransactionById.mockResolvedValue({ id: 'transaction-1' });
        mockPrismaService.giftCardTransaction.findMany.mockImplementation(({ where }: any) =>
          Promise.resolve(
            where?.type === 'REDEMPTION' ? [{ amount: 40, giftCardId: 'gc-1' }] : refundsOnTheCard,
          ),
        );
      };

      it('restores the gift card and counts both portions as settled', async () => {
        arrangeMixedOrder([{ amount: 40 }]);

        await service.processRefund(refundData);

        expect(mockPrismaService.giftCardTransaction.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ giftCardId: 'gc-1', type: 'REFUND', amount: 40 }),
          }),
        );
        expect(mockLoyaltyReversalService.onReturnRefunded).toHaveBeenCalledWith(
          expect.objectContaining({ refundAmount: 100 }),
        );
      });

      it('does not credit a redemption an admin already refunded by hand', async () => {
        // The £40 is already back on the card, put there by an admin.
        arrangeMixedOrder([{ amount: 40 }]);
        mockPrismaService.giftCardTransaction.groupBy.mockResolvedValue([
          { giftCardId: 'gc-1', _sum: { amount: 40 } },
        ]);

        await service.processRefund(refundData);

        expect(mockPrismaService.giftCardTransaction.create).not.toHaveBeenCalled();
        expect(mockPrismaService.giftCard.update).not.toHaveBeenCalled();
        // The customer still got the full £100 back, so loyalty reverses on all of it.
        expect(mockLoyaltyReversalService.onReturnRefunded).toHaveBeenCalledWith(
          expect.objectContaining({ refundAmount: 100 }),
        );
      });

      it('counts only the card portion when nothing came back to the gift card', async () => {
        arrangeMixedOrder([]);
        mockPaymentProviderService.getProvider.mockReturnValueOnce({
          refundPayment: jest.fn().mockResolvedValue({ success: true, refundId: 're_x' }),
        });
        // Redemptions exist but the reversal wrote nothing, so £40 is still unpaid.
        mockPrismaService.giftCardTransaction.count.mockResolvedValue(1);

        await service.processRefund(refundData);

        expect(mockLoyaltyReversalService.onReturnRefunded).toHaveBeenCalledWith(
          expect.objectContaining({ refundAmount: 60 }),
        );
      });
    });

    it('should throw NotFoundException if return request not found', async () => {
      mockPrismaService.returnRequest.findUnique.mockResolvedValue(null);

      await expect(service.processRefund(refundData)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if return is in a non-refundable status', async () => {
      const mockReturnRequest = {
        id: 'return-1',
        status: 'REJECTED',
        order: { currency: 'USD', total: 100 },
      };

      mockPrismaService.returnRequest.findUnique.mockResolvedValue(mockReturnRequest);

      await expect(service.processRefund(refundData)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if refund exceeds order total', async () => {
      const mockReturnRequest = {
        id: 'return-1',
        status: 'APPROVED',
        orderId: 'order-1',
        order: { currency: 'USD', total: 50 },
      };

      mockPrismaService.returnRequest.findUnique.mockResolvedValue(mockReturnRequest);

      await expect(service.processRefund(refundData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('syncReturnRefundFromWebhook', () => {
    const webhookParams = {
      stripeRefundId: 're_async',
      paymentIntentId: 'pi_test',
      amount: 80,
      status: 'succeeded' as const,
    };

    const order = {
      id: 'order-1',
      userId: 'user-1',
      sellerId: 'seller-1',
      currency: 'USD',
      subtotal: 100,
      total: 100,
      childOrders: [],
    };

    beforeEach(() => {
      mockPrismaService.order.findFirst.mockResolvedValue(order);
      mockPrismaService.order.update.mockResolvedValue(order);
      mockPrismaService.returnRequest.update.mockResolvedValue({});
      mockPrismaService.returnRequest.updateMany.mockResolvedValue({ count: 1 });
      mockTransactionsService.createTransaction.mockResolvedValue({ id: 'tx-new' });
      mockTransactionsService.updateTransactionStatus.mockResolvedValue({});
    });

    it('completes the return and records the vendor refund when a pending card refund settles', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          returnId: 'return-1',
          status: 'PENDING',
          metadata: { stripeRefundId: 're_async' },
        },
      ]);
      mockPrismaService.giftCardTransaction.findMany.mockResolvedValue([{ amount: 20 }]);
      mockPrismaService.returnRequest.findUnique.mockResolvedValue({
        id: 'return-1',
        status: 'APPROVED',
        refundAmount: null,
        refundMethod: null,
        order,
      });

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockPrismaService.returnRequest.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'return-1', status: { in: ['APPROVED', 'PROCESSING'] } },
          data: expect.objectContaining({
            status: 'COMPLETED',
            refundAmount: 100,
            refundMethod: 'ORIGINAL_PAYMENT',
          }),
        }),
      );
      expect(mockVendorLedgerService.recordRefund).toHaveBeenCalled();
      // Restock plus the partial/full order status rules belong to ReturnsService.
      expect(mockReturnsService.finalizeSettledReturn).toHaveBeenCalledWith('return-1');
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
      // Loyalty follows the settled value: card 80 + gift card 20.
      expect(mockLoyaltyReversalService.onReturnRefunded).toHaveBeenCalledWith({
        returnId: 'return-1',
        orderId: 'order-1',
        refundAmount: 100,
      });
    });

    it('does not re-complete a return the inline refund already finalised', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          returnId: 'return-1',
          status: 'COMPLETED',
          metadata: { stripeRefundId: 're_async' },
        },
      ]);

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockPrismaService.returnRequest.updateMany).not.toHaveBeenCalled();
      expect(mockVendorLedgerService.recordRefund).not.toHaveBeenCalled();
      expect(mockReturnsService.finalizeSettledReturn).not.toHaveBeenCalled();
    });

    it('records the whole settled value on the payment, not just the card portion', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          returnId: 'return-1',
          status: 'PENDING',
          metadata: { stripeRefundId: 're_async' },
        },
      ]);
      mockPrismaService.giftCardTransaction.findMany.mockResolvedValue([{ amount: 20 }]);
      mockPrismaService.returnRequest.findUnique.mockResolvedValue({
        id: 'return-1',
        status: 'APPROVED',
        refundAmount: null,
        refundMethod: null,
        order,
      });
      mockPrismaService.payment.findFirst.mockResolvedValue({ id: 'pay-1', refundAmount: 0 });

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockPrismaService.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: { refundAmount: 100 },
      });
    });

    it('restocks only once when Stripe redelivers the same refund event', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          returnId: 'return-1',
          status: 'PENDING',
          metadata: { stripeRefundId: 're_async' },
        },
      ]);
      mockPrismaService.returnRequest.findUnique.mockResolvedValue({
        id: 'return-1',
        status: 'APPROVED',
        refundAmount: null,
        refundMethod: null,
        order,
      });
      // Second delivery loses the race for the claim.
      mockPrismaService.returnRequest.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await service.syncReturnRefundFromWebhook(webhookParams);
      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockReturnsService.finalizeSettledReturn).toHaveBeenCalledTimes(1);
      expect(mockVendorLedgerService.recordRefund).toHaveBeenCalledTimes(1);
    });

    it('still marks the order refunded when restock fails', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          returnId: 'return-1',
          status: 'PENDING',
          metadata: { stripeRefundId: 're_async' },
        },
      ]);
      mockPrismaService.returnRequest.findUnique.mockResolvedValue({
        id: 'return-1',
        status: 'APPROVED',
        refundAmount: null,
        refundMethod: null,
        order,
      });
      mockReturnsService.finalizeSettledReturn.mockRejectedValueOnce(
        new Error('stock update failed'),
      );

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { paymentStatus: 'REFUNDED' },
      });
    });

    it('does not attribute a cancellation refund to a settled return on the same order', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          returnId: 'return-1',
          status: 'COMPLETED',
          metadata: { stripeRefundId: 're_earlier_return' },
        },
      ]);

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockLoyaltyReversalService.onReturnRefunded).not.toHaveBeenCalled();
      expect(mockReturnsService.finalizeSettledReturn).not.toHaveBeenCalled();
      // Still recorded as a refund on the order.
      expect(mockTransactionsService.createTransaction).toHaveBeenCalled();
    });

    it('refuses to guess when several return refunds are still unsettled', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        { id: 'tx-1', returnId: 'return-1', status: 'PENDING', metadata: {} },
        { id: 'tx-2', returnId: 'return-2', status: 'FAILED', metadata: {} },
      ]);

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockReturnsService.finalizeSettledReturn).not.toHaveBeenCalled();
      expect(mockLoyaltyReversalService.onReturnRefunded).not.toHaveBeenCalled();
    });

    it('adopts the single unsettled return when the refund id was never recorded', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        { id: 'tx-1', returnId: 'return-1', status: 'PENDING', metadata: { retryAttempt: 0 } },
      ]);
      mockPrismaService.returnRequest.findUnique.mockResolvedValue({
        id: 'return-1',
        status: 'APPROVED',
        refundAmount: null,
        refundMethod: null,
        order,
      });

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockReturnsService.finalizeSettledReturn).toHaveBeenCalledWith('return-1');
      // Settles the existing attempt and stamps the refund id on it, rather than
      // adding a second refund row and leaving the first stuck as pending.
      expect(mockTransactionsService.updateTransactionStatus).toHaveBeenCalledWith(
        'tx-1',
        'COMPLETED',
        expect.any(Object),
      );
      expect(mockPrismaService.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: {
          metadata: expect.objectContaining({
            retryAttempt: 0,
            stripeRefundId: 're_async',
            paymentIntentId: 'pi_test',
          }),
        },
      });
      expect(mockTransactionsService.createTransaction).not.toHaveBeenCalled();
    });

    it('leaves a rejected return untouched', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([
        {
          id: 'tx-1',
          returnId: 'return-1',
          status: 'FAILED',
          metadata: { stripeRefundId: 're_async' },
        },
      ]);
      mockPrismaService.returnRequest.findUnique.mockResolvedValue({
        id: 'return-1',
        status: 'REJECTED',
        order,
      });

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockPrismaService.returnRequest.updateMany).not.toHaveBeenCalled();
      expect(mockPrismaService.order.update).not.toHaveBeenCalled();
    });

    it('ignores refunds that are not tied to a return (e.g. order cancellation)', async () => {
      mockPrismaService.transaction.findMany.mockResolvedValue([]);

      await service.syncReturnRefundFromWebhook(webhookParams);

      expect(mockLoyaltyReversalService.onReturnRefunded).not.toHaveBeenCalled();
      expect(mockPrismaService.returnRequest.updateMany).not.toHaveBeenCalled();
      expect(mockTransactionsService.createTransaction).toHaveBeenCalled();
    });
  });

  describe('getRefunds', () => {
    it('should return refunds with filters', async () => {
      const mockRefunds = {
        transactions: [{ id: 'tx-1', type: 'REFUND', amount: 100 }],
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
        undefined,
      );
      expect(result).toEqual(mockTransaction);
    });
  });
});
