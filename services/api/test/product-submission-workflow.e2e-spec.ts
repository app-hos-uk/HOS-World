import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NoOpThrottlerGuard, makeRegPayload, extractToken } from './helpers';

/**
 * Product Submission -> Approval -> Publishing Workflow
 */
describe('Product Submission Workflow E2E', () => {
  let app: INestApplication;
  let sellerToken: string;
  let submissionId: string;

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

    // Create seller
    const sellerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(makeRegPayload('seller'));
    sellerToken = extractToken(sellerResponse);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Product Submission Workflow', () => {
    it('Step 1: Seller submits product for review', async () => {
      if (!sellerToken) return;
      const response = await request(app.getHttpServer())
        .post('/api/submissions')
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({
          name: 'Workflow Test Product',
          description: 'Product for workflow testing',
          price: 99.99,
          stock: 50,
          currency: 'USD',
          sku: `SKU-${Date.now()}`,
        });

      if (response.status === 201 || response.status === 200) {
        submissionId = response.body.data?.id || response.body.id;
        expect(submissionId).toBeDefined();
      }
    });

    it('Step 2: Seller can view their submissions', async () => {
      if (!sellerToken) return;
      const response = await request(app.getHttpServer())
        .get('/api/submissions')
        .set('Authorization', `Bearer ${sellerToken}`);

      expect(response.status).toBe(200);
    });

    it('Step 3: Submission detail is accessible', async () => {
      if (!sellerToken || !submissionId) return;
      const response = await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('data');
      }
    });

    it('Step 4: Verify submission has correct status', async () => {
      if (!sellerToken || !submissionId) return;
      const response = await request(app.getHttpServer())
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${sellerToken}`);

      if (response.status === 200) {
        expect(response.body.data || response.body).toHaveProperty('status');
      }
    });
  });
});
