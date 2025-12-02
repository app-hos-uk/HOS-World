import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Orders E2E Tests', () => {
  let app: INestApplication;
  let customerToken: string;
  let sellerToken: string;
  let productId: string;
  let addressId: string;
  let orderId: string;

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

    sellerToken = sellerResponse.body.data.token;

    const productResponse = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        name: 'Order Test Product',
        description: 'Product for order testing',
        price: 79.99,
        stock: 50,
        currency: 'USD',
        status: 'ACTIVE',
      });

    productId = productResponse.body.data.id;

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

    customerToken = customerResponse.body.data.token;

    // Create address
    const addressResponse = await request(app.getHttpServer())
      .post('/api/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        firstName: 'Test',
        lastName: 'User',
        street: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        country: 'USA',
        phone: '+1234567890',
        isDefault: true,
      });

    addressId = addressResponse.body.data.id;

    // Add product to cart
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId,
        quantity: 2,
      });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/orders', () => {
    it('should create order from cart', () => {
      return request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddressId: addressId,
          billingAddressId: addressId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data).toHaveProperty('orderNumber');
          expect(res.body.data).toHaveProperty('items');
          expect(res.body.data.items.length).toBeGreaterThan(0);
          orderId = res.body.data.id;
        });
    });

    it('should reject order creation without items in cart', async () => {
      // Clear cart first
      await request(app.getHttpServer())
        .delete('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`);

      return request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddressId: addressId,
          billingAddressId: addressId,
        })
        .expect(400);
    });

    it('should reject order without valid address', () => {
      return request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shippingAddressId: 'invalid-address-id',
          billingAddressId: addressId,
        })
        .expect(404);
    });
  });

  describe('GET /api/orders', () => {
    it('should list orders for customer', () => {
      return request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should reject request without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/orders')
        .expect(401);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('should get order by id', () => {
      return request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(orderId);
        });
    });

    it('should reject access to other user order', async () => {
      // Create another customer
      const anotherCustomerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `another-${Date.now()}@example.com`,
          password: 'Test123!@#',
          firstName: 'Another',
          lastName: 'Customer',
          role: 'customer',
        });

      const anotherToken = anotherCustomerResponse.body.data.token;

      return request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/orders/:id/status (Seller only)', () => {
    it('should update order status as seller', () => {
      return request(app.getHttpServer())
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          status: 'CONFIRMED',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('CONFIRMED');
        });
    });

    it('should reject status update from customer', () => {
      return request(app.getHttpServer())
        .put(`/api/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          status: 'SHIPPED',
        })
        .expect(403);
    });
  });
});


