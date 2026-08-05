import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../database/prisma.service';
import { CurrencyService } from '../currency/currency.service';
import { PaymentProviderService } from './payment-provider.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPrisma = {
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    giftCardTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCurrencyService = {
    convertBetween: jest.fn(),
  };

  const mockPaymentProviderService = {
    ensureAvailableProviders: jest.fn().mockResolvedValue(['stripe']),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_PUBLISHABLE_KEY') return 'pk_test_123';
      return undefined;
    }),
  };

  const baseOrder = {
    id: 'order-1',
    userId: 'user-1',
    total: new Decimal(100),
    currency: 'USD',
    paymentStatus: 'PENDING',
    status: 'PENDING',
    seller: { id: 'seller-1', userId: 'seller-user', stripeConnectAccountId: null },
    items: [],
    shippingAddress: null,
    billingAddress: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CurrencyService, useValue: mockCurrencyService },
        { provide: PaymentProviderService, useValue: mockPaymentProviderService },
      ],
    }).compile();

    service = module.get(PaymentsService);
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('throws NotFoundException when order does not exist', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      await expect(
        service.createPaymentIntent('user-1', { orderId: 'missing' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when order is already paid', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        paymentStatus: 'PAID',
      });

      await expect(
        service.createPaymentIntent('user-1', { orderId: 'order-1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks order paid when gift cards fully cover total', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(baseOrder);
      mockPrisma.giftCardTransaction.findMany.mockResolvedValue([
        { amount: new Decimal(100) },
      ]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          order: {
            findUnique: jest.fn().mockResolvedValue({ paymentStatus: 'PENDING' }),
            update: jest.fn(),
            updateMany: jest.fn(),
          },
          payment: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
        }),
      );

      const result = await service.createPaymentIntent('user-1', { orderId: 'order-1' } as any);

      expect(result).toMatchObject({
        paid: true,
        method: 'gift_card_full_coverage',
        orderId: 'order-1',
      });
    });
  });

  describe('getAvailableProviders', () => {
    it('delegates to payment provider service', async () => {
      const providers = await service.getAvailableProviders();
      expect(providers).toEqual(['stripe']);
      expect(mockPaymentProviderService.ensureAvailableProviders).toHaveBeenCalled();
    });
  });

  describe('getStripePublishableKey', () => {
    it('returns env publishable key when configured', async () => {
      await expect(service.getStripePublishableKey()).resolves.toBe('pk_test_123');
    });

    it('returns null when env key is absent and integrations unavailable', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await expect(service.getStripePublishableKey()).resolves.toBeNull();
    });
  });

  describe('confirmPayment', () => {
    it('throws NotFoundException when order does not exist', async () => {
      mockPrisma.order.findUnique = jest.fn().mockResolvedValue(null);

      await expect(
        service.confirmPayment('pi_123', 'missing-order'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when userId does not match', async () => {
      mockPrisma.order.findUnique = jest.fn().mockResolvedValue({
        ...baseOrder,
        userId: 'other-user',
      });

      await expect(
        service.confirmPayment('pi_123', 'order-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when payment intent does not match order', async () => {
      mockPrisma.order.findUnique = jest.fn().mockResolvedValue({
        ...baseOrder,
        stripePaymentIntentId: 'pi_different',
      });

      await expect(
        service.confirmPayment('pi_123', 'order-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns early when order is already paid', async () => {
      mockPrisma.order.findUnique = jest.fn().mockResolvedValue({
        ...baseOrder,
        paymentStatus: 'PAID',
      });

      await expect(
        service.confirmPayment('pi_123', 'order-1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('createPaymentIntent – edge cases', () => {
    it('resolves as gift-card-covered for zero-total orders', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        total: new Decimal(0),
      });
      mockPrisma.giftCardTransaction.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          order: {
            findUnique: jest.fn().mockResolvedValue({ paymentStatus: 'PENDING' }),
            update: jest.fn(),
            updateMany: jest.fn(),
          },
          payment: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
        }),
      );

      const result = await service.createPaymentIntent('user-1', { orderId: 'order-1' } as any);
      expect(result.paid).toBe(true);
      expect(result.method).toBe('gift_card_full_coverage');
    });
  });
});
