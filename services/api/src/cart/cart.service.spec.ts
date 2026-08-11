import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { CartService } from './cart.service';
import { PrismaService } from '../database/prisma.service';
import { PromotionsService } from '../promotions/promotions.service';
import { ShippingService } from '../shipping/shipping.service';
import { TaxService } from '../tax/tax.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { AddToCartDto } from './dto/add-to-cart.dto';

describe('CartService', () => {
  let service: CartService;

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    description: 'A test product',
    slug: 'test-product',
    price: new Decimal(29.99),
    currency: 'USD',
    taxRate: new Decimal(0.1),
    taxClassId: null,
    stock: 50,
    status: 'ACTIVE',
    sellerId: 'seller-1',
    categoryId: 'cat-1',
    images: [{ id: 'img-1', url: 'http://img.jpg', alt: null, order: 0, type: 'PRODUCT' }],
    seller: { id: 'seller-1', storeName: 'Test Store', slug: 'test-store' },
  };

  const mockCartItem = {
    id: 'item-1',
    cartId: 'cart-1',
    productId: 'product-1',
    quantity: 2,
    price: new Decimal(29.99),
    variationOptions: {},
    product: mockProduct,
  };

  const mockCart = {
    id: 'cart-1',
    userId: 'user-1',
    guestSessionId: null,
    items: [mockCartItem],
    total: new Decimal(65.98),
    subtotal: new Decimal(59.98),
    tax: new Decimal(6),
    discount: new Decimal(0),
    shipping: new Decimal(0),
    couponCode: null,
    currency: 'USD',
    promotionFreeShipping: false,
    loyaltyDiscountAmount: new Decimal(0),
    pendingLoyaltyPoints: null,
    pendingLoyaltyOptionId: null,
    abandonedEmailSentAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const emptyCart = {
    ...mockCart,
    items: [],
    total: new Decimal(0),
    subtotal: new Decimal(0),
    tax: new Decimal(0),
  };

  const mockPrisma = {
    cart: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    cartItem: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    wishlistItem: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    address: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn(),
  };

  const mockPromotionsService = {
    applyPromotionsToCart: jest.fn().mockResolvedValue({ discount: 0, freeShipping: false }),
  };

  const mockShippingService = {};

  const mockTaxService = {
    calculateTax: jest.fn().mockResolvedValue({ tax: 0, rate: 0 }),
  };

  const mockLoyaltyService = {
    validateCartRedemption: jest.fn(),
    clearCartLoyaltyState: jest.fn(),
    isEnabled: jest.fn().mockReturnValue(false),
    isFreeShippingOption: jest.fn().mockResolvedValue(false),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PromotionsService, useValue: mockPromotionsService },
        { provide: ShippingService, useValue: mockShippingService },
        { provide: TaxService, useValue: mockTaxService },
        { provide: LoyaltyService, useValue: mockLoyaltyService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);

    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.wishlistItem.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.address.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPromotionsService.applyPromotionsToCart.mockResolvedValue({
      discount: 0,
      freeShipping: false,
    });
  });

  describe('getCart', () => {
    it('returns existing cart with items', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(mockCart);

      const result = await service.getCart('user-1');
      expect(result.id).toBe('cart-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].price).toBe(29.99);
    });

    it('creates empty cart if not exists', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);
      mockPrisma.cart.create.mockResolvedValue(emptyCart);

      const result = await service.getCart('user-1');
      expect(mockPrisma.cart.create).toHaveBeenCalled();
      expect(result.items).toHaveLength(0);
    });
  });

  describe('addItem', () => {
    const userId = 'user-1';
    const addToCartDto: AddToCartDto = {
      productId: 'product-1',
      quantity: 2,
    };

    it('adds a new item to cart successfully', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId, items: [] }) // inside transaction
        .mockResolvedValueOnce(mockCart); // recalculate fetch
      mockPrisma.cartItem.create.mockResolvedValue(mockCartItem);
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      const result = await service.addItem(userId, addToCartDto);
      expect(result).toHaveProperty('items');
    });

    it('throws NotFoundException if product not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addItem(userId, addToCartDto)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if product is not ACTIVE', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        status: 'DRAFT',
      });

      await expect(service.addItem(userId, addToCartDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if insufficient stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stock: 1,
      });

      await expect(service.addItem(userId, addToCartDto)).rejects.toThrow(BadRequestException);
    });

    it('increments quantity for existing item with same product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({
          id: 'cart-1',
          userId,
          items: [{ ...mockCartItem, quantity: 1, variationOptions: {} }],
        })
        .mockResolvedValueOnce(mockCart);
      mockPrisma.cartItem.update.mockResolvedValue({ ...mockCartItem, quantity: 3 });
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      const result = await service.addItem(userId, addToCartDto);
      expect(mockPrisma.cartItem.update).toHaveBeenCalled();
      expect(result).toHaveProperty('items');
    });

    it('throws when incrementing would exceed stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, stock: 2 });
      mockPrisma.cart.findUnique.mockResolvedValue({
        id: 'cart-1',
        userId,
        items: [{ ...mockCartItem, quantity: 1, variationOptions: {} }],
      });

      await expect(service.addItem(userId, addToCartDto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when cart has 50 distinct items', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        productId: `product-${i}`,
        quantity: 1,
        variationOptions: {},
      }));
      mockPrisma.cart.findUnique.mockResolvedValue({ id: 'cart-1', userId, items });

      await expect(
        service.addItem(userId, { productId: 'product-new', quantity: 1 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows adding when cart is full but item already exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `item-${i}`,
        productId: i === 0 ? 'product-1' : `product-${i}`,
        quantity: 1,
        variationOptions: {},
      }));
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId, items })
        .mockResolvedValueOnce(mockCart);
      mockPrisma.cartItem.update.mockResolvedValue(mockCartItem);
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      const result = await service.addItem(userId, addToCartDto);
      expect(result).toHaveProperty('items');
    });

    it('creates new item when variationOptions differ', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({
          id: 'cart-1',
          userId,
          items: [{ ...mockCartItem, variationOptions: { color: 'red' } }],
        })
        .mockResolvedValueOnce(mockCart);
      mockPrisma.cartItem.create.mockResolvedValue(mockCartItem);
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      const result = await service.addItem(userId, {
        productId: 'product-1',
        quantity: 1,
        variationOptions: { color: 'blue' },
      });
      expect(mockPrisma.cartItem.create).toHaveBeenCalled();
      expect(result).toHaveProperty('items');
    });

    it('removes item from wishlist after adding to cart', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId, items: [] })
        .mockResolvedValueOnce(mockCart);
      mockPrisma.cartItem.create.mockResolvedValue(mockCartItem);
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      await service.addItem(userId, addToCartDto);
      expect(mockPrisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
        where: { userId, productId: 'product-1' },
      });
    });
  });

  describe('updateItem', () => {
    const userId = 'user-1';
    const itemId = 'item-1';

    it('updates cart item quantity', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        ...mockCartItem,
        cart: { userId },
        product: mockProduct,
      });
      mockPrisma.cartItem.update.mockResolvedValue({ ...mockCartItem, quantity: 5 });
      mockPrisma.cart.findUnique.mockResolvedValue(mockCart);
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      const result = await service.updateItem(userId, itemId, { quantity: 5 });
      expect(mockPrisma.cartItem.update).toHaveBeenCalled();
      expect(result).toHaveProperty('items');
    });

    it('throws NotFoundException if item not found', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(service.updateItem(userId, 'missing', { quantity: 1 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if item belongs to another user', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        ...mockCartItem,
        cart: { userId: 'other-user' },
        product: mockProduct,
      });

      await expect(service.updateItem(userId, itemId, { quantity: 1 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException if product is no longer active', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        ...mockCartItem,
        cart: { userId },
        product: { ...mockProduct, status: 'INACTIVE' },
      });

      await expect(service.updateItem(userId, itemId, { quantity: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException if insufficient stock', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        ...mockCartItem,
        cart: { userId },
        product: { ...mockProduct, stock: 3 },
      });

      await expect(service.updateItem(userId, itemId, { quantity: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeItem', () => {
    const userId = 'user-1';
    const itemId = 'item-1';

    it('removes item from cart', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: itemId,
        cartId: 'cart-1',
        cart: { userId },
      });
      mockPrisma.cartItem.delete.mockResolvedValue({});
      mockPrisma.cart.findUnique.mockResolvedValue(emptyCart);
      mockPrisma.cart.update.mockResolvedValue(emptyCart);

      const result = await service.removeItem(userId, itemId);
      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({ where: { id: itemId } });
      expect(result).toHaveProperty('items');
    });

    it('throws NotFoundException if item not found', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue(null);
      await expect(service.removeItem(userId, 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if item belongs to another user', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: itemId,
        cartId: 'cart-1',
        cart: { userId: 'other-user' },
      });
      await expect(service.removeItem(userId, itemId)).rejects.toThrow(ForbiddenException);
    });

    it('falls back to getCart on recalculation error', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue({
        id: itemId,
        cartId: 'cart-1',
        cart: { userId },
      });
      mockPrisma.cartItem.delete.mockResolvedValue({});
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce(null) // recalculate throws
        .mockResolvedValueOnce(emptyCart); // getCart fallback

      mockPrisma.cart.create.mockResolvedValue(emptyCart);

      const result = await service.removeItem(userId, itemId);
      expect(result).toHaveProperty('items');
    });
  });

  describe('clearCart', () => {
    const userId = 'user-1';

    it('clears all items from cart', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId }) // clearCart lookup
        .mockResolvedValueOnce(emptyCart); // recalculate
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.cart.update.mockResolvedValue(emptyCart);

      const result = await service.clearCart(userId);
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'cart-1' },
      });
      expect(result.items).toHaveLength(0);
    });

    it('throws NotFoundException if cart not found', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);
      await expect(service.clearCart(userId)).rejects.toThrow(NotFoundException);
    });

    it('clears loyalty state via loyalty service', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId })
        .mockResolvedValueOnce(emptyCart);
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.cart.update.mockResolvedValue(emptyCart);

      await service.clearCart(userId);
      expect(mockLoyaltyService.clearCartLoyaltyState).toHaveBeenCalledWith('cart-1');
    });
  });

  describe('Guest Cart', () => {
    const validGuestId = '12345678-1234-4abc-8abc-123456789012';

    describe('assertGuestSession validation', () => {
      it('throws BadRequestException for empty session', async () => {
        await expect(service.getGuestCart('')).rejects.toThrow(BadRequestException);
      });

      it('throws BadRequestException for short session', async () => {
        await expect(service.getGuestCart('short')).rejects.toThrow(BadRequestException);
      });

      it('throws BadRequestException for non-UUID session', async () => {
        await expect(service.getGuestCart('abcdefgh-1234-1234-1234-123456789012')).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('getGuestCart', () => {
      it('returns existing guest cart', async () => {
        mockPrisma.cart.findUnique.mockResolvedValue({
          ...emptyCart,
          userId: null,
          guestSessionId: validGuestId,
        });

        const result = await service.getGuestCart(validGuestId);
        expect(result.items).toHaveLength(0);
      });

      it('creates guest cart if not exists', async () => {
        mockPrisma.cart.findUnique.mockResolvedValue(null);
        mockPrisma.cart.create.mockResolvedValue({
          ...emptyCart,
          userId: null,
          guestSessionId: validGuestId,
        });

        const result = await service.getGuestCart(validGuestId);
        expect(mockPrisma.cart.create).toHaveBeenCalled();
        expect(result).toHaveProperty('items');
      });
    });

    describe('addGuestItem', () => {
      it('adds item to guest cart', async () => {
        mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
        mockPrisma.cart.findUnique
          .mockResolvedValueOnce({
            id: 'g-cart',
            guestSessionId: validGuestId,
            userId: null,
            items: [],
          })
          .mockResolvedValueOnce({ ...mockCart, userId: null, guestSessionId: validGuestId });
        mockPrisma.cartItem.create.mockResolvedValue(mockCartItem);
        mockPrisma.cart.update.mockResolvedValue({ ...mockCart, userId: null });

        const result = await service.addGuestItem(validGuestId, {
          productId: 'product-1',
          quantity: 1,
        });
        expect(result).toHaveProperty('items');
      });

      it('throws NotFoundException for missing product', async () => {
        mockPrisma.product.findUnique.mockResolvedValue(null);

        await expect(
          service.addGuestItem(validGuestId, { productId: 'missing', quantity: 1 }),
        ).rejects.toThrow(NotFoundException);
      });

      it('throws BadRequestException for inactive product', async () => {
        mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, status: 'DRAFT' });

        await expect(
          service.addGuestItem(validGuestId, { productId: 'product-1', quantity: 1 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('throws BadRequestException for insufficient stock', async () => {
        mockPrisma.product.findUnique.mockResolvedValue({ ...mockProduct, stock: 0 });

        await expect(
          service.addGuestItem(validGuestId, { productId: 'product-1', quantity: 1 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('throws BadRequestException if cart has userId (not guest)', async () => {
        mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
        mockPrisma.cart.findUnique.mockResolvedValue({
          id: 'g-cart',
          guestSessionId: validGuestId,
          userId: 'user-1',
          items: [],
        });

        await expect(
          service.addGuestItem(validGuestId, { productId: 'product-1', quantity: 1 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('increments quantity for existing guest item', async () => {
        mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
        mockPrisma.cart.findUnique
          .mockResolvedValueOnce({
            id: 'g-cart',
            guestSessionId: validGuestId,
            userId: null,
            items: [{ ...mockCartItem, quantity: 1, variationOptions: {} }],
          })
          .mockResolvedValueOnce({ ...mockCart, userId: null });
        mockPrisma.cartItem.update.mockResolvedValue({});
        mockPrisma.cart.update.mockResolvedValue({ ...mockCart, userId: null });

        const result = await service.addGuestItem(validGuestId, {
          productId: 'product-1',
          quantity: 2,
        });
        expect(mockPrisma.cartItem.update).toHaveBeenCalled();
        expect(result).toHaveProperty('items');
      });

      it('throws when MAX_CART_ITEMS reached for new product', async () => {
        mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
        const items = Array.from({ length: 50 }, (_, i) => ({
          id: `item-${i}`,
          productId: `prod-${i}`,
          quantity: 1,
          variationOptions: {},
        }));
        mockPrisma.cart.findUnique.mockResolvedValue({
          id: 'g-cart',
          guestSessionId: validGuestId,
          userId: null,
          items,
        });

        await expect(
          service.addGuestItem(validGuestId, { productId: 'product-1', quantity: 1 }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateGuestItem', () => {
      it('updates guest cart item quantity', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue({
          ...mockCartItem,
          cart: { guestSessionId: validGuestId, userId: null },
          product: { ...mockProduct, status: 'ACTIVE' },
        });
        mockPrisma.cartItem.update.mockResolvedValue({});
        mockPrisma.cart.findUnique.mockResolvedValue({ ...mockCart, userId: null });
        mockPrisma.cart.update.mockResolvedValue({ ...mockCart, userId: null });

        const result = await service.updateGuestItem(validGuestId, 'item-1', { quantity: 3 });
        expect(result).toHaveProperty('items');
      });

      it('throws NotFoundException for missing item', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue(null);

        await expect(
          service.updateGuestItem(validGuestId, 'missing', { quantity: 1 }),
        ).rejects.toThrow(NotFoundException);
      });

      it('throws ForbiddenException for wrong session', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue({
          ...mockCartItem,
          cart: { guestSessionId: 'other-session', userId: null },
          product: mockProduct,
        });

        await expect(
          service.updateGuestItem(validGuestId, 'item-1', { quantity: 1 }),
        ).rejects.toThrow(ForbiddenException);
      });

      it('throws BadRequestException for inactive product', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue({
          ...mockCartItem,
          cart: { guestSessionId: validGuestId, userId: null },
          product: { ...mockProduct, status: 'INACTIVE' },
        });

        await expect(
          service.updateGuestItem(validGuestId, 'item-1', { quantity: 1 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('throws BadRequestException for insufficient stock', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue({
          ...mockCartItem,
          cart: { guestSessionId: validGuestId, userId: null },
          product: { ...mockProduct, stock: 2 },
        });

        await expect(
          service.updateGuestItem(validGuestId, 'item-1', { quantity: 5 }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('removeGuestItem', () => {
      it('removes item from guest cart', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue({
          id: 'item-1',
          cartId: 'g-cart',
          cart: { guestSessionId: validGuestId },
        });
        mockPrisma.cartItem.delete.mockResolvedValue({});
        mockPrisma.cart.findUnique.mockResolvedValue({ ...emptyCart, userId: null });
        mockPrisma.cart.update.mockResolvedValue({ ...emptyCart, userId: null });

        const result = await service.removeGuestItem(validGuestId, 'item-1');
        expect(mockPrisma.cartItem.delete).toHaveBeenCalled();
        expect(result).toHaveProperty('items');
      });

      it('throws NotFoundException for missing item', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue(null);
        await expect(service.removeGuestItem(validGuestId, 'missing')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('throws ForbiddenException for wrong session', async () => {
        mockPrisma.cartItem.findUnique.mockResolvedValue({
          id: 'item-1',
          cartId: 'g-cart',
          cart: { guestSessionId: 'other-session' },
        });
        await expect(service.removeGuestItem(validGuestId, 'item-1')).rejects.toThrow(
          ForbiddenException,
        );
      });
    });

    describe('clearGuestCart', () => {
      it('clears all items from guest cart', async () => {
        mockPrisma.cart.findUnique
          .mockResolvedValueOnce({ id: 'g-cart', guestSessionId: validGuestId })
          .mockResolvedValueOnce({ ...emptyCart, userId: null });
        mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 2 });
        mockPrisma.cart.update.mockResolvedValue({ ...emptyCart, userId: null });

        const result = await service.clearGuestCart(validGuestId);
        expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalled();
        expect(result.items).toHaveLength(0);
      });

      it('throws NotFoundException if guest cart not found', async () => {
        mockPrisma.cart.findUnique.mockResolvedValue(null);
        await expect(service.clearGuestCart(validGuestId)).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('mergeGuestCart', () => {
    const validGuestId = '12345678-1234-4abc-8abc-123456789012';
    const userId = 'user-1';

    it('merges guest cart items into user cart', async () => {
      const guestCart = {
        id: 'g-cart',
        guestSessionId: validGuestId,
        items: [{ productId: 'product-1', quantity: 2, variationOptions: {} }],
      };
      mockPrisma.cart.findUnique.mockResolvedValueOnce(guestCart);
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);
      // addItem calls
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'user-cart', userId, items: [] }) // tx lookup
        .mockResolvedValueOnce(mockCart); // recalculate
      mockPrisma.cartItem.create.mockResolvedValue(mockCartItem);
      mockPrisma.cart.update.mockResolvedValue(mockCart);
      mockPrisma.cart.delete.mockResolvedValue({});
      // getCart at end
      mockPrisma.cart.findUnique.mockResolvedValue(mockCart);

      const result = await service.mergeGuestCart(validGuestId, userId);
      expect(result).toHaveProperty('items');
    });

    it('returns user cart when guest cart is empty', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'g-cart', guestSessionId: validGuestId, items: [] })
        .mockResolvedValueOnce(mockCart); // getCart
      mockPrisma.cart.delete.mockResolvedValue({});

      const result = await service.mergeGuestCart(validGuestId, userId);
      expect(result).toHaveProperty('items');
    });

    it('returns user cart when guest cart does not exist', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce(null) // guest cart lookup
        .mockResolvedValueOnce(mockCart); // getCart

      const result = await service.mergeGuestCart(validGuestId, userId);
      expect(result).toHaveProperty('items');
    });
  });

  describe('recalculateCart', () => {
    it('throws NotFoundException when cart not found', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);
      await expect(service.recalculateCart('missing-cart')).rejects.toThrow(NotFoundException);
    });

    it('removes inactive product items during recalculation', async () => {
      const inactiveItem = {
        ...mockCartItem,
        product: { ...mockProduct, status: 'INACTIVE' },
      };
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        ...mockCart,
        items: [inactiveItem],
      });
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
      // After removing items, cart refetch for update
      mockPrisma.cart.update.mockResolvedValue(emptyCart);

      const result = await service.recalculateCart('cart-1');
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [inactiveItem.id] } },
      });
      expect(result.items).toHaveLength(0);
    });

    it('removes items with deleted product (null)', async () => {
      const nullProductItem = {
        ...mockCartItem,
        product: null,
      };
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        ...mockCart,
        items: [nullProductItem],
      });
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.cart.update.mockResolvedValue(emptyCart);

      const result = await service.recalculateCart('cart-1');
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalled();
      expect(result.items).toHaveLength(0);
    });

    it('consolidates duplicate items', async () => {
      const dup1 = { ...mockCartItem, id: 'dup-1', quantity: 2, variationOptions: {} };
      const dup2 = { ...mockCartItem, id: 'dup-2', quantity: 3, variationOptions: {} };
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        ...mockCart,
        items: [dup1, dup2],
      });
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.cartItem.update.mockResolvedValue({});
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      await service.recalculateCart('cart-1');
      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['dup-2'] } },
      });
    });

    it('updates item price when product price changed', async () => {
      const outdatedItem = {
        ...mockCartItem,
        price: new Decimal(19.99), // Old price
        product: { ...mockProduct, price: new Decimal(29.99) }, // New price
      };
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        ...mockCart,
        items: [outdatedItem],
      });
      mockPrisma.cartItem.update.mockResolvedValue({});
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      await service.recalculateCart('cart-1');
      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: outdatedItem.id },
          data: { price: new Decimal(29.99) },
        }),
      );
    });

    it('applies promotions when user has items', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockCart);
      mockPromotionsService.applyPromotionsToCart.mockResolvedValue({
        discount: 10,
        freeShipping: true,
      });
      mockPrisma.cart.update.mockResolvedValue({
        ...mockCart,
        discount: new Decimal(10),
        promotionFreeShipping: true,
      });

      const result = await service.recalculateCart('cart-1', { userMutated: true });
      expect(mockPromotionsService.applyPromotionsToCart).toHaveBeenCalled();
      expect(result.promotionFreeShipping).toBe(true);
    });

    it('waives shipping when a FREE_SHIPPING loyalty reward is pending', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        ...mockCart,
        pendingLoyaltyPoints: 200,
        pendingLoyaltyOptionId: 'option-free-shipping',
      });
      mockLoyaltyService.isFreeShippingOption.mockResolvedValue(true);
      mockPrisma.cart.update.mockResolvedValue({ ...mockCart, promotionFreeShipping: true });

      const result = await service.recalculateCart('cart-1');

      expect(mockLoyaltyService.isFreeShippingOption).toHaveBeenCalledWith('option-free-shipping');
      expect(mockPrisma.cart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ promotionFreeShipping: true }),
        }),
      );
      expect(result.promotionFreeShipping).toBe(true);
    });

    it('leaves shipping payable for a loyalty reward that is not free shipping', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        ...mockCart,
        pendingLoyaltyPoints: 500,
        pendingLoyaltyOptionId: 'option-discount',
      });
      mockLoyaltyService.isFreeShippingOption.mockResolvedValue(false);
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      await service.recalculateCart('cart-1');

      expect(mockPrisma.cart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ promotionFreeShipping: false }),
        }),
      );
    });

    it('caps discount to not exceed subtotal + tax + shipping', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockCart);
      mockPromotionsService.applyPromotionsToCart.mockResolvedValue({
        discount: 9999,
        freeShipping: false,
      });
      mockPrisma.cart.update.mockResolvedValue({
        ...mockCart,
        total: new Decimal(0),
        discount: new Decimal(65.98),
      });

      const result = await service.recalculateCart('cart-1');
      expect(result.total).toBe(0);
    });

    it('uses TaxService when product has taxClassId and user has address', async () => {
      const itemWithTaxClass = {
        ...mockCartItem,
        product: { ...mockProduct, taxClassId: 'tc-1', taxClass: { id: 'tc-1', name: 'Standard' } },
      };
      const cartWithTax = { ...mockCart, items: [itemWithTaxClass] };
      mockPrisma.cart.findUnique.mockResolvedValueOnce(cartWithTax);
      mockPrisma.address.findFirst.mockResolvedValue({
        country: 'US',
        state: 'CA',
        city: 'LA',
        postalCode: '90001',
      });
      mockTaxService.calculateTax.mockResolvedValue({ tax: 5.99, rate: 0.1 });
      mockPrisma.cart.update.mockResolvedValue(cartWithTax);

      await service.recalculateCart('cart-1');
      expect(mockTaxService.calculateTax).toHaveBeenCalled();
    });

    it('falls back to product taxRate when TaxService throws', async () => {
      const itemWithTaxClass = {
        ...mockCartItem,
        product: { ...mockProduct, taxClassId: 'tc-1', taxRate: new Decimal(0.08) },
      };
      const cartWithTax = { ...mockCart, items: [itemWithTaxClass] };
      mockPrisma.cart.findUnique.mockResolvedValueOnce(cartWithTax);
      mockPrisma.address.findFirst.mockResolvedValue({ country: 'US' });
      mockTaxService.calculateTax.mockRejectedValue(new Error('Tax service error'));
      mockPrisma.cart.update.mockResolvedValue(cartWithTax);

      await service.recalculateCart('cart-1');
      // Should not throw, falls back to product.taxRate
      expect(mockPrisma.cart.update).toHaveBeenCalled();
    });

    it('resets abandonedEmailSentAt when userMutated', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce(mockCart);
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      await service.recalculateCart('cart-1', { userMutated: true });
      expect(mockPrisma.cart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ abandonedEmailSentAt: null }),
        }),
      );
    });
  });

  describe('applyLoyaltyReward', () => {
    const userId = 'user-1';

    it('applies loyalty reward to cart', async () => {
      mockLoyaltyService.validateCartRedemption.mockResolvedValue({
        points: 500,
        discount: 5,
      });
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId }) // lookup
        .mockResolvedValueOnce(mockCart); // recalculate
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      const result = await service.applyLoyaltyReward(userId, 'option-1');
      expect(mockPrisma.cart.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pendingLoyaltyPoints: 500,
            pendingLoyaltyOptionId: 'option-1',
            loyaltyDiscountAmount: 5,
          }),
        }),
      );
      expect(result).toHaveProperty('items');
    });

    it('throws NotFoundException when cart not found', async () => {
      mockLoyaltyService.validateCartRedemption.mockResolvedValue({
        points: 500,
        discount: 5,
      });
      mockPrisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.applyLoyaltyReward(userId, 'option-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeLoyaltyReward', () => {
    const userId = 'user-1';

    it('removes loyalty reward from cart', async () => {
      mockPrisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'cart-1', userId })
        .mockResolvedValueOnce(mockCart);
      mockPrisma.cart.update.mockResolvedValue(mockCart);

      const result = await service.removeLoyaltyReward(userId);
      expect(mockLoyaltyService.clearCartLoyaltyState).toHaveBeenCalledWith('cart-1');
      expect(result).toHaveProperty('items');
    });

    it('throws NotFoundException when cart not found', async () => {
      mockPrisma.cart.findUnique.mockResolvedValue(null);

      await expect(service.removeLoyaltyReward(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
