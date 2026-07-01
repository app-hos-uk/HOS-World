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
  createAddress,
} from './helpers';

describe('Orders E2E Tests', () => {
  let app: INestApplication;
  let customerToken: string;
  let adminToken: string;
  let productId: string;
  let addressId: string;
  let orderId: string;

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

    // Admin owns the catalog product (and therefore the resulting order as seller).
    adminToken = await seedAdmin(app);
    productId = await createProduct(app, adminToken, { name: 'Order Test Product', price: 79.99 });

    // Create customer + address + cart item
    const customerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(makeRegPayload('customer'));
    customerToken = extractToken(customerResponse);

    addressId = await createAddress(app, customerToken);

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 2 });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/orders', () => {
    it('should create order from cart', async () => {
      expect(customerToken).toBeDefined();
      expect(addressId).toBeDefined();
      const res = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shippingAddressId: addressId, billingAddressId: addressId });

      expect(res.status).toBe(201);
      const order = res.body?.data;
      if (!order?.id) {
        throw new Error(
          `Order creation did not return an id. Body: ${JSON.stringify(res.body)}`,
        );
      }
      orderId = order.id;
    });

    it('should reject order creation without items in cart', async () => {
      // Use a fresh customer: order creation is idempotent per (user, cart), so
      // reusing the primary customer would replay their existing order.
      const freshResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(makeRegPayload('customer'));
      const freshToken = extractToken(freshResponse);
      expect(freshToken).toBeDefined();
      const freshAddressId = await createAddress(app, freshToken);
      expect(freshAddressId).toBeDefined();

      const res = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ shippingAddressId: freshAddressId, billingAddressId: freshAddressId });

      expect([400, 422]).toContain(res.status);
    });

    it('should reject order without valid address', async () => {
      // Fresh customer with a cart item so the request reaches address validation
      // (an empty cart would short-circuit with a "cart empty" error instead).
      const freshResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(makeRegPayload('customer'));
      const freshToken = extractToken(freshResponse);
      expect(freshToken).toBeDefined();
      expect(productId).toBeDefined();

      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({ productId, quantity: 1 });

      const res = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${freshToken}`)
        .send({
          shippingAddressId: '00000000-0000-0000-0000-000000000000',
          billingAddressId: '00000000-0000-0000-0000-000000000000',
        });

      expect([400, 404, 422]).toContain(res.status);
    });
  });

  describe('GET /api/orders', () => {
    it('should list orders for customer', () => {
      expect(customerToken).toBeDefined();
      return request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
        });
    });

    it('should reject request without authentication', () => {
      return request(app.getHttpServer()).get('/api/orders').expect(401);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get order by id', () => {
      expect(customerToken).toBeDefined();
      expect(orderId).toBeDefined();
      return request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(orderId);
        });
    });

    it('should reject access to other user order', async () => {
      expect(orderId).toBeDefined();
      const anotherCustomerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(makeRegPayload('customer'));
      const anotherToken = extractToken(anotherCustomerResponse);
      expect(anotherToken).toBeDefined();

      return request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/orders/:id (Seller/Admin only)', () => {
    it('should update order status as admin (order owner)', () => {
      expect(adminToken).toBeDefined();
      expect(orderId).toBeDefined();
      return request(app.getHttpServer())
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status.toUpperCase()).toBe('CONFIRMED');
        });
    });

    it('should reject status update from customer', () => {
      expect(customerToken).toBeDefined();
      expect(orderId).toBeDefined();
      return request(app.getHttpServer())
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ status: 'SHIPPED' })
        .expect(403);
    });
  });
});
