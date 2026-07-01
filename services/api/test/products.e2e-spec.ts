import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NoOpThrottlerGuard, makeRegPayload, extractToken, seedAdmin } from './helpers';

describe('Products E2E Tests', () => {
  let app: INestApplication;
  let adminToken: string;
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

    // Catalog products are created by ADMIN/CATALOG, not sellers.
    adminToken = await seedAdmin(app);

    const customerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(makeRegPayload('customer'));
    customerToken = extractToken(customerResponse);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/products (Admin/Catalog only)', () => {
    it('should create a product as admin', () => {
      expect(adminToken).toBeDefined();
      return request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
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
      expect(customerToken).toBeDefined();
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
        .send({ name: 'Test Product', price: 99.99 })
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
        });
    });

    it('should get product by id', () => {
      expect(productId).toBeDefined();
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
        .get('/api/products/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PUT /api/products/:id (Admin/Catalog)', () => {
    it('should update product as admin', () => {
      expect(adminToken).toBeDefined();
      expect(productId).toBeDefined();
      return request(app.getHttpServer())
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Product Name', price: 149.99 })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.name).toBe('Updated Product Name');
        });
    });

    it('should reject update from customer', () => {
      expect(customerToken).toBeDefined();
      expect(productId).toBeDefined();
      return request(app.getHttpServer())
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Hacked Product' })
        .expect(403);
    });
  });

  describe('DELETE /api/products/:id (Admin/Catalog)', () => {
    let productToDelete: string;

    beforeAll(async () => {
      expect(adminToken).toBeDefined();
      const response = await request(app.getHttpServer())
        .post('/api/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Product To Delete',
          description: 'This will be deleted',
          price: 50,
          stock: 10,
          currency: 'USD',
          status: 'ACTIVE',
        });
      productToDelete = response.body.data?.id;
      expect(productToDelete).toBeDefined();
    });

    it('should delete product as admin', () => {
      return request(app.getHttpServer())
        .delete(`/api/products/${productToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject delete from customer', () => {
      expect(customerToken).toBeDefined();
      expect(productId).toBeDefined();
      return request(app.getHttpServer())
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });
});
