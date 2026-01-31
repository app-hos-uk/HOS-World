import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { CartService } from '../cart/cart.service';
import { OrdersService } from '../orders/orders.service';
import { CartModule } from '../cart/cart.module';
import { OrdersModule } from '../orders/orders.module';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from '../auth/auth.service';
import { AuthModule } from '../auth/auth.module';
import { RegisterRole, CommunicationMethod } from '../auth/dto/register.dto';
import { ProductsService } from '../products/products.service';
import { ProductsModule } from '../products/products.module';

function isDbConnectionError(e: any): boolean {
  const msg = e?.message ?? '';
  return (
    msg.includes('denied access') ||
    msg.includes('connect') ||
    msg.includes('DATABASE_URL') ||
    msg.includes('reach') ||
    msg.includes('5432') ||
    e?.code === 'P1001'
  );
}

describe('Cart and Orders Integration Tests', () => {
  let cartService: CartService;
  let ordersService: OrdersService;
  let productsService: ProductsService;
  let prismaService: PrismaService;
  let authService: AuthService;
  let customerUserId: string;
  let sellerUserId: string;
  let productId: string;
  let addressId: string;

  beforeAll(async () => {
    if (process.env.SKIP_INTEGRATION_TESTS === 'true') {
      return;
    }

    let moduleFixture: TestingModule;
    try {
      moduleFixture = await Test.createTestingModule({
        imports: [DatabaseModule, AuthModule, ProductsModule, CartModule, OrdersModule],
      }).compile();
    } catch (error: any) {
      if (isDbConnectionError(error)) {
        console.warn('⚠️ Skipping integration tests: Database not available');
        return;
      }
      throw error;
    }

    cartService = moduleFixture.get<CartService>(CartService);
    ordersService = moduleFixture.get<OrdersService>(OrdersService);
    productsService = moduleFixture.get<ProductsService>(ProductsService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    if (!authService || !prismaService) {
      console.warn('⚠️ Skipping integration tests: Services not available');
      return;
    }

    try {
      await prismaService.$connect();
    } catch (error: any) {
      if (isDbConnectionError(error)) {
        console.warn('⚠️ Skipping integration tests: Database not available');
        cartService = undefined as any;
        ordersService = undefined as any;
        productsService = undefined as any;
        prismaService = undefined as any;
        authService = undefined as any;
        return;
      }
      throw error;
    }

    try {
      const sellerResult = await authService.register({
        email: `seller-${Date.now()}@example.com`,
        password: 'Test123!@#',
        firstName: 'Seller',
        lastName: 'Test',
        role: RegisterRole.SELLER,
        storeName: `Store ${Date.now()}`,
        country: 'GB',
        preferredCommunicationMethod: CommunicationMethod.EMAIL,
        gdprConsent: true,
      });
      sellerUserId = sellerResult.user.id;

      const product = await productsService.create(sellerUserId, {
        name: 'Cart Test Product',
        description: 'For cart testing',
        price: 49.99,
        stock: 100,
        currency: 'USD',
        status: 'ACTIVE',
      });
      productId = product.id;

      const customerResult = await authService.register({
        email: `customer-${Date.now()}@example.com`,
        password: 'Test123!@#',
        firstName: 'Customer',
        lastName: 'Test',
        role: RegisterRole.CUSTOMER,
        country: 'GB',
        preferredCommunicationMethod: CommunicationMethod.EMAIL,
        gdprConsent: true,
      });
      customerUserId = customerResult.user.id;

      const address = await prismaService.address.create({
        data: {
          userId: customerUserId,
          firstName: 'Test',
          lastName: 'User',
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          country: 'USA',
          isDefault: true,
        },
      });
      addressId = address.id;
    } catch (error: any) {
      if (isDbConnectionError(error)) {
        console.warn('⚠️ Skipping integration tests: Database operation failed');
        cartService = undefined as any;
        ordersService = undefined as any;
        productsService = undefined as any;
        prismaService = undefined as any;
        authService = undefined as any;
        return;
      }
      throw error;
    }
  });

  afterAll(async () => {
    if (!prismaService || (!customerUserId && !sellerUserId)) return;
    await prismaService.order
      .deleteMany({
        where: { userId: customerUserId },
      })
      .catch(() => {});
    await prismaService.cartItem
      .deleteMany({
        where: { cart: { userId: customerUserId } },
      })
      .catch(() => {});
    await prismaService.cart
      .deleteMany({
        where: { userId: customerUserId },
      })
      .catch(() => {});
    await prismaService.address
      .deleteMany({
        where: { userId: customerUserId },
      })
      .catch(() => {});
    if (productId) {
      await prismaService.product
        .deleteMany({
          where: { id: productId },
        })
        .catch(() => {});
    }
    await prismaService.seller
      .deleteMany({
        where: { userId: sellerUserId },
      })
      .catch(() => {});
    await prismaService.user
      .deleteMany({
        where: { id: { in: [customerUserId, sellerUserId].filter(Boolean) } },
      })
      .catch(() => {});
    await prismaService.$disconnect().catch(() => {});
  });

  describe('Cart Operations', () => {
    it('should add item to cart', async () => {
      if (!cartService || !customerUserId || !productId) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      const cart = await cartService.addItem(customerUserId, {
        productId,
        quantity: 2,
      });

      expect(cart.items).toBeDefined();
      expect(cart.items.length).toBeGreaterThan(0);
      expect(cart.items[0].productId).toBe(productId);
    });

    it('should get cart with items', async () => {
      if (!cartService || !customerUserId) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      const cart = await cartService.getCart(customerUserId);
      expect(cart.items.length).toBeGreaterThan(0);
    });
  });

  describe('Order Creation from Cart', () => {
    it('should create order from cart', async () => {
      if (!ordersService || !cartService || !customerUserId || !addressId) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      const order = await ordersService.create(customerUserId, {
        shippingAddressId: addressId,
        billingAddressId: addressId,
      });

      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('orderNumber');
      expect(order.items.length).toBeGreaterThan(0);
      expect(order.status?.toUpperCase()).toBe('PENDING');
    });

    it('should clear cart after order creation', async () => {
      if (!cartService || !customerUserId) {
        console.warn('⚠️ Skipping test: Services not initialized');
        return;
      }
      const cart = await cartService.getCart(customerUserId);
      expect(cart.items.length).toBe(0);
    });
  });
});
