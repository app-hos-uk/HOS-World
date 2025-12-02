// E2E Test Setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-e2e-testing';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/hos_marketplace_test';
process.env.PORT = '3002';

// Global test timeout
jest.setTimeout(30000);


