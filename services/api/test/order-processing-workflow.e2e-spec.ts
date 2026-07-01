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

/**
 * Order Creation -> Confirmation -> Fulfillment Workflow
 *
 * The admin seed owns the catalog product, so it acts as the seller/fulfiller
 * for the resulting order. Status is advanced along the real allowed
 * transitions: PENDING -> CONFIRMED -> PROCESSING -> FULFILLED -> SHIPPED.
 */
describe('Order Processing Workflow E2E', () => {
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

    adminToken = await seedAdmin(app);
    productId = await createProduct(app, adminToken, {
      name: 'Order Workflow Product',
      price: 79.99,
    });

    const customerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(makeRegPayload('customer'));
    customerToken = extractToken(customerResponse);

    addressId = await createAddress(app, customerToken);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Order Processing Workflow', () => {
    it('Step 1: Customer adds product to cart', async () => {
      expect(customerToken).toBeDefined();
      expect(productId).toBeDefined();
      const response = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId, quantity: 2 });

      expect(response.status).toBe(201);
    });

    it('Step 2: Customer views cart', async () => {
      expect(customerToken).toBeDefined();
      const response = await request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
    });

    it('Step 3: Customer creates order from cart', async () => {
      expect(customerToken).toBeDefined();
      expect(addressId).toBeDefined();
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ shippingAddressId: addressId, billingAddressId: addressId });

      expect(response.status).toBe(201);
      orderId = response.body.data?.id;
      expect(orderId).toBeDefined();
    });

    it('Step 4: Customer views order', async () => {
      expect(customerToken).toBeDefined();
      expect(orderId).toBeDefined();
      const response = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
    });

    it('Step 5: Admin confirms the order (PENDING -> CONFIRMED)', async () => {
      expect(adminToken).toBeDefined();
      expect(orderId).toBeDefined();
      const response = await request(app.getHttpServer())
        .put(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'CONFIRMED' });

      expect(response.status).toBe(200);
      expect(response.body.data.status.toUpperCase()).toBe('CONFIRMED');
    });

    it('Step 6: Admin advances order to SHIPPED (PROCESSING -> FULFILLED -> SHIPPED)', async () => {
      expect(adminToken).toBeDefined();
      expect(orderId).toBeDefined();

      for (const status of ['PROCESSING', 'FULFILLED', 'SHIPPED']) {
        const response = await request(app.getHttpServer())
          .put(`/api/orders/${orderId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status });

        expect(response.status).toBe(200);
        expect(response.body.data.status.toUpperCase()).toBe(status);
      }
    });

    it('Step 7: Final order status check', async () => {
      expect(customerToken).toBeDefined();
      expect(orderId).toBeDefined();
      const response = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('id', orderId);
      expect(response.body.data.status.toUpperCase()).toBe('SHIPPED');
    });
  });
});
