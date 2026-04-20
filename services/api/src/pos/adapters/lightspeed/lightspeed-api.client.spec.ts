import { LightspeedApiClient } from './lightspeed-api.client';

const baseCreds = {
  domainPrefix: 'testshop',
  clientId: 'cid',
  clientSecret: 'cs',
  accessToken: 'tok123',
  refreshToken: 'ref',
  tokenExpiresAt: Date.now() + 3_600_000,
};

function createClient(overrides: Partial<typeof baseCreds> = {}) {
  const creds = { ...baseCreds, ...overrides };
  const getToken = jest.fn(() => creds.accessToken);
  const client = new LightspeedApiClient(creds as any, getToken);
  return { client, getToken };
}

describe('LightspeedApiClient', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  async function drainAndCollect<T>(p: Promise<T>): Promise<{ value?: T; error?: Error }> {
    const result: { value?: T; error?: Error } = {};
    const guarded = p.then(
      (v) => { result.value = v; },
      (e) => { result.error = e; },
    );
    for (let i = 0; i < 20; i++) {
      await jest.advanceTimersByTimeAsync(3_000);
    }
    await guarded;
    return result;
  }

  it('builds the correct base URL', async () => {
    const { client } = createClient();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({ data: [] }),
    });
    const r = await drainAndCollect(client.request('GET', '/products'));
    expect(r.error).toBeUndefined();
    expect((globalThis.fetch as jest.Mock).mock.calls[0][0]).toBe(
      'https://testshop.vendhq.com/api/2.0/products',
    );
  });

  it('sets Authorization header with bearer token', async () => {
    const { client } = createClient();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({}),
    });
    const r = await drainAndCollect(client.request('GET', '/outlets'));
    expect(r.error).toBeUndefined();
    const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer tok123');
  });

  it('throws when no access token', async () => {
    const getToken = jest.fn(() => undefined as string | undefined);
    const client = new LightspeedApiClient(baseCreds as any, getToken);
    const r = await drainAndCollect(client.request('GET', '/foo'));
    expect(r.error).toBeDefined();
    expect(r.error!.message).toContain('no access token');
  });

  it('retries on 429 with retry-after header', async () => {
    const { client } = createClient();
    let call = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      call++;
      if (call === 1) {
        return {
          ok: false,
          status: 429,
          headers: new Map([['retry-after', '1']]),
          text: async () => 'rate limited',
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({ items: [] }),
      };
    });
    const r = await drainAndCollect(client.request('GET', '/products'));
    expect(r.error).toBeUndefined();
    expect(call).toBe(2);
    expect(r.value!.data).toEqual({ items: [] });
  });

  it('retries on 5xx with exponential backoff', async () => {
    const { client } = createClient();
    let call = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      call++;
      if (call <= 2) {
        return {
          ok: false,
          status: 502,
          headers: new Map(),
          text: async () => 'Bad Gateway',
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({ ok: true }),
      };
    });
    const r = await drainAndCollect(client.request('GET', '/test'));
    expect(r.error).toBeUndefined();
    expect(call).toBe(3);
    expect(r.value!.data).toEqual({ ok: true });
  });

  it('throws after MAX_RETRIES exhausted on 5xx', async () => {
    const { client } = createClient();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Map(),
      text: async () => 'Internal',
    });
    const r = await drainAndCollect(client.request('GET', '/fail'));
    expect(r.error).toBeDefined();
    expect(r.error!.message).toContain('Lightspeed API 500');
  });

  it('handles network errors with retries', async () => {
    const { client } = createClient();
    let call = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      call++;
      if (call <= 2) throw new Error('ECONNREFUSED');
      return {
        ok: true,
        status: 200,
        headers: new Map(),
        json: async () => ({ recovered: true }),
      };
    });
    const r = await drainAndCollect(client.request('GET', '/flaky'));
    expect(r.error).toBeUndefined();
    expect(call).toBe(3);
    expect(r.value!.data).toEqual({ recovered: true });
  });

  it('sends JSON body on POST', async () => {
    const { client } = createClient();
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map(),
      json: async () => ({ id: '123' }),
    });
    const r = await drainAndCollect(client.request('POST', '/products', { name: 'Test' }));
    expect(r.error).toBeUndefined();
    const opts = (globalThis.fetch as jest.Mock).mock.calls[0][1];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ name: 'Test' }));
  });

  it('updateCredentials invokes onTokenRefresh callback', () => {
    const callback = jest.fn();
    const client = new LightspeedApiClient(baseCreds as any, jest.fn(), callback);
    const newCreds = { ...baseCreds, accessToken: 'new' };
    client.updateCredentials(newCreds as any);
    expect(callback).toHaveBeenCalledWith(newCreds);
  });
});
