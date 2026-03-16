import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      update: jest.fn(),
    },
    cartItem: {
      findMany: jest.fn(),
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
    },
    orderNote: {
      create: jest.fn().mockResolvedValue({}),
    },
    vendorProduct: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((callback) => {
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
          update: jest.fn().mockResolvedValue({ id: 'product-id', stock: 98 }),
        },
        vendorProduct: {
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockResolvedValue({}),
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
      };
      return callback(tx);
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      if (key === 'DEFAULT_COMMISSION_RATE') return defaultValue ?? 0.1;
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
  });
});
