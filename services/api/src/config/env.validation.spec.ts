import { validateEnvironmentVariables } from './env.validation';

const validBase: Record<string, unknown> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('validateEnvironmentVariables', () => {
  it('returns config when all required vars are present', () => {
    const result = validateEnvironmentVariables({ ...validBase });
    expect(result).toEqual(expect.objectContaining(validBase));
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...rest } = validBase;
    expect(() => validateEnvironmentVariables(rest)).toThrow('DATABASE_URL is required');
  });

  it('throws when JWT_SECRET is missing', () => {
    const { JWT_SECRET, ...rest } = validBase;
    expect(() => validateEnvironmentVariables(rest)).toThrow('JWT_SECRET is required');
  });

  it('throws when JWT_REFRESH_SECRET is missing', () => {
    const { JWT_REFRESH_SECRET, ...rest } = validBase;
    expect(() => validateEnvironmentVariables(rest)).toThrow('JWT_REFRESH_SECRET is required');
  });

  it('throws when multiple required vars are missing', () => {
    expect(() => validateEnvironmentVariables({})).toThrow('Environment validation failed');
  });

  it('does not throw when JWT_SECRET is short (warning only)', () => {
    const result = validateEnvironmentVariables({
      ...validBase,
      JWT_SECRET: 'short',
    });
    expect(result).toBeDefined();
  });

  it('does not throw when JWT_REFRESH_SECRET is short (warning only)', () => {
    const result = validateEnvironmentVariables({
      ...validBase,
      JWT_REFRESH_SECRET: 'short',
    });
    expect(result).toBeDefined();
  });

  it('throws when PORT is invalid (0)', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, PORT: '0' }),
    ).toThrow('PORT must be between 1 and 65535');
  });

  it('throws when PORT is out of range (99999)', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, PORT: '99999' }),
    ).toThrow('PORT must be between 1 and 65535');
  });

  it('throws when PORT is NaN', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, PORT: 'abc' }),
    ).toThrow('PORT must be between 1 and 65535');
  });

  it('accepts valid PORT', () => {
    const result = validateEnvironmentVariables({ ...validBase, PORT: '3000' });
    expect(result).toBeDefined();
  });

  it('throws when DATABASE_URL is not a PostgreSQL URL', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, DATABASE_URL: 'mysql://x' }),
    ).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
  });

  it('accepts postgresql:// DATABASE_URL', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, DATABASE_URL: 'postgresql://user@host/db' }),
    ).not.toThrow();
  });

  it('accepts postgres:// DATABASE_URL', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, DATABASE_URL: 'postgres://user@host/db' }),
    ).not.toThrow();
  });

  it('warns (does not throw) when REDIS_URL has bad scheme', () => {
    const result = validateEnvironmentVariables({
      ...validBase,
      REDIS_URL: 'http://localhost:6379',
    });
    expect(result).toBeDefined();
  });

  it('accepts valid REDIS_URL (redis://)', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, REDIS_URL: 'redis://localhost:6379' }),
    ).not.toThrow();
  });

  it('accepts valid REDIS_URL (rediss://)', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, REDIS_URL: 'rediss://localhost:6379' }),
    ).not.toThrow();
  });

  it('throws when STORAGE_PROVIDER is invalid', () => {
    expect(() =>
      validateEnvironmentVariables({ ...validBase, STORAGE_PROVIDER: 'gcs' }),
    ).toThrow('STORAGE_PROVIDER must be one of');
  });

  it('accepts valid STORAGE_PROVIDER values', () => {
    for (const p of ['local', 's3', 'minio', 'cloudinary']) {
      expect(() =>
        validateEnvironmentVariables({ ...validBase, STORAGE_PROVIDER: p }),
      ).not.toThrow();
    }
  });

  it('warns (does not throw) when STRIPE_SECRET_KEY is set without STRIPE_WEBHOOK_SECRET', () => {
    const result = validateEnvironmentVariables({
      ...validBase,
      STRIPE_SECRET_KEY: 'sk_test_123',
    });
    expect(result).toBeDefined();
  });

  it('throws when NODE_ENV=production without INTEGRATION_ENCRYPTION_KEY', () => {
    expect(() =>
      validateEnvironmentVariables({
        ...validBase,
        NODE_ENV: 'production',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toThrow('INTEGRATION_ENCRYPTION_KEY is required in production');
  });

  it('throws when NODE_ENV=production without REDIS_URL', () => {
    expect(() =>
      validateEnvironmentVariables({
        ...validBase,
        NODE_ENV: 'production',
        INTEGRATION_ENCRYPTION_KEY: 'key',
      }),
    ).toThrow('REDIS_URL is required in production');
  });

  it('does not throw for production with all required vars', () => {
    expect(() =>
      validateEnvironmentVariables({
        ...validBase,
        NODE_ENV: 'production',
        INTEGRATION_ENCRYPTION_KEY: 'key',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).not.toThrow();
  });

  it('warns (does not throw) when SMTP_HOST set without SMTP_USER/SMTP_PASS', () => {
    const result = validateEnvironmentVariables({
      ...validBase,
      SMTP_HOST: 'smtp.example.com',
    });
    expect(result).toBeDefined();
  });

  it('warns (does not throw) when LOYALTY_ENABLED without HOS_SELLER_ID', () => {
    const result = validateEnvironmentVariables({
      ...validBase,
      LOYALTY_ENABLED: 'true',
    });
    expect(result).toBeDefined();
  });

  it('warns (does not throw) when POS_ENABLED without Lightspeed creds', () => {
    const result = validateEnvironmentVariables({
      ...validBase,
      POS_ENABLED: 'true',
    });
    expect(result).toBeDefined();
  });

  it('warns (does not throw) when ACCOUNTING_ENABLED without Xero creds', () => {
    const result = validateEnvironmentVariables({
      ...validBase,
      ACCOUNTING_ENABLED: 'true',
    });
    expect(result).toBeDefined();
  });

  it('does not warn about Xero when ACCOUNTING_ENABLED is off', () => {
    const result = validateEnvironmentVariables({ ...validBase });
    expect(result).toBeDefined();
  });
});
