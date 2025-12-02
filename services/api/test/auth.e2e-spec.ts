import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication E2E Tests', () => {
  let app: INestApplication;
  let accessToken: string;
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new customer user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `test-${Date.now()}@example.com`,
          password: 'Test123!@#',
          firstName: 'Test',
          lastName: 'User',
          role: 'customer',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('user');
          expect(res.body.data).toHaveProperty('token');
          expect(res.body.data.user.email).toBeDefined();
          userId = res.body.data.user.id;
        });
    });

    it('should reject duplicate email', async () => {
      const email = `duplicate-${Date.now()}@example.com`;
      
      // First registration
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Test123!@#',
          firstName: 'Test',
          lastName: 'User',
          role: 'customer',
        })
        .expect(201);

      // Duplicate registration
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email,
          password: 'Test123!@#',
          firstName: 'Test',
          lastName: 'User',
          role: 'customer',
        })
        .expect(409);
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    const testEmail = `login-test-${Date.now()}@example.com`;
    const testPassword = 'Test123!@#';

    beforeAll(async () => {
      // Register a user first
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testEmail,
          password: testPassword,
          firstName: 'Login',
          lastName: 'Test',
          role: 'customer',
        });
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body.data).toHaveProperty('token');
          expect(res.body.data).toHaveProperty('user');
          accessToken = res.body.data.token;
        });
    });

    it('should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: 'wrong-password',
        })
        .expect(401);
    });

    it('should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password',
        })
        .expect(401);
    });
  });

  describe('GET /api/users/profile (Protected)', () => {
    it('should access profile with valid token', async () => {
      // Login first
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: `profile-test-${Date.now()}@example.com`,
          password: 'Test123!@#',
          firstName: 'Profile',
          lastName: 'Test',
          role: 'customer',
        });

      const token = loginResponse.body.data.token;

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


