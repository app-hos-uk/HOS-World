import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  NoOpThrottlerGuard,
  makeRegPayload,
  extractToken,
  seedAdmin,
  createProduct,
} from './helpers';

describe('Cart E2E Tests', () => {
  let app: INestApplication;
  let customerToken: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useClass(NoOpThrottlerGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Seed an admin to create a purchasable catalog product.
    const adminToken = await seedAdmin(app);
    productId = await createProduct(app, adminToken, { name: 'Cart Test Product', price: 49.99 });

    // Create customer
    const customerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(makeRegPayload('customer'));
    customerToken = extractToken(customerResponse);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/cart', () => {
    it('should get empty cart for new user', () => {
      expect(customerToken).toBeDefined();
      return request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
        });
    });

    it('should reject request without authentication', () => {
      return request(app.getHttpServer()).get('/api/cart').expect(401);
    });
  });

  describe('POST /api/cart/items', () => {
    it('should add item to cart', async () => {
      expect(customerToken).toBeDefined();
      expect(productId).toBeDefined();
      const res = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
    });

    it('should reject adding non-existent product', () => {
      expect(customerToken).toBeDefined();
      return request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 })
        .expect(404);
    });

    it('should reject invalid quantity', () => {
      expect(customerToken).toBeDefined();
      expect(productId).toBeDefined();
      return request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: -1 })
        .expect(400);
    });
  });

  describe('PATCH /api/cart/items/:id', () => {
    let cartItemId: string;

    beforeAll(async () => {
      expect(customerToken).toBeDefined();
      expect(productId).toBeDefined();
      const cartResponse = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1 });
      const items = cartResponse.body.data?.items || cartResponse.body.items || [];
      const firstItem = items[0];
      if (!firstItem) {
        throw new Error('Cart setup failed: adding a product returned no cart items');
      }
      cartItemId = firstItem.id;
    });

    it('should update cart item quantity', () => {
      return request(app.getHttpServer())
        .patch(`/api/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ quantity: 5 })
        .expect(200);
    });
  });

  describe('DELETE /api/cart/items/:id', () => {
    let cartItemId: string;

    beforeAll(async () => {
      expect(customerToken).toBeDefined();
      expect(productId).toBeDefined();
      const cartResponse = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 1 });
      const items = cartResponse.body.data?.items || cartResponse.body.items || [];
      const firstItem = items[0];
      if (!firstItem) {
        throw new Error('Cart setup failed: adding a product returned no cart items');
      }
      cartItemId = firstItem.id;
    });

    it('should remove item from cart', () => {
      return request(app.getHttpServer())
        .delete(`/api/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
    });
  });

  describe('DELETE /api/cart/clear', () => {
    beforeAll(async () => {
      expect(customerToken).toBeDefined();
      expect(productId).toBeDefined();
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 });
    });

    it('should clear entire cart', () => {
      expect(customerToken).toBeDefined();
      return request(app.getHttpServer())
        .delete('/api/cart/clear')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
    });
  });
});
