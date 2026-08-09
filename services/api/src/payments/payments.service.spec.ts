import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../database/prisma.service';
import { CurrencyService } from '../currency/currency.service';
import { PaymentProviderService } from './payment-provider.service';
import { StripeConnectService } from './stripe-connect/stripe-connect.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../cache/redis.service';
import { RefundsService } from '../finance/refunds.service';
import { IntegrationsService } from '../integrations/integrations.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockPrisma = {
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    giftCardTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    seller: {
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    influencerCommission: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    influencer: {
      update: jest.fn(),
    },
    influencerCampaign: {
      update: jest.fn(),
    },
    marketingJourney: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    journeyEnrollment: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    loyaltyTransaction: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };

  const mockCurrencyService = {
    convertBetween: jest.fn().mockResolvedValue(100),
  };

  const mockProvider = {
    createPaymentIntent: jest.fn(),
    confirmPayment: jest.fn(),
    cancelPaymentIntent: jest.fn(),
    validateWebhook: jest.fn(),
    processWebhook: jest.fn(),
  };

  const mockPaymentProviderService = {
    ensureAvailableProviders: jest.fn().mockResolvedValue(['stripe']),
    isProviderAvailable: jest.fn().mockReturnValue(true),
    getProvider: jest.fn().mockReturnValue(mockProvider),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_PUBLISHABLE_KEY') return 'pk_test_123';
      return undefined;
    }),
  };

  const mockStripeConnect = {
    createSplitPaymentIntent: jest.fn(),
  };

  const mockVendorLedger = {
    recordSale: jest.fn(),
  };

  const mockNotifications = {
    sendOrderConfirmation: jest.fn(),
  };

  const mockRedisService = {
    isRedisConnected: jest.fn().mockReturnValue(true),
    setNX: jest.fn().mockResolvedValue(true),
  };

  const mockRefundsService = {
    syncReturnRefundFromWebhook: jest.fn(),
  };

  const mockIntegrationsService = {
    getDecryptedCredentials: jest.fn(),
  };

  const baseOrder = {
    id: 'order-1',
    userId: 'user-1',
    total: new Decimal(100),
    subtotal: new Decimal(90),
    currency: 'USD',
    paymentStatus: 'PENDING',
    status: 'PENDING',
    orderNumber: 'ORD-001',
    sellerId: 'seller-1',
    stripePaymentIntentId: null,
    platformFeeAmount: null,
    parentOrderId: null,
    seller: {
      id: 'seller-1',
      userId: 'seller-user',
      storeName: 'Shop',
      slug: 'shop',
      logo: null,
      country: 'US',
      city: 'LA',
      stripeConnectAccountId: null,
    },
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
        { provide: StripeConnectService, useValue: mockStripeConnect },
        { provide: VendorLedgerService, useValue: mockVendorLedger },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: RedisService, useValue: mockRedisService },
        { provide: RefundsService, useValue: mockRefundsService },
        { provide: IntegrationsService, useValue: mockIntegrationsService },
      ],
    }).compile();

    service = module.get(PaymentsService);
    jest.clearAllMocks();
    mockPrisma.giftCardTransaction.findMany.mockResolvedValue([]);
    mockPrisma.influencerCommission.findMany.mockResolvedValue([]);
    mockPrisma.marketingJourney.findUnique.mockResolvedValue(null);
    mockRedisService.isRedisConnected.mockReturnValue(true);
    mockRedisService.setNX.mockResolvedValue(true);
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
      mockPrisma.giftCardTransaction.findMany.mockResolvedValue([{ amount: new Decimal(100) }]);
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

    it('creates payment intent via provider when amount > 0', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(baseOrder);
      mockProvider.createPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_123',
        clientSecret: 'cs_secret',
      });
      mockPrisma.order.update.mockResolvedValue(baseOrder);

      const result = await service.createPaymentIntent('user-1', { orderId: 'order-1' } as any);
      expect(result.clientSecret).toBe('cs_secret');
      expect(result.paymentIntentId).toBe('pi_123');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1' },
          data: { stripePaymentIntentId: 'pi_123' },
        }),
      );
    });

    it('uses Stripe Connect split when vendor has connected account', async () => {
      const orderWithConnect = {
        ...baseOrder,
        platformFeeAmount: new Decimal(10),
        seller: { ...baseOrder.seller, stripeConnectAccountId: 'acct_vendor' },
      };
      mockPrisma.order.findFirst.mockResolvedValue(orderWithConnect);
      mockStripeConnect.createSplitPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_split',
        clientSecret: 'cs_split',
      });
      mockPrisma.order.update.mockResolvedValue(orderWithConnect);

      const result = await service.createPaymentIntent('user-1', { orderId: 'order-1' } as any);
      expect(result.paymentIntentId).toBe('pi_split');
      expect(mockStripeConnect.createSplitPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorAccountId: 'acct_vendor',
          platformFee: 10,
        }),
      );
    });

    it('cancels prior payment intent before creating new one', async () => {
      const orderWithPrior = {
        ...baseOrder,
        stripePaymentIntentId: 'pi_old',
      };
      mockPrisma.order.findFirst.mockResolvedValue(orderWithPrior);
      mockProvider.cancelPaymentIntent.mockResolvedValue('canceled');
      mockProvider.createPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_new',
        clientSecret: 'cs_new',
      });
      mockPrisma.order.update.mockResolvedValue(orderWithPrior);

      const result = await service.createPaymentIntent('user-1', { orderId: 'order-1' } as any);
      expect(mockProvider.cancelPaymentIntent).toHaveBeenCalledWith('pi_old');
      expect(result.paymentIntentId).toBe('pi_new');
    });

    it('returns existing intent when prior intent already succeeded', async () => {
      const orderWithPrior = {
        ...baseOrder,
        stripePaymentIntentId: 'pi_old',
      };
      mockPrisma.order.findFirst.mockResolvedValue(orderWithPrior);
      mockProvider.cancelPaymentIntent.mockResolvedValue('already_succeeded');

      const result = await service.createPaymentIntent('user-1', { orderId: 'order-1' } as any);
      expect(result.success).toBe(true);
      expect(result.paymentIntentId).toBe('pi_old');
    });

    it('throws BadRequestException when no providers available', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(baseOrder);
      mockPaymentProviderService.ensureAvailableProviders.mockResolvedValue([]);

      await expect(
        service.createPaymentIntent('user-1', { orderId: 'order-1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when provider fails', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(baseOrder);
      mockProvider.createPaymentIntent.mockRejectedValue(new Error('Stripe error'));

      await expect(
        service.createPaymentIntent('user-1', { orderId: 'order-1' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('converts currency when not USD', async () => {
      mockPaymentProviderService.ensureAvailableProviders.mockResolvedValue(['stripe']);
      const eurOrder = { ...baseOrder, currency: 'EUR' };
      mockPrisma.order.findFirst.mockResolvedValue(eurOrder);
      mockCurrencyService.convertBetween.mockResolvedValue(110);
      mockProvider.createPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_eur',
        clientSecret: 'cs_eur',
      });
      mockPrisma.order.update.mockResolvedValue(eurOrder);

      await service.createPaymentIntent('user-1', { orderId: 'order-1' } as any);
      expect(mockCurrencyService.convertBetween).toHaveBeenCalledWith(100, 'EUR', 'USD');
    });

    it('uses fallback provider when requested method is unavailable', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(baseOrder);
      mockPaymentProviderService.isProviderAvailable.mockReturnValue(false);
      mockPaymentProviderService.ensureAvailableProviders.mockResolvedValue(['paypal']);
      mockProvider.createPaymentIntent.mockResolvedValue({
        paymentIntentId: 'pi_pp',
        clientSecret: 'cs_pp',
      });
      mockPrisma.order.update.mockResolvedValue(baseOrder);

      await service.createPaymentIntent('user-1', {
        orderId: 'order-1',
        paymentMethod: 'stripe',
      } as any);
      expect(mockPaymentProviderService.getProvider).toHaveBeenCalledWith('paypal');
    });
  });

  describe('confirmPayment', () => {
    it('throws NotFoundException when order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(service.confirmPayment('pi_123', 'missing-order')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when userId does not match', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        userId: 'other-user',
      });

      await expect(service.confirmPayment('pi_123', 'order-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when payment intent does not match order', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        stripePaymentIntentId: 'pi_different',
      });

      await expect(service.confirmPayment('pi_123', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns early when order is already paid', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        paymentStatus: 'PAID',
      });

      await expect(service.confirmPayment('pi_123', 'order-1')).resolves.toBeUndefined();
    });

    it('confirms payment successfully and marks order paid', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        stripePaymentIntentId: 'pi_123',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockProvider.confirmPayment.mockResolvedValue({
        success: true,
        paymentId: 'ch_123',
        amount: 100,
        status: 'succeeded',
        metadata: { orderId: 'order-1' },
      });
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
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.transaction.create.mockResolvedValue({});

      await expect(service.confirmPayment('pi_123', 'order-1')).resolves.toBeUndefined();
      expect(mockProvider.confirmPayment).toHaveBeenCalled();
    });

    it('throws BadRequestException when provider returns failure', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        stripePaymentIntentId: 'pi_123',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockProvider.confirmPayment.mockResolvedValue({
        success: false,
        status: 'requires_payment_method',
        error: 'Card declined',
      });

      await expect(service.confirmPayment('pi_123', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when metadata orderId does not match', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        stripePaymentIntentId: 'pi_123',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockProvider.confirmPayment.mockResolvedValue({
        success: true,
        paymentId: 'ch_123',
        amount: 100,
        metadata: { orderId: 'order-other' },
      });

      await expect(service.confirmPayment('pi_123', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when amount does not match', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        stripePaymentIntentId: 'pi_123',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockProvider.confirmPayment.mockResolvedValue({
        success: true,
        paymentId: 'ch_123',
        amount: 50, // Mismatched
        metadata: { orderId: 'order-1' },
      });

      await expect(service.confirmPayment('pi_123', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on provider error', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        stripePaymentIntentId: 'pi_123',
      });
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockProvider.confirmPayment.mockRejectedValue(new Error('Network error'));

      await expect(service.confirmPayment('pi_123', 'order-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleWebhook', () => {
    it('throws BadRequestException on invalid signature', async () => {
      mockProvider.validateWebhook.mockReturnValue(false);

      await expect(service.handleWebhook(Buffer.from('{}'), 'bad_sig', 'stripe')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ignores unhandled event types', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      const payload = JSON.stringify({ type: 'customer.created', id: 'evt_1' });

      await expect(service.handleWebhook(payload, 'sig', 'stripe')).resolves.toBeUndefined();
    });

    it('deduplicates webhook events via Redis', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockRedisService.setNX.mockResolvedValue(false); // Already processed
      const payload = JSON.stringify({ type: 'payment_intent.succeeded', id: 'evt_dup' });

      await service.handleWebhook(payload, 'sig', 'stripe');
      // Should return early without processing
      expect(mockProvider.processWebhook).not.toHaveBeenCalled();
    });

    it('processes payment_intent.succeeded webhook', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockProvider.processWebhook.mockResolvedValue({
        processed: true,
        orderId: 'order-1',
        paymentId: 'ch_123',
        metadata: { orderId: 'order-1' },
      });
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
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
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.transaction.create.mockResolvedValue({});

      const payload = JSON.stringify({
        type: 'payment_intent.succeeded',
        id: 'evt_1',
        data: { object: { amount_received: 10000 } },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockProvider.processWebhook).toHaveBeenCalled();
    });

    it('processes payment failure webhook', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockProvider.processWebhook.mockResolvedValue({
        processed: true,
        orderId: 'order-1',
        paymentId: 'pi_fail',
        metadata: { orderId: 'order-1' },
      });
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
      mockPrisma.order.update.mockResolvedValue({});
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({});

      const payload = JSON.stringify({
        type: 'payment_intent.payment_failed',
        id: 'evt_2',
        data: { object: {} },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paymentStatus: 'FAILED' },
        }),
      );
    });

    it('does not override PAID status on failure webhook', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockProvider.processWebhook.mockResolvedValue({
        processed: true,
        orderId: 'order-1',
        paymentId: 'pi_fail',
        metadata: { orderId: 'order-1' },
      });
      mockPrisma.order.findUnique.mockResolvedValue({
        ...baseOrder,
        paymentStatus: 'PAID',
      });

      const payload = JSON.stringify({
        type: 'payment_intent.payment_failed',
        id: 'evt_3',
        data: { object: {} },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('handles dispute created event', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockPrisma.order.findFirst.mockResolvedValue(baseOrder);
      mockPrisma.order.update.mockResolvedValue({});
      mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 });

      const payload = JSON.stringify({
        type: 'charge.dispute.created',
        id: 'evt_dispute',
        data: {
          object: {
            id: 'dp_1',
            charge: 'ch_1',
            payment_intent: 'pi_123',
            status: 'needs_response',
            amount: 10000,
            reason: 'fraudulent',
          },
        },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paymentStatus: 'DISPUTED' },
        }),
      );
    });

    it('handles dispute closed (lost) event', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockPrisma.order.findFirst.mockResolvedValue(baseOrder);
      mockPrisma.order.update.mockResolvedValue({});

      const payload = JSON.stringify({
        type: 'charge.dispute.closed',
        id: 'evt_dispute_closed',
        data: {
          object: {
            id: 'dp_2',
            charge: 'ch_1',
            payment_intent: 'pi_123',
            status: 'lost',
            amount: 10000,
            reason: 'fraudulent',
          },
        },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paymentStatus: 'REFUNDED' },
        }),
      );
    });

    it('handles dispute closed (won) event', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockPrisma.order.findFirst.mockResolvedValue(baseOrder);
      mockPrisma.order.update.mockResolvedValue({});

      const payload = JSON.stringify({
        type: 'charge.dispute.closed',
        id: 'evt_dispute_won',
        data: {
          object: {
            id: 'dp_3',
            charge: 'ch_1',
            payment_intent: 'pi_123',
            status: 'won',
            amount: 10000,
            reason: 'general',
          },
        },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paymentStatus: 'PAID' },
        }),
      );
    });

    it('handles refund webhook', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockRefundsService.syncReturnRefundFromWebhook.mockResolvedValue(undefined);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        status: 'DELIVERED',
        stripePaymentIntentId: 'pi_123',
      });
      mockPrisma.order.update.mockResolvedValue({});

      const payload = JSON.stringify({
        type: 'charge.refunded',
        id: 'evt_refund',
        data: {
          object: {
            id: 're_1',
            payment_intent: 'pi_123',
            amount_refunded: 5000,
            status: 'succeeded',
          },
        },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockRefundsService.syncReturnRefundFromWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentIntentId: 'pi_123',
          amount: 50,
          status: 'succeeded',
        }),
      );
    });

    it('skips refund order update when status is not DELIVERED', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockRefundsService.syncReturnRefundFromWebhook.mockResolvedValue(undefined);
      mockPrisma.order.findFirst.mockResolvedValue({
        ...baseOrder,
        status: 'CONFIRMED',
        stripePaymentIntentId: 'pi_123',
      });

      const payload = JSON.stringify({
        type: 'charge.refunded',
        id: 'evt_refund2',
        data: {
          object: {
            id: 're_2',
            payment_intent: 'pi_123',
            amount_refunded: 5000,
            status: 'succeeded',
          },
        },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('processes webhook even when Redis is down', async () => {
      mockRedisService.isRedisConnected.mockReturnValue(false);
      mockProvider.validateWebhook.mockReturnValue(true);
      mockProvider.processWebhook.mockResolvedValue({
        processed: true,
        orderId: 'order-1',
        paymentId: 'ch_123',
        metadata: { orderId: 'order-1' },
      });
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
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
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.transaction.create.mockResolvedValue({});

      const payload = JSON.stringify({
        type: 'payment_intent.succeeded',
        id: 'evt_no_redis',
        data: { object: { amount_received: 10000 } },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockProvider.processWebhook).toHaveBeenCalled();
    });

    it('logs error when order not found for webhook', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockProvider.processWebhook.mockResolvedValue({
        processed: true,
        orderId: 'missing-order',
        paymentId: 'ch_x',
      });
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const payload = JSON.stringify({
        type: 'payment_intent.succeeded',
        id: 'evt_missing',
        data: { object: { amount_received: 5000 } },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      // Should not throw, just log and return
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('handles webhook amount mismatch', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockProvider.processWebhook.mockResolvedValue({
        processed: true,
        orderId: 'order-1',
        paymentId: 'ch_mismatch',
        metadata: { orderId: 'order-1' },
      });
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);

      const payload = JSON.stringify({
        type: 'payment_intent.succeeded',
        id: 'evt_mismatch',
        data: { object: { amount_received: 5000 } }, // 50 != 100
      });

      await expect(service.handleWebhook(payload, 'sig', 'stripe')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('handles string payload (not Buffer)', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      const payload = JSON.stringify({ type: 'customer.updated', id: 'evt_str' });

      await expect(service.handleWebhook(payload, 'sig', 'stripe')).resolves.toBeUndefined();
    });

    it('skips idempotent failure record when one already exists', async () => {
      mockProvider.validateWebhook.mockReturnValue(true);
      mockProvider.processWebhook.mockResolvedValue({
        processed: true,
        orderId: 'order-1',
        paymentId: 'pi_fail',
        metadata: { orderId: 'order-1' },
      });
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
      mockPrisma.order.update.mockResolvedValue({});
      mockPrisma.payment.findFirst.mockResolvedValue({ id: 'existing-fail' });

      const payload = JSON.stringify({
        type: 'payment_intent.payment_failed',
        id: 'evt_dup_fail',
        data: { object: {} },
      });

      await service.handleWebhook(payload, 'sig', 'stripe');
      expect(mockPrisma.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('getAvailableProviders', () => {
    it('delegates to payment provider service', async () => {
      mockPaymentProviderService.ensureAvailableProviders.mockResolvedValue(['stripe']);
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

    it('returns key from integrations service when env is missing', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockIntegrationsService.getDecryptedCredentials.mockResolvedValue({
        publishableKey: 'pk_from_db',
      });

      const key = await service.getStripePublishableKey();
      expect(key).toBe('pk_from_db');
    });

    it('returns null when integrations service throws', async () => {
      mockConfigService.get.mockReturnValue(undefined);
      mockIntegrationsService.getDecryptedCredentials.mockRejectedValue(new Error('Not found'));

      const key = await service.getStripePublishableKey();
      expect(key).toBeNull();
    });
  });
});
