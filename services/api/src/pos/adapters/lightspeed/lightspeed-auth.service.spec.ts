import { LightspeedAuthService } from './lightspeed-auth.service';

describe('LightspeedAuthService refresh single-flight', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('shares one in-flight refresh across concurrent callers', async () => {
    let calls = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return {
        ok: true,
        json: async () => ({ access_token: 'new-tok', expires_in: 3600 }),
      };
    }) as any;

    const auth = new LightspeedAuthService({
      domainPrefix: 'demo',
      clientId: 'id',
      clientSecret: 'secret',
      refreshToken: 'rt',
    });

    await Promise.all([auth.refreshAuth(), auth.refreshAuth(), auth.refreshAuth()]);
    expect(calls).toBe(1);
    expect(auth.getCredentials().accessToken).toBe('new-tok');
  });

  it('uses Redis setNX lock when available', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok2', expires_in: 3600 }),
    }) as any;

    const redis = {
      isRedisConnected: () => true,
      setNX: jest.fn().mockResolvedValue(true),
      del: jest.fn().mockResolvedValue(undefined),
    };

    const auth = new LightspeedAuthService({
      domainPrefix: 'demo',
      clientId: 'id',
      clientSecret: 'secret',
      refreshToken: 'rt',
    });
    auth.setRedisLock(redis);

    await auth.refreshAuth();
    expect(redis.setNX).toHaveBeenCalledWith('lightspeed:refresh:demo', '1', 30);
    expect(redis.del).toHaveBeenCalledWith('lightspeed:refresh:demo');
  });
});
