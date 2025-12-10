import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { ProductsService } from '../products/products.service';
import { ProductsModule } from '../products/products.module';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from '../auth/auth.service';
import { AuthModule } from '../auth/auth.module';

describe('Products Integration Tests', () => {
  let productsService: ProductsService;
  let prismaService: PrismaService;
  let authService: AuthService;
  let sellerUserId: string;
  let sellerId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, AuthModule, ProductsModule],
    }).compile();

    productsService = moduleFixture.get<ProductsService>(ProductsService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    // Create a seller
    const sellerResult = await authService.register({
      email: `seller-integration-${Date.now()}@example.com`,
      password: 'Test123!@#',
      firstName: 'Seller',
      lastName: 'Integration',
      role: 'seller',
      storeName: `Test Store ${Date.now()}`,
      country: 'United Kingdom',
      preferredCommunicationMethod: 'EMAIL',
      gdprConsent: true,
    });

    sellerUserId = sellerResult.user.id;

    const seller = await prismaService.seller.findUnique({
      where: { userId: sellerUserId },
    });
    sellerId = seller?.id || '';
  });

  afterAll(async () => {
    // Cleanup
    if (productId) {
      await prismaService.product.delete({
        where: { id: productId },
      }).catch(() => {});
    }
    if (sellerId) {
      await prismaService.seller.delete({
        where: { id: sellerId },
      }).catch(() => {});
    }
    if (sellerUserId) {
      await prismaService.user.delete({
        where: { id: sellerUserId },
      }).catch(() => {});
    }
    await prismaService.$disconnect();
  });

  describe('Product CRUD Operations', () => {
    it('should create a product', async () => {
      const product = await productsService.create(sellerUserId, {
        name: 'Integration Test Product',
        description: 'Product created in integration test',
        price: 99.99,
        stock: 100,
        currency: 'USD',
        status: 'ACTIVE',
      });

      expect(product).toHaveProperty('id');
      expect(product.name).toBe('Integration Test Product');
      expect(Number(product.price)).toBe(99.99);
      productId = product.id;

      // Verify in database
      const dbProduct = await prismaService.product.findUnique({
        where: { id: product.id },
      });
      expect(dbProduct).toBeDefined();
      expect(dbProduct?.name).toBe('Integration Test Product');
    });

    it('should read product by id', async () => {
      const product = await productsService.findOne(productId);
      expect(product.id).toBe(productId);
      expect(product.name).toBe('Integration Test Product');
    });

    it('should update product', async () => {
      const updated = await productsService.update(sellerUserId, productId, {
        name: 'Updated Integration Product',
        price: 149.99,
      });

      expect(updated.name).toBe('Updated Integration Product');
      expect(Number(updated.price)).toBe(149.99);

      // Verify in database
      const dbProduct = await prismaService.product.findUnique({
        where: { id: productId },
      });
      expect(dbProduct?.name).toBe('Updated Integration Product');
    });

    it('should delete product', async () => {
      await productsService.delete(sellerUserId, productId);

      // Verify deleted
      const dbProduct = await prismaService.product.findUnique({
        where: { id: productId },
      });
      expect(dbProduct).toBeNull();

      productId = ''; // Reset for cleanup
    });
  });
});


