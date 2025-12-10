import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Products E2E Tests', () => {
  let app: INestApplication;
  let sellerToken: string;
  let customerToken: string;
  let productId: string;
  let sellerId: string;

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

    // Create seller account
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
        country: 'United Kingdom',
        preferredCommunicationMethod: 'EMAIL',
        gdprConsent: true,
      });

    sellerToken = sellerResponse.body.data.token;
    sellerId = sellerResponse.body.data.user.id;

    // Create customer account
    const customerEmail = `customer-${Date.now()}@example.com`;
    const customerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: customerEmail,
        password: 'Test123!@#',
        firstName: 'Customer',
        lastName: 'Test',
        role: 'customer',
        country: 'United Kingdom',
        preferredCommunicationMethod: 'EMAIL',
        gdprConsent: true,
      });

    customerToken = customerResponse.body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/products (Seller only)', () => {
    it('should create a product as seller', () => {
      return request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Test Product',
          description: 'This is a test product',
          price: 99.99,
          stock: 100,
          currency: 'USD',
          status: 'ACTIVE',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('id');
          expect(res.body.data.name).toBe('Test Product');
          productId = res.body.data.id;
        });
    });

    it('should reject product creation from customer', () => {
      return request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Test Product',
          description: 'This is a test product',
          price: 99.99,
          stock: 100,
        })
        .expect(403);
    });

    it('should reject product creation without authentication', () => {
      return request(app.getHttpServer())
        .post('/api/products')
        .send({
          name: 'Test Product',
          price: 99.99,
        })
        .expect(401);
    });
  });

  describe('GET /api/products (Public)', () => {
    it('should list products without authentication', () => {
      return request(app.getHttpServer())
        .get('/api/products')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(Array.isArray(res.body.data.items)).toBe(true);
        });
    });

    it('should get product by id', () => {
      return request(app.getHttpServer())
        .get(`/api/products/${productId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data.id).toBe(productId);
        });
    });

    it('should return 404 for non-existent product', () => {
      return request(app.getHttpServer())
        .get('/api/products/non-existent-id')
        .expect(404);
    });
  });

  describe('PUT /api/products/:id (Seller only)', () => {
    it('should update product as seller', () => {
      return request(app.getHttpServer())
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Updated Product Name',
          price: 149.99,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.name).toBe('Updated Product Name');
          expect(Number(res.body.data.price)).toBe(149.99);
        });
    });

    it('should reject update from customer', () => {
      return request(app.getHttpServer())
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Hacked Product',
        })
        .expect(403);
    });
  });

  describe('DELETE /api/products/:id (Seller only)', () => {
    let productToDelete: string;

    beforeAll(async () => {
      // Create a product to delete
      const response = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Product To Delete',
          description: 'This will be deleted',
          price: 50,
          stock: 10,
          currency: 'USD',
          status: 'ACTIVE',
        });
      productToDelete = response.body.data.id;
    });

    it('should delete product as seller', () => {
      return request(app.getHttpServer())
        .delete(`/api/products/${productToDelete}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);
    });

    it('should reject delete from customer', () => {
      return request(app.getHttpServer())
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });
});


