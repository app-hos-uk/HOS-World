import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';
import { PrismaService } from '../database/prisma.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

describe('CartService - Phase 1 Tests', () => {
  let service: CartService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    cart: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cartItem: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('addItem', () => {
    const userId = 'user-id';
    const addToCartDto: AddToCartDto = {
      productId: 'product-id',
      quantity: 2,
    };

    it('should add item to cart successfully', async () => {
      const mockProduct = {
        id: addToCartDto.productId,
        price: 99.99,
        stock: 100,
        status: 'ACTIVE',
      };

      const mockCart = {
        id: 'cart-id',
        userId,
        items: [],
        total: 0,
        subtotal: 0,
        tax: 0,
      };

      const mockCartItem = {
        id: 'cart-item-id',
        cartId: mockCart.id,
        productId: addToCartDto.productId,
        quantity: addToCartDto.quantity,
        price: mockProduct.price,
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.findFirst.mockResolvedValue(null);
      mockPrismaService.cartItem.create.mockResolvedValue(mockCartItem);
      mockPrismaService.cart.update.mockResolvedValue({
        ...mockCart,
        total: mockProduct.price * addToCartDto.quantity,
      });

      const result = await service.addItem(userId, addToCartDto);

      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: addToCartDto.productId },
        include: {
          images: {
            orderBy: { order: 'asc' },
            take: 1,
          },
        },
      });
      expect(result).toHaveProperty('items');
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem(userId, addToCartDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if product out of stock', async () => {
      const mockProduct = {
        id: addToCartDto.productId,
        price: 99.99,
        stock: 0,
        status: 'ACTIVE',
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);

      await expect(service.addItem(userId, addToCartDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCart', () => {
    const userId = 'user-id';

    it('should get cart with items', async () => {
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
              name: 'Test Product',
              price: 99.99,
              currency: 'USD',
              taxRate: 0.2,
              stock: 100,
              slug: 'test-product',
              status: 'ACTIVE',
              images: [],
              seller: {
                id: 'seller-id',
                userId: 'seller-user-id',
                storeName: 'Test Store',
                slug: 'test-store',
              },
            },
          },
        ],
        total: 199.98,
        subtotal: 199.98,
        tax: 0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);

      const result = await service.getCart(userId);

      expect(result).toHaveProperty('items');
      expect(result.items.length).toBe(1);
    });

    it('should create cart if not exists', async () => {
      const mockCart = {
        id: 'cart-id',
        userId,
        items: [],
        total: 0,
        subtotal: 0,
        tax: 0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.cart.findUnique.mockResolvedValue(null);
      mockPrismaService.cart.create.mockResolvedValue(mockCart);

      const result = await service.getCart(userId);

      expect(mockPrismaService.cart.create).toHaveBeenCalled();
      expect(result).toHaveProperty('items');
    });
  });

  describe('updateItem', () => {
    const userId = 'user-id';
    const itemId = 'item-id';
    const updateDto = { quantity: 5 };

    it('should update cart item quantity', async () => {
      const mockCartItem = {
        id: itemId,
        cartId: 'cart-id',
        productId: 'product-id',
        quantity: 2,
        price: 99.99,
        cart: {
          userId,
        },
        product: {
          id: 'product-id',
          price: 99.99,
          stock: 100,
        },
      };

      const updatedItem = {
        ...mockCartItem,
        quantity: updateDto.quantity,
      };

      const mockCart = {
        id: 'cart-id',
        userId,
        items: [
          {
            id: itemId,
            productId: 'product-id',
            quantity: updateDto.quantity,
            price: 99.99,
            product: {
              id: 'product-id',
              price: 99.99,
              taxRate: 0.2,
              status: 'ACTIVE',
              images: [],
              seller: { id: 'seller-id', userId: 'seller-user-id' },
            },
          },
        ],
        total: 0,
        subtotal: 0,
        tax: 0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.cartItem.findUnique.mockResolvedValue(mockCartItem);
      mockPrismaService.cartItem.update.mockResolvedValue(updatedItem);
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cart.update.mockResolvedValue(mockCart);

      const result = await service.updateItem(userId, itemId, updateDto);

      expect(mockPrismaService.cartItem.update).toHaveBeenCalled();
      expect(result).toHaveProperty('items');
    });

    it('should throw NotFoundException if item not found', async () => {
      mockPrismaService.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.updateItem(userId, itemId, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeItem', () => {
    const userId = 'user-id';
    const itemId = 'item-id';

    it('should remove item from cart', async () => {
      const mockCartItem = {
        id: itemId,
        cartId: 'cart-id',
        cart: {
          userId,
        },
      };

      const mockCart = {
        id: 'cart-id',
        userId,
        items: [],
        total: 0,
        subtotal: 0,
        tax: 0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.cartItem.findUnique.mockResolvedValue(mockCartItem);
      mockPrismaService.cartItem.delete.mockResolvedValue(mockCartItem);
      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cart.update.mockResolvedValue(mockCart);

      const result = await service.removeItem(userId, itemId);

      expect(mockPrismaService.cartItem.delete).toHaveBeenCalledWith({
        where: { id: itemId },
      });
      expect(result).toHaveProperty('items');
    });
  });

  describe('clearCart', () => {
    const userId = 'user-id';

    it('should clear all items from cart', async () => {
      const mockCart = {
        id: 'cart-id',
        userId,
        items: [],
        total: 0,
        subtotal: 0,
        tax: 0,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.cart.findUnique.mockResolvedValue(mockCart);
      mockPrismaService.cartItem.deleteMany.mockResolvedValue({ count: 2 });
      mockPrismaService.cart.update.mockResolvedValue(mockCart);
      mockPrismaService.cart.update.mockResolvedValue({
        ...mockCart,
        items: [],
        total: 0,
      });

      await service.clearCart(userId);

      expect(mockPrismaService.cartItem.deleteMany).toHaveBeenCalled();
    });
  });
});
