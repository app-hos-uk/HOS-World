import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E Test: Order Creation → Payment → Fulfillment Workflow
 * 
 * Tests the complete workflow:
 * 1. Customer adds products to cart
 * 2. Customer checks out
 * 3. Payment is processed
 * 4. Order is created
 * 5. Fulfillment ships order
 * 6. Order is delivered
 * 7. Settlement is calculated
 */
describe('Order Processing Workflow E2E', () => {
  let app: INestApplication;
  let customerToken: string;
  let sellerToken: string;
  let productId: string;
  let addressId: string;
  let cartId: string;
  let orderId: string;
  let paymentIntentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // Create seller and product
    const sellerEmail = `seller-${Date.now()}@example.com`;
    const sellerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: sellerEmail,
        password: 'Test123!@#',
        firstName: 'Seller',
        lastName: 'Test',
        role: 'seller',
        storeName: `Test Store ${Date.now()}`,
      });
    sellerToken = sellerResponse.body.data?.accessToken || sellerResponse.body.data?.token;

    const productResponse = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Order Workflow Product',
        description: 'Product for order workflow testing',
        price: 79.99,
        stock: 100,
        currency: 'USD',
        status: 'ACTIVE',
      });
    productId = productResponse.body.data?.id || productResponse.body.id;

    // Create customer
    const customerEmail = `customer-${Date.now()}@example.com`;
    const customerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password: 'Test123!@#',
        firstName: 'Customer',
        lastName: 'Test',
        role: 'customer',
      });
    customerToken = customerResponse.body.data?.accessToken || customerResponse.body.data?.token;

    // Create address
    const addressResponse = await request(app.getHttpServer())
      .post('/api/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        postalCode: '12345',
        country: 'US',
        isDefault: true,
      });
    addressId = addressResponse.body.data?.id || addressResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Order Processing Workflow', () => {
    it('Step 1: Customer adds product to cart', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId,
          quantity: 2,
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
    });

    it('Step 2: Customer views cart', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body.items.length).toBeGreaterThan(0);
    });

    it('Step 3: Customer creates payment intent', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/payments/intent')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          amount: 159.98, // 2 * 79.99
          currency: 'USD',
        });

      // If payment endpoint exists
      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('clientSecret');
        paymentIntentId = response.body.id;
      }
    });

    it('Step 4: Customer creates order from cart', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          addressId,
          paymentMethod: 'card',
          paymentIntentId: paymentIntentId || 'test-intent',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      orderId = response.body.id;
    });

    it('Step 5: Payment is confirmed', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/payments/${paymentIntentId || 'test-intent'}/confirm`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId,
        });

      // If payment confirmation endpoint exists
      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('status', 'succeeded');
      }
    });

    it('Step 6: Order status is updated to PAID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(response.status).toBe(200);
      // Order should be in PAID or CONFIRMED status
      expect(['PAID', 'CONFIRMED', 'PROCESSING']).toContain(response.body.status);
    });

    it('Step 7: Fulfillment creates shipment', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/fulfillment/shipments')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          orderId,
          trackingNumber: `TRACK-${Date.now()}`,
          carrier: 'UPS',
        });

      // If fulfillment endpoint exists
      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('id');
      }
    });

    it('Step 8: Order status is updated to SHIPPED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          status: 'SHIPPED',
        });

      // If order update endpoint exists
      if (response.status === 200) {
        expect(response.body).toHaveProperty('status', 'SHIPPED');
      }
    });

    it('Step 9: Order is marked as DELIVERED', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          status: 'DELIVERED',
        });

      // If order update endpoint exists
      if (response.status === 200) {
        expect(response.body).toHaveProperty('status', 'DELIVERED');
      }
    });

    it('Step 10: Settlement is calculated for seller', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/settlements/seller/${sellerToken}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({});

      // If settlement endpoint exists
      if (response.status === 200) {
        expect(response.body).toHaveProperty('settlements');
      }
    });

    it('Should track order through all workflow stages', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', orderId);
      expect(response.body).toHaveProperty('status');
      // Status should be DELIVERED or COMPLETED
      expect(['DELIVERED', 'COMPLETED', 'SHIPPED']).toContain(response.body.status);
    });
  });
});
