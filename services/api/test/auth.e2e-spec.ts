import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NoOpThrottlerGuard, makeRegPayload, extractToken } from './helpers';

function makeCustomerPayload(overrides: Record<string, any> = {}) {
  return makeRegPayload('customer', { firstName: 'Test', lastName: 'User', ...overrides });
}

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let accessToken: string;
  let userId: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new customer user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(makeCustomerPayload())
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('user');
          expect(res.body.data.user.email).toBeDefined();
          userId = res.body.data.user.id;
          const token = extractToken(res);
          if (token) accessToken = token;
        });
    });

    it('should reject duplicate email', async () => {
      const email = `duplicate-${Date.now()}@example.com`;

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(makeCustomerPayload({ email }))
        .expect(201);

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(makeCustomerPayload({ email }))
        .expect(409);
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'invalid-email' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const testEmail = `login-test-${Date.now()}@example.com`;
    const testPassword = 'Test123!@$';

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(makeCustomerPayload({ email: testEmail, password: testPassword }));
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('user');
          const token = extractToken(res);
          if (token) accessToken = token;
        });
    });

    it('should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'wrong-password' })
        .expect(401);
    });

    it('should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password' })
        .expect(401);
    });
  });

  describe('GET /api/users/profile (Protected)', () => {
    it('should access profile with valid token', async () => {
      const regPayload = makeCustomerPayload();
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(regPayload);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: regPayload.email, password: regPayload.password });

      const token = extractToken(loginResponse);
      expect(token).toBeDefined();

      return request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('email');
        });
    });

    it('should reject request without token', () => {
      return request(app.getHttpServer())
        .get('/api/users/profile')
        .expect(401);
    });

    it('should reject request with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});


