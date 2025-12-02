import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    },
    cart: {
      findUnique: jest.fn(),
    },
    cartItem: {
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    address: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
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
      const mockCart = {
        id: 'cart-id',
        userId,
        items: [
          {
            id: 'item-id',
            productId: 'product-id',
            quantity: 2,
            price: 99.99,
            product: {
              id: 'product-id',
              sellerId: 'seller-id',
              stock: 100,
            },
          },
        ],
        subtotal: 199.98,
        tax: 20,
        total: 219.98,
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

      await expect(service.create(userId, createOrderDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if address not found', async () => {
      const mockCart = {
        id: 'cart-id',
        userId,
        items: [{ id: 'item-id' }],
      };

      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.address.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, createOrderDto)).rejects.toThrow(
        NotFoundException,
      );
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
        },
        {
          id: 'order-2',
          userId,
          orderNumber: 'ORD-12346',
          total: 299.99,
        },
      ];

      mockPrismaService.order.findMany.mockResolvedValue(mockOrders);

      const result = await service.findAll(userId);

      expect(result).toEqual(mockOrders);
      expect(mockPrismaService.order.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
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
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.findOne(orderId, userId);

      expect(result.id).toBe(orderId);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrismaService.order.findFirst.mockResolvedValue(null);

      await expect(service.findOne(orderId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own order', async () => {
      const mockOrder = {
        id: orderId,
        userId: 'other-user-id',
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);

      await expect(service.findOne(orderId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('updateOrderStatus', () => {
    const sellerId = 'seller-id';
    const orderId = 'order-id';
    const status = 'SHIPPED';

    it('should update order status', async () => {
      const mockOrder = {
        id: orderId,
        sellerId,
        status: 'CONFIRMED',
      };

      const updatedOrder = {
        ...mockOrder,
        status,
        trackingCode: 'TRACK123',
      };

      mockPrismaService.order.findFirst.mockResolvedValue(mockOrder);
      mockPrismaService.order.update.mockResolvedValue(updatedOrder);

      const result = await service.updateOrderStatus(sellerId, orderId, {
        status,
        trackingCode: 'TRACK123',
      });

      expect(result.status).toBe(status);
    });
  });
});


