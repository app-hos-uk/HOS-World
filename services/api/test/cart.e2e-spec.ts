import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Cart E2E Tests', () => {
  let app: INestApplication;
  let customerToken: string;
  let sellerToken: string;
  let productId: string;
  let userId: string;

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
        name: 'Cart Test Product',
        description: 'Product for cart testing',
        price: 49.99,
        stock: 100,
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
    userId = customerResponse.body.data.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/cart', () => {
    it('should get empty cart for new user', () => {
      return request(app.getHttpServer())
        .get('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('items');
          expect(Array.isArray(res.body.data.items)).toBe(true);
        });
    });

    it('should reject request without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/cart')
        .expect(401);
    });
  });

  describe('POST /api/cart/items', () => {
    it('should add item to cart', () => {
      return request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId,
          quantity: 2,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('items');
          expect(res.body.data.items.length).toBeGreaterThan(0);
        });
    });

    it('should reject adding non-existent product', () => {
      return request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId: 'non-existent-id',
          quantity: 1,
        })
        .expect(404);
    });

    it('should reject invalid quantity', () => {
      return request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId,
          quantity: -1,
        })
        .expect(400);
    });
  });

  describe('PUT /api/cart/items/:id', () => {
    let cartItemId: string;

    beforeAll(async () => {
      // Add item to cart first
      const cartResponse = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId,
          quantity: 1,
        });
      cartItemId = cartResponse.body.data.items[0].id;
    });

    it('should update cart item quantity', () => {
      return request(app.getHttpServer())
        .put(`/api/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          quantity: 5,
        })
        .expect(200)
        .expect((res) => {
          const item = res.body.data.items.find((i: any) => i.id === cartItemId);
          expect(item.quantity).toBe(5);
        });
    });
  });

  describe('DELETE /api/cart/items/:id', () => {
    let cartItemId: string;

    beforeAll(async () => {
      // Add item to cart
      const cartResponse = await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId,
          quantity: 1,
        });
      cartItemId = cartResponse.body.data.items[0].id;
    });

    it('should remove item from cart', () => {
      return request(app.getHttpServer())
        .delete(`/api/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);
    });
  });

  describe('DELETE /api/cart', () => {
    beforeAll(async () => {
      // Add items to cart first
      await request(app.getHttpServer())
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          productId,
          quantity: 2,
        });
    });

    it('should clear entire cart', () => {
      return request(app.getHttpServer())
        .delete('/api/cart')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200)
        .expect(async () => {
          const cartResponse = await request(app.getHttpServer())
            .get('/api/cart')
            .set('Authorization', `Bearer ${customerToken}`);
          expect(cartResponse.body.data.items.length).toBe(0);
        });
    });
  });
});


