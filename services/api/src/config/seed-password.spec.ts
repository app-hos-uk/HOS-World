import { getSeedAdminPassword, getSeedTestPassword } from './seed-password';

describe('seed-password', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SEED_ADMIN_PASSWORD;
    delete process.env.TEST_SEED_PASSWORD;
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns trimmed password when env is set', () => {
    process.env.SEED_ADMIN_PASSWORD = '  my-admin-pass  ';
    expect(getSeedAdminPassword()).toBe('my-admin-pass');
  });

  it('throws when env is set but empty or whitespace-only', () => {
    process.env.SEED_ADMIN_PASSWORD = '';
    expect(() => getSeedAdminPassword()).toThrow(/empty or whitespace-only/);

    process.env.SEED_ADMIN_PASSWORD = '   ';
    expect(() => getSeedAdminPassword()).toThrow(/empty or whitespace-only/);
  });

  it('generates random password in dev when env is unset', () => {
    const a = getSeedAdminPassword();
    const b = getSeedAdminPassword();
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it('throws in production when env is unset', () => {
    process.env.NODE_ENV = 'production';
    expect(() => getSeedTestPassword()).toThrow(/TEST_SEED_PASSWORD must be set/);
  });
});
