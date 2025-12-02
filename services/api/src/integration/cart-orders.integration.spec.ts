import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { CartService } from '../cart/cart.service';
import { OrdersService } from '../orders/orders.service';
import { CartModule } from '../cart/cart.module';
import { OrdersModule } from '../orders/orders.module';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from '../auth/auth.service';
import { AuthModule } from '../auth/auth.module';
import { ProductsService } from '../products/products.service';
import { ProductsModule } from '../products/products.module';

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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        DatabaseModule,
        AuthModule,
        ProductsModule,
        CartModule,
        OrdersModule,
      ],
    }).compile();

    cartService = moduleFixture.get<CartService>(CartService);
    ordersService = moduleFixture.get<OrdersService>(OrdersService);
    productsService = moduleFixture.get<ProductsService>(ProductsService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    // Create seller and product
    const sellerResult = await authService.register({
      email: `seller-${Date.now()}@example.com`,
      password: 'Test123!@#',
      firstName: 'Seller',
      lastName: 'Test',
      role: 'seller',
      storeName: `Store ${Date.now()}`,
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

    // Create customer
    const customerResult = await authService.register({
      email: `customer-${Date.now()}@example.com`,
      password: 'Test123!@#',
      firstName: 'Customer',
      lastName: 'Test',
      role: 'customer',
    });
    customerUserId = customerResult.user.id;

    // Create address
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
  });

  afterAll(async () => {
    // Cleanup
    await prismaService.order.deleteMany({
      where: { userId: customerUserId },
    }).catch(() => {});
    await prismaService.cartItem.deleteMany({
      where: { cart: { userId: customerUserId } },
    }).catch(() => {});
    await prismaService.cart.deleteMany({
      where: { userId: customerUserId },
    }).catch(() => {});
    await prismaService.address.deleteMany({
      where: { userId: customerUserId },
    }).catch(() => {});
    await prismaService.product.deleteMany({
      where: { id: productId },
    }).catch(() => {});
    await prismaService.seller.deleteMany({
      where: { userId: sellerUserId },
    }).catch(() => {});
    await prismaService.user.deleteMany({
      where: { id: { in: [customerUserId, sellerUserId] } },
    }).catch(() => {});
    await prismaService.$disconnect();
  });

  describe('Cart Operations', () => {
    it('should add item to cart', async () => {
      const cart = await cartService.addItem(customerUserId, {
        productId,
        quantity: 2,
      });

      expect(cart.items).toBeDefined();
      expect(cart.items.length).toBeGreaterThan(0);
      expect(cart.items[0].productId).toBe(productId);
    });

    it('should get cart with items', async () => {
      const cart = await cartService.getCart(customerUserId);
      expect(cart.items.length).toBeGreaterThan(0);
    });
  });

  describe('Order Creation from Cart', () => {
    it('should create order from cart', async () => {
      const order = await ordersService.create(customerUserId, {
        shippingAddressId: addressId,
        billingAddressId: addressId,
      });

      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('orderNumber');
      expect(order.items.length).toBeGreaterThan(0);
      expect(order.status).toBe('PENDING');
    });

    it('should clear cart after order creation', async () => {
      const cart = await cartService.getCart(customerUserId);
      expect(cart.items.length).toBe(0);
    });
  });
});


