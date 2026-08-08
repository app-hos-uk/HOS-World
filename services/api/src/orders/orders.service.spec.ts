import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import { OrdersService } from './orders.service';
import { PrismaService } from '../database/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

describe('OrdersService - Phase 1 Tests', () => {
  let service: OrdersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    order: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    cart: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    cartItem: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    address: {
      findFirst: jest.fn(),
    },
    seller: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    orderNote: {
      create: jest.fn().mockResolvedValue({}),
    },
    vendorProduct: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    influencerCommission: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    influencer: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    influencerCampaign: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    giftCardTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
    },
    giftCard: {
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => {
      if (typeof callback === 'function') {
        const { Decimal } = require('@prisma/client/runtime/library');
        const mockOrder = {
          id: 'order-id',
          userId: 'user-id',
          sellerId: 'seller-id',
          orderNumber: 'ORD-12345',
          items: [],
          subtotal: new Decimal(199.98),
          tax: new Decimal(20),
          shipping: new Decimal(0),
          discount: new Decimal(0),
          total: new Decimal(219.98),
          status: 'PENDING',
          paymentStatus: 'PENDING',
          shippingAddress: {
            id: 'address-id',
            userId: 'user-id',
            firstName: 'Test',
            lastName: 'User',
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'USA',
          },
          billingAddress: {
            id: 'address-id',
            userId: 'user-id',
            firstName: 'Test',
            lastName: 'User',
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'USA',
          },
          seller: { id: 'seller-id', userId: 'seller-user-id', commissionRate: null },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const tx = {
          ...mockPrismaService,
          product: {
            findUnique: mockPrismaService.product.findUnique,
            findMany: jest.fn().mockResolvedValue([{ id: 'product-id', stock: 100, name: 'Test Product' }]),
            update: jest.fn().mockResolvedValue({ id: 'product-id', stock: 98 }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          vendorProduct: {
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          order: {
            create: jest.fn().mockResolvedValue(mockOrder),
            update: jest.fn().mockResolvedValue(mockOrder),
          },
          cartItem: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          cart: {
            update: jest.fn().mockResolvedValue({ id: 'cart-id', subtotal: 0, total: 0 }),
          },
          orderNote: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      }
      return Promise.resolve();
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'DEFAULT_COMMISSION_RATE') return defaultValue ?? 0.1;
      if (key === 'UNPAID_ORDER_TTL_MINUTES') return '60';
      return defaultValue ?? undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ModuleRef,
          useValue: { get: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-id';
    const createOrderDto: CreateOrderDto = {
      shippingAddressId: 'address-id',
      billingAddressId: 'address-id',
    };

    it('should create order from cart successfully', async () => {
      const { Decimal } = require('@prisma/client/runtime/library');
      const mockCart = {
        id: 'cart-id',
        userId,
        items: [
          {
            id: 'item-id',
            productId: 'product-id',
            quantity: 2,
            price: new Decimal(99.99),
            product: {
              id: 'product-id',
              sellerId: 'seller-id',
              stock: 100,
              taxRate: new Decimal(0.2),
              seller: {
                id: 'seller-id',
                userId: 'seller-user-id',
                commissionRate: null,
              },
            },
            variationOptions: null,
          },
        ],
        subtotal: new Decimal(199.98),
        tax: new Decimal(20),
        shipping: new Decimal(0),
        discount: new Decimal(0),
        total: new Decimal(219.98),
      };

      const mockAddress = {
        id: createOrderDto.shippingAddressId,
        userId,
      };

      const mockOrder = {
        id: 'order-id',
        userId,
        sellerId: 'seller-id',
        orderNumber: 'ORD-12345',
        items: [],
        subtotal: mockCart.subtotal,
        tax: mockCart.tax,
        total: mockCart.total,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        createdAt: new Date(),
      };

      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.address.findFirst.mockResolvedValue(mockAddress);
      mockPrismaService.seller.findUnique.mockResolvedValue({
        id: 'seller-id',
        userId: 'seller-user-id',
      });
      mockPrismaService.seller.findMany.mockResolvedValue([
        { id: 'seller-id', commissionRate: null },
      ]);
      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'product-id', stock: 100 });
      mockPrismaService.order.create.mockResolvedValue(mockOrder);
      mockPrismaService.cartItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.create(userId, createOrderDto);

      expect(mockPrismaService.cart.findUnique).toHaveBeenCalledWith({
        where: { userId },
        include: expect.any(Object),
      });
      expect(result).toHaveProperty('id');
      expect(result.orderNumber).toBeDefined();
    });

    it('should throw NotFoundException if cart is empty', async () => {
      const mockCart = {
        id: 'cart-id',
        userId,
        items: [],
      };

      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);

      await expect(service.create(userId, createOrderDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if address not found', async () => {
      const mockCart = {
        id: 'cart-id',
        userId,
        items: [{ id: 'item-id' }],
      };

      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.address.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, createOrderDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    const userId = 'user-id';

    it('should find all orders for user', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          userId,
          orderNumber: 'ORD-12345',
          total: 199.98,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          currency: 'USD',
          items: [],
          shippingAddress: {
            id: 'address-id',
            userId,
            firstName: 'Test',
            lastName: 'User',
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'USA',
          },
          seller: { id: 'seller-id', userId: 'seller-user-id' },
          billingAddress: {
            id: 'address-id',
            userId,
            firstName: 'Test',
            lastName: 'User',
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'USA',
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'order-2',
          userId,
          orderNumber: 'ORD-12346',
          total: 299.99,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          currency: 'USD',
          items: [],
          shippingAddress: {
            id: 'address-id',
            userId,
            firstName: 'Test',
            lastName: 'User',
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'USA',
          },
          billingAddress: {
            id: 'address-id',
            userId,
            firstName: 'Test',
            lastName: 'User',
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            postalCode: '12345',
            country: 'USA',
          },
          seller: { id: 'seller-id', userId: 'seller-user-id' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);
      mockPrismaService.order.count.mockResolvedValue(2);

      const result = await service.findAll(userId, 'CUSTOMER');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(mockPrismaService.order.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    const userId = 'user-id';
    const orderId = 'order-id';

    it('should find order by id', async () => {
      const mockOrder = {
        id: orderId,
        userId,
        orderNumber: 'ORD-12345',
        total: 199.98,
        status: 'PENDING',
        paymentStatus: 'PAID',
        currency: 'USD',
        shippingAddress: {
          id: 'address-id',
          userId,
          firstName: 'Test',
          lastName: 'User',
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
        },
        billingAddress: {
          id: 'address-id',
          userId,
          firstName: 'Test',
          lastName: 'User',
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
        },
        items: [],
        seller: { id: 'seller-id', userId: 'seller-user-id' },
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId, userId, 'CUSTOMER');

      expect(result.id).toBe(orderId);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.findOne(orderId, userId, 'CUSTOMER')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own order', async () => {
      const mockOrder = {
        id: orderId,
        userId: 'other-user-id',
        status: 'PENDING',
        paymentStatus: 'PAID',
        currency: 'USD',
        items: [],
        shippingAddress: {
          id: 'address-id',
          userId: 'other-user-id',
          firstName: 'Test',
          lastName: 'User',
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
        },
        billingAddress: {
          id: 'address-id',
          userId: 'other-user-id',
          firstName: 'Test',
          lastName: 'User',
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
        },
        seller: { id: 'seller-id', userId: 'seller-user-id' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.findOne(orderId, userId, 'CUSTOMER')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    const sellerId = 'seller-id';
    const orderId = 'order-id';
    const status = 'PROCESSING';

    it('should update order status', async () => {
      const mockOrder = {
        id: orderId,
        sellerId: 'seller-id',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        currency: 'USD',
        shippingAddress: {
          id: 'address-id',
          userId: 'user-id',
          firstName: 'Test',
          lastName: 'User',
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
        },
        billingAddress: {
          id: 'address-id',
          userId: 'user-id',
          firstName: 'Test',
          lastName: 'User',
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
        },
        seller: {
          id: 'seller-id',
          userId: sellerId,
        },
        childOrders: [],
        items: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedOrder = {
        ...mockOrder,
        status,
        trackingCode: 'TRACK123',
        items: [],
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-id', userId: sellerId });
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await service.update(orderId, sellerId, 'SELLER', {
        status,
        trackingCode: 'TRACK123',
      });

      expect(result).toHaveProperty('status');
    });

    it('should block seller fulfillment when order is unpaid', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        sellerId: 'seller-id',
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        childOrders: [],
      });
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-id', userId: sellerId });

      await expect(
        service.update(orderId, sellerId, 'SELLER', { status: 'PROCESSING' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByOrderNumber', () => {
    it('throws NotFoundException when order number does not exist', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(
        service.findByOrderNumber('HOS-MISSING', 'user-id', 'CUSTOMER'),
      ).rejects.toThrow(NotFoundException);
    });

    it('delegates to findOne when order number exists', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({ id: 'order-id' });
      const mockOrder = {
        id: 'order-id',
        userId: 'user-id',
        orderNumber: 'HOS-123',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        currency: 'USD',
        items: [],
        shippingAddress: null,
        billingAddress: null,
        seller: { id: 'seller-id', userId: 'seller-user-id' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findByOrderNumber('HOS-123', 'user-id', 'CUSTOMER');

      expect(result).toMatchObject({ id: 'order-id', orderNumber: 'HOS-123' });
    });
  });

  describe('getPublicOrderTracking', () => {
    it('throws NotFoundException when order number is unknown', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.getPublicOrderTracking('HOS-404')).rejects.toThrow(NotFoundException);
    });

    it('returns sanitized tracking payload without PII', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue({
        orderNumber: 'HOS-123',
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        total: 49.99,
        currency: 'USD',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
        trackingCode: 'TRACK1',
        carrier: 'DHL',
        trackingUrl: 'https://track.example/1',
        estimatedDeliveryAt: null,
        seller: { storeName: 'HOS Store', slug: 'hos-store' },
        items: [{ quantity: 1, product: { name: 'Wand' } }],
      });

      const result = await service.getPublicOrderTracking('HOS-123');

      expect(result).toMatchObject({
        orderNumber: 'HOS-123',
        status: 'SHIPPED',
        storeName: 'HOS Store',
        items: [{ quantity: 1, productName: 'Wand' }],
      });
      expect(result).not.toHaveProperty('shippingAddress');
      expect(result).not.toHaveProperty('billingAddress');
    });
  });

  describe('cancel', () => {
    const userId = 'user-id';
    const orderId = 'order-id';

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.cancel(orderId, userId, 'CUSTOMER')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for paid customer cancellation without skipApproval', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: 'PENDING',
        paymentStatus: 'PAID',
        items: [],
        childOrders: [],
      });

      await expect(service.cancel(orderId, userId, 'CUSTOMER')).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when customer does not own the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId: 'other-user-id',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: [],
        childOrders: [],
      });

      await expect(service.cancel(orderId, userId, 'CUSTOMER')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when customer tries to cancel a child order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        parentOrderId: 'parent-id',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: [],
        childOrders: [],
      });

      await expect(service.cancel(orderId, userId, 'CUSTOMER')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for unauthorized roles (FINANCE)', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: [],
        childOrders: [],
      });

      await expect(service.cancel(orderId, userId, 'FINANCE')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: 'DELIVERED',
        paymentStatus: 'PAID',
        items: [],
        childOrders: [],
      });

      await expect(
        service.cancel(orderId, userId, 'ADMIN', { skipApproval: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when customer cancels order not in PENDING/CONFIRMED', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        parentOrderId: null,
        status: 'PROCESSING',
        paymentStatus: 'PENDING',
        items: [],
        childOrders: [],
      });

      await expect(service.cancel(orderId, userId, 'CUSTOMER')).rejects.toThrow(BadRequestException);
    });

    it('should cancel an unpaid PENDING order for customer and restore stock', async () => {
      const { Decimal } = require('@prisma/client/runtime/library');
      const mockOrder = {
        id: orderId,
        userId,
        sellerId: 'seller-id',
        parentOrderId: null,
        orderNumber: 'HOS-TEST',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: [{ productId: 'p1', quantity: 2 }],
        childOrders: [],
        seller: { id: 'seller-id', commissionRate: null },
        total: new Decimal(100),
        subtotal: new Decimal(90),
        currency: 'USD',
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const cancelledResult = {
        ...mockOrder,
        status: 'CANCELLED',
        items: [],
        shippingAddress: null,
        billingAddress: null,
        seller: { id: 'seller-id', storeName: 'Store', slug: 'store' },
        notes: [],
      };

      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          const tx = {
            product: { update: jest.fn() },
            vendorProduct: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
            order: { update: jest.fn().mockResolvedValue(cancelledResult) },
            orderNote: { create: jest.fn() },
          };
          return callback(tx);
        }
        return Promise.resolve();
      });
      mockPrismaService.influencerCommission.findMany.mockResolvedValue([]);

      const result = await service.cancel(orderId, userId, 'CUSTOMER');

      expect(result).toBeDefined();
      expect(result.status).toBe('cancelled');
    });

    it('should cancel with skipApproval for ADMIN on paid order', async () => {
      const { Decimal } = require('@prisma/client/runtime/library');
      const mockOrder = {
        id: orderId,
        userId,
        sellerId: 'seller-id',
        parentOrderId: null,
        orderNumber: 'HOS-ADMIN',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        stripePaymentIntentId: null,
        items: [{ productId: 'p1', quantity: 1 }],
        childOrders: [],
        seller: { id: 'seller-id', commissionRate: null },
        total: new Decimal(50),
        subtotal: new Decimal(45),
        currency: 'USD',
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const cancelledResult = {
        ...mockOrder,
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED',
        items: [],
        shippingAddress: null,
        billingAddress: null,
        seller: { id: 'seller-id', storeName: 'Store', slug: 'store' },
        notes: [],
      };

      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          const tx = {
            product: { update: jest.fn() },
            vendorProduct: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
            order: { update: jest.fn().mockResolvedValue(cancelledResult) },
            orderNote: { create: jest.fn() },
          };
          return callback(tx);
        }
        return Promise.resolve();
      });
      mockPrismaService.giftCardTransaction.findMany.mockResolvedValue([]);
      mockPrismaService.influencerCommission.findMany.mockResolvedValue([]);

      const result = await service.cancel(orderId, userId, 'ADMIN', { skipApproval: true });

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when seller tries to cancel paid child order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId: 'customer-id',
        sellerId: 'seller-id',
        parentOrderId: 'parent-id',
        status: 'PENDING',
        paymentStatus: 'PAID',
        items: [],
        childOrders: [],
      });
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-id', userId: 'seller-user' });

      await expect(service.cancel(orderId, 'seller-user', 'SELLER')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll - additional scenarios', () => {
    it('should throw ForbiddenException for unauthorized role', async () => {
      await expect(service.findAll('user-id', 'RANDOM_ROLE')).rejects.toThrow(ForbiddenException);
    });

    it('should return empty data for SELLER with no seller profile', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue(null);

      const result = await service.findAll('user-id', 'SELLER');

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should apply status filter', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      const result = await service.findAll('user-id', 'ADMIN', { status: 'pending' });

      expect(result.data).toEqual([]);
      expect(mockPrismaService.order.findMany).toHaveBeenCalled();
    });

    it('should apply sellerId filter for ADMIN role', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      await service.findAll('admin-id', 'ADMIN', { sellerId: 'seller-123' });

      expect(mockPrismaService.order.findMany).toHaveBeenCalled();
    });

    it('should clamp page and limit to valid ranges', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      const result = await service.findAll('user-id', 'ADMIN', { page: -5, limit: 999 });

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });

    it('should query with paid-only filter for SELLER role', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-id' });
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      await service.findAll('seller-user', 'SELLER');

      expect(mockPrismaService.order.findMany).toHaveBeenCalled();
    });

    it('should also work for B2C_SELLER role', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'b2c-seller-id' });
      mockPrismaService.order.findMany.mockResolvedValue([]);
      mockPrismaService.order.count.mockResolvedValue(0);

      await service.findAll('b2c-user', 'B2C_SELLER');

      expect(mockPrismaService.seller.findUnique).toHaveBeenCalledWith({ where: { userId: 'b2c-user' } });
    });
  });

  describe('findOne - additional scenarios', () => {
    it('should allow ADMIN to view any order', async () => {
      const mockOrder = {
        id: 'order-id',
        userId: 'other-user',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        currency: 'USD',
        items: [],
        shippingAddress: null,
        billingAddress: null,
        seller: { id: 'seller-id', storeName: 'S', slug: 's' },
        notes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.findOne('order-id', 'admin-user', 'ADMIN');
      expect(result.id).toBe('order-id');
    });

    it('should throw ForbiddenException for seller who does not own the order', async () => {
      const mockOrder = {
        id: 'order-id',
        userId: 'customer',
        sellerId: 'other-seller',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        currency: 'USD',
        items: [],
        shippingAddress: null,
        billingAddress: null,
        seller: { id: 'other-seller', storeName: 'S', slug: 's' },
        childOrders: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'my-seller' });

      await expect(service.findOne('order-id', 'seller-user', 'SELLER')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for roles that cannot access all orders', async () => {
      const mockOrder = {
        id: 'order-id',
        userId: 'other-user',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        items: [],
        shippingAddress: null,
        billingAddress: null,
        seller: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);

      await expect(service.findOne('order-id', 'random-user', 'RANDOM_ROLE')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update - additional scenarios', () => {
    const sellerId = 'seller-user';
    const orderId = 'order-id';

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.update(orderId, sellerId, 'ADMIN', { status: 'CONFIRMED' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-admin non-seller role', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        sellerId: 'seller-id',
        status: 'PENDING',
        paymentStatus: 'PAID',
        childOrders: [],
      });

      await expect(service.update(orderId, 'user', 'CUSTOMER', { status: 'CONFIRMED' })).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when trying to set status to CANCELLED', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        sellerId: 'seller-id',
        status: 'PENDING',
        paymentStatus: 'PAID',
        childOrders: [],
        seller: { id: 'seller-id', userId: sellerId },
      });
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-id', userId: sellerId });

      await expect(service.update(orderId, sellerId, 'SELLER', { status: 'CANCELLED' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        sellerId: 'seller-id',
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        childOrders: [],
        seller: { id: 'seller-id', userId: sellerId },
      });
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-id', userId: sellerId });

      await expect(service.update(orderId, sellerId, 'SELLER', { status: 'PENDING' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when seller tries to ship without tracking code', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        sellerId: 'seller-id',
        status: 'FULFILLED',
        paymentStatus: 'PAID',
        trackingCode: null,
        childOrders: [],
        seller: { id: 'seller-id', userId: sellerId },
      });
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-id', userId: sellerId });

      await expect(
        service.update(orderId, sellerId, 'SELLER', { status: 'SHIPPED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when non-admin tries to change paymentStatus', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        sellerId: 'seller-id',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        childOrders: [],
        seller: { id: 'seller-id', userId: sellerId },
      });
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-id', userId: sellerId });

      await expect(
        service.update(orderId, sellerId, 'SELLER', { paymentStatus: 'REFUNDED' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when admin tries to set paymentStatus to PAID', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        sellerId: null,
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        childOrders: [],
      });

      await expect(
        service.update(orderId, 'admin-id', 'ADMIN', { paymentStatus: 'PAID' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when seller does not own the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        sellerId: 'other-seller',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        childOrders: [],
      });
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'my-seller', userId: sellerId });

      await expect(service.update(orderId, sellerId, 'SELLER', { status: 'PROCESSING' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addNote', () => {
    const orderId = 'order-id';
    const userId = 'user-id';

    it('should throw NotFoundException if order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.addNote(orderId, userId, 'CUSTOMER', { content: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user has no permission to add notes', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId: 'other-user',
        sellerId: 'some-seller',
        seller: { id: 'some-seller' },
      });
      mockPrismaService.seller.findUnique.mockResolvedValue(null);

      await expect(
        service.addNote(orderId, userId, 'SELLER', { content: 'note' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow customer (order owner) to add a note', async () => {
      mockPrismaService.order.findUnique
        .mockResolvedValueOnce({
          id: orderId,
          userId,
          sellerId: null,
          seller: null,
        })
        .mockResolvedValueOnce({
          id: orderId,
          userId,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          currency: 'USD',
          items: [],
          shippingAddress: null,
          billingAddress: null,
          seller: null,
          notes: [{ id: 'n1', content: 'note', internal: false, createdAt: new Date(), createdBy: userId }],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const result = await service.addNote(orderId, userId, 'CUSTOMER', { content: 'note' });

      expect(mockPrismaService.orderNote.create).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should not mark note as internal when customer adds it even if internal=true', async () => {
      mockPrismaService.order.findUnique
        .mockResolvedValueOnce({
          id: orderId,
          userId,
          sellerId: null,
          seller: null,
        })
        .mockResolvedValueOnce({
          id: orderId,
          userId,
          status: 'PENDING',
          paymentStatus: 'PENDING',
          currency: 'USD',
          items: [],
          shippingAddress: null,
          billingAddress: null,
          seller: null,
          notes: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      await service.addNote(orderId, userId, 'CUSTOMER', { content: 'note', internal: true });

      expect(mockPrismaService.orderNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ internal: false }),
        }),
      );
    });
  });

  describe('expireUnpaidOrders', () => {
    it('should return 0 when no stale orders exist', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      const result = await service.expireUnpaidOrders();

      expect(result).toBe(0);
    });

    it('should attempt to cancel stale orders', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([
        { id: 'stale-1', userId: 'user-1' },
      ]);

      const cancelSpy = jest.spyOn(service, 'cancel').mockResolvedValue({} as any);

      const result = await service.expireUnpaidOrders();

      expect(cancelSpy).toHaveBeenCalledWith('stale-1', 'user-1', 'ADMIN', expect.objectContaining({ skipApproval: true }));
      expect(result).toBe(1);

      cancelSpy.mockRestore();
    });

    it('should sweep failed payments too so burned loyalty points are released', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([]);

      await service.expireUnpaidOrders();

      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paymentStatus: { in: ['PENDING', 'FAILED'] },
          }),
        }),
      );
    });

    it('should handle cancel failures gracefully and continue', async () => {
      mockPrismaService.order.findMany.mockResolvedValue([
        { id: 'stale-1', userId: 'user-1' },
        { id: 'stale-2', userId: 'user-2' },
      ]);

      const cancelSpy = jest.spyOn(service, 'cancel')
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({} as any);

      const result = await service.expireUnpaidOrders();

      expect(result).toBe(1);

      cancelSpy.mockRestore();
    });
  });

  describe('vendorAcceptOrder', () => {
    it('should throw ForbiddenException when seller profile not found', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue(null);

      await expect(service.vendorAcceptOrder('order-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.vendorAcceptOrder('order-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when order is not assigned to the seller', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        sellerId: 'other-seller',
        parentOrderId: 'parent-1',
        status: 'PENDING',
        paymentStatus: 'PAID',
        seller: { id: 'other-seller' },
      });

      await expect(service.vendorAcceptOrder('order-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when order has no parentOrderId', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        sellerId: 'seller-1',
        parentOrderId: null,
        status: 'PENDING',
        paymentStatus: 'PAID',
        seller: { id: 'seller-1' },
      });

      await expect(service.vendorAcceptOrder('order-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when order is not paid', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        sellerId: 'seller-1',
        parentOrderId: 'parent-1',
        status: 'PENDING',
        paymentStatus: 'PENDING',
        seller: { id: 'seller-1' },
      });

      await expect(service.vendorAcceptOrder('order-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('vendorRejectOrder', () => {
    it('should throw ForbiddenException when seller profile not found', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue(null);

      await expect(
        service.vendorRejectOrder('order-1', 'user-1', 'Out of stock'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when order not found', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(
        service.vendorRejectOrder('order-1', 'user-1', 'No inventory'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when order not assigned to seller', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        sellerId: 'other-seller',
        parentOrderId: 'parent-1',
        status: 'PENDING',
        items: [],
        seller: { id: 'other-seller' },
      });

      await expect(
        service.vendorRejectOrder('order-1', 'user-1', 'reason'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when order has no parentOrderId', async () => {
      mockPrismaService.seller.findUnique.mockResolvedValue({ id: 'seller-1' });
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: 'order-1',
        sellerId: 'seller-1',
        parentOrderId: null,
        status: 'PENDING',
        items: [],
        seller: { id: 'seller-1' },
      });

      await expect(
        service.vendorRejectOrder('order-1', 'user-1', 'reason'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reorder', () => {
    const userId = 'user-id';
    const orderId = 'order-id';

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue(null);

      await expect(service.reorder(orderId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user does not own the order', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId: 'other-user',
        status: 'DELIVERED',
        items: [],
      });

      await expect(service.reorder(orderId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when order is not in DELIVERED status', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: 'PENDING',
        items: [],
      });

      await expect(service.reorder(orderId, userId)).rejects.toThrow(BadRequestException);
    });

    it('should create cart if none exists and add items', async () => {
      const mockProduct = { id: 'p1', stock: 10, price: 25.00 };

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: 'DELIVERED',
        orderNumber: 'HOS-RE',
        items: [
          { productId: 'p1', quantity: 2, variationOptions: null, product: mockProduct },
        ],
      });
      mockPrismaService.cart.findUnique.mockResolvedValue(null);
      mockPrismaService.cart.create.mockResolvedValue({ id: 'new-cart', userId });
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(null);
      mockPrismaService.cartItem.create.mockResolvedValue({});
      mockPrismaService.cartItem.findMany.mockResolvedValue([{ price: 25, quantity: 2 }]);
      mockPrismaService.cart.update.mockResolvedValue({});

      const result = await service.reorder(orderId, userId);

      expect(result.itemsAdded).toBe(1);
      expect(result.itemsUpdated).toBe(0);
      expect(mockPrismaService.cart.create).toHaveBeenCalled();
    });

    it('should update existing cart item quantity', async () => {
      const mockProduct = { id: 'p1', stock: 10, price: 20.00 };

      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: 'DELIVERED',
        orderNumber: 'HOS-RE2',
        items: [
          { productId: 'p1', quantity: 3, variationOptions: null, product: mockProduct },
        ],
      });
      mockPrismaService.cart.findUnique.mockResolvedValue({ id: 'cart-id', userId });
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.cartItem.findFirst.mockResolvedValue({ id: 'ci-1', quantity: 2 });
      mockPrismaService.cartItem.update.mockResolvedValue({});
      mockPrismaService.cartItem.findMany.mockResolvedValue([{ price: 20, quantity: 5 }]);
      mockPrismaService.cart.update.mockResolvedValue({});

      const result = await service.reorder(orderId, userId);

      expect(result.itemsAdded).toBe(0);
      expect(result.itemsUpdated).toBe(1);
    });

    it('should skip products that no longer exist', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: 'DELIVERED',
        orderNumber: 'HOS-SKIP',
        items: [
          { productId: 'p-deleted', quantity: 1, variationOptions: null, product: null },
        ],
      });
      mockPrismaService.cart.findUnique.mockResolvedValue({ id: 'cart-id', userId });
      mockPrismaService.product.findUnique.mockResolvedValue(null);
      mockPrismaService.cartItem.findMany.mockResolvedValue([]);
      mockPrismaService.cart.update.mockResolvedValue({});

      const result = await service.reorder(orderId, userId);

      expect(result.itemsAdded).toBe(0);
      expect(result.itemsUpdated).toBe(0);
    });

    it('should skip products that are out of stock', async () => {
      mockPrismaService.order.findUnique.mockResolvedValue({
        id: orderId,
        userId,
        status: 'DELIVERED',
        orderNumber: 'HOS-OOS',
        items: [
          { productId: 'p-oos', quantity: 2, variationOptions: null, product: { id: 'p-oos', stock: 0 } },
        ],
      });
      mockPrismaService.cart.findUnique.mockResolvedValue({ id: 'cart-id', userId });
      mockPrismaService.product.findUnique.mockResolvedValue({ id: 'p-oos', stock: 0, price: 10 });
      mockPrismaService.cartItem.findMany.mockResolvedValue([]);
      mockPrismaService.cart.update.mockResolvedValue({});

      const result = await service.reorder(orderId, userId);

      expect(result.itemsAdded).toBe(0);
      expect(result.itemsUpdated).toBe(0);
    });
  });

  describe('reverseInfluencerAttribution', () => {
    it('should return early when no commissions exist for the order', async () => {
      mockPrismaService.influencerCommission.findMany.mockResolvedValue([]);

      await service.reverseInfluencerAttribution('order-1');

      expect(mockPrismaService.influencerCommission.update).not.toHaveBeenCalled();
    });

    it('should skip already cancelled commissions', async () => {
      mockPrismaService.influencerCommission.findMany.mockResolvedValue([
        { id: 'c1', status: 'CANCELLED', influencerId: 'inf-1', referral: null },
      ]);

      await service.reverseInfluencerAttribution('order-1');

      expect(mockPrismaService.influencerCommission.update).not.toHaveBeenCalled();
    });

    it('should cancel PENDING commissions without decrementing stats', async () => {
      const { Decimal } = require('@prisma/client/runtime/library');
      mockPrismaService.influencerCommission.findMany.mockResolvedValue([
        {
          id: 'c1',
          status: 'PENDING',
          influencerId: 'inf-1',
          orderId: 'order-1',
          orderTotal: new Decimal(100),
          amount: new Decimal(10),
          payoutId: null,
          metadata: null,
          referral: null,
        },
      ]);

      await service.reverseInfluencerAttribution('order-1');

      expect(mockPrismaService.influencerCommission.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should cancel APPROVED commissions and decrement influencer stats', async () => {
      const { Decimal } = require('@prisma/client/runtime/library');
      mockPrismaService.influencerCommission.findMany.mockResolvedValue([
        {
          id: 'c1',
          status: 'APPROVED',
          influencerId: 'inf-1',
          orderId: 'order-1',
          orderTotal: new Decimal(100),
          amount: new Decimal(10),
          payoutId: null,
          metadata: null,
          referral: null,
        },
      ]);
      mockPrismaService.influencer.findUnique.mockResolvedValue({
        id: 'inf-1',
        totalConversions: 5,
        totalSalesAmount: new Decimal(500),
        totalCommission: new Decimal(50),
      });
      mockPrismaService.influencer.update.mockResolvedValue({});

      await service.reverseInfluencerAttribution('order-1');

      expect(mockPrismaService.influencer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inf-1' } }),
      );
      expect(mockPrismaService.influencerCommission.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'CANCELLED' },
      });
    });

    it('should log warning for PAID commissions but still cancel them', async () => {
      const { Decimal } = require('@prisma/client/runtime/library');
      mockPrismaService.influencerCommission.findMany.mockResolvedValue([
        {
          id: 'c1',
          status: 'PAID',
          influencerId: 'inf-1',
          orderId: 'order-1',
          orderTotal: new Decimal(100),
          amount: new Decimal(10),
          payoutId: 'payout-1',
          metadata: null,
          referral: null,
        },
      ]);

      await service.reverseInfluencerAttribution('order-1');

      expect(mockPrismaService.influencerCommission.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'CANCELLED' },
      });
    });
  });
});
