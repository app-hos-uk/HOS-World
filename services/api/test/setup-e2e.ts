// E2E Test Setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-testing';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/hos_marketplace_test';
process.env.PORT = '3002';

// Avoid Redis-backed throttling storage in tests (throttling itself is
// skipped via skipIf in RateLimitModule when NODE_ENV === 'test').
delete process.env.REDIS_URL;

// Global test timeout — NestJS full AppModule bootstrap is slow
jest.setTimeout(120000);


