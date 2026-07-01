import { ThrottlerGuard } from '@nestjs/throttler';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Extends ThrottlerGuard but always allows requests through.
 * Kept for consistency across suites; actual throttling is disabled in the
 * test environment via `skipIf` in RateLimitModule (NODE_ENV === 'test').
 */
export class NoOpThrottlerGuard extends ThrottlerGuard {
  async canActivate(): Promise<boolean> {
    return true;
  }
}

export function makeRegPayload(role: string, overrides: Record<string, any> = {}) {
  const ts = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    email: `${role}-${ts}@example.com`,
    password: 'Test123!@$',
    firstName: role.charAt(0).toUpperCase() + role.slice(1),
    lastName: 'Test',
    role,
    country: 'US',
    preferredCommunicationMethod: 'EMAIL',
    gdprConsent: true,
    ...(role === 'seller' ? { storeName: `Test Store ${ts}` } : {}),
    ...overrides,
  };
}

/**
 * Extract the access_token JWT from a supertest response.
 * Checks both the body (`data.token`) and `Set-Cookie` header because the API
 * delivers tokens exclusively via httpOnly cookies (sanitizeAuthResponse strips
 * them from the JSON body).
 */
export function extractToken(res: any): string | undefined {
  const bodyToken = res.body?.data?.token;
  if (bodyToken) return bodyToken;

  const cookies: string[] = res.headers?.['set-cookie'] || [];
  for (const c of cookies) {
    const match = c.match(/^access_token=([^;]+)/);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Register a user then elevate them to ADMIN directly in the DB (registration
 * does not allow privileged roles). Returns a valid access token. ADMIN
 * short-circuits every RolesGuard and can create catalog products, so this is
 * the seed used to obtain purchasable products for cart/order flows.
 */
export async function seedAdmin(app: INestApplication): Promise<string> {
  const payload = makeRegPayload('customer', { firstName: 'Admin', lastName: 'User' });
  const res = await request(app.getHttpServer()).post('/api/auth/register').send(payload);

  const prisma = app.get(PrismaService);
  await prisma.user.update({ where: { email: payload.email }, data: { role: 'ADMIN' } });

  // Re-login so the returned token maps to a user whose role is now ADMIN.
  // (JwtStrategy re-reads role from the DB per request, so the original token
  // would work too, but re-login keeps the intent explicit.)
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: payload.email, password: payload.password });
  return extractToken(login);
}

/** Create an ACTIVE catalog product as an ADMIN and return its id. */
export async function createProduct(
  app: INestApplication,
  adminToken: string,
  overrides: Record<string, any> = {},
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: `Test Product ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: 'Product created for E2E tests',
      price: 49.99,
      stock: 100,
      currency: 'USD',
      status: 'ACTIVE',
      ...overrides,
    });
  return res.body?.data?.id;
}

/** Create a default address for the given user token and return its id. */
export async function createAddress(
  app: INestApplication,
  token: string,
  overrides: Record<string, any> = {},
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/addresses')
    .set('Authorization', `Bearer ${token}`)
    .send({
      firstName: 'Test',
      lastName: 'User',
      street: '123 Test Street',
      city: 'Test City',
      state: 'Teststate',
      postalCode: '12345',
      country: 'US',
      phone: '+1234567890',
      isDefault: true,
      ...overrides,
    });
  return res.body?.data?.id;
}
