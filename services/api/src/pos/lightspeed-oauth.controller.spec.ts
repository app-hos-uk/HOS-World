import { LightspeedOAuthController } from './lightspeed-oauth.controller';

/**
 * The callback is @Public() and its token-exchange body carries LIGHTSPEED_CLIENT_SECRET,
 * while the tenant prefix arrives inside an unauthenticated `state` parameter. Regression
 * guard: an unvalidated prefix let a crafted `state` terminate the hostname early and POST
 * the platform's client secret to an attacker-controlled server.
 */
describe('LightspeedOAuthController — callback token endpoint', () => {
  const CONFIG: Record<string, string> = {
    LIGHTSPEED_CLIENT_ID: 'client-1',
    LIGHTSPEED_CLIENT_SECRET: 'secret-1',
    FRONTEND_URL: 'https://app.example.com',
    API_URL: 'https://api.example.com',
  };

  let controller: LightspeedOAuthController;
  let res: { redirect: jest.Mock };
  let fetchMock: jest.Mock;

  const stateFor = (domainPrefix: string) =>
    Buffer.from(JSON.stringify({ domainPrefix })).toString('base64');

  beforeEach(() => {
    const config: any = { get: jest.fn((key: string, fallback = '') => CONFIG[key] ?? fallback) };
    controller = new LightspeedOAuthController(config);
    res = { redirect: jest.fn() };

    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }),
    });
    global.fetch = fetchMock as any;
  });

  const hostsTried = () =>
    fetchMock.mock.calls.map(([url]) => new URL(String(url)).hostname).filter(Boolean);

  describe('rejects prefixes that could redirect the client secret off-domain', () => {
    // Each of these terminates the host before `.retail.lightspeed.app`, so a naive
    // template interpolation would send the secret to `evil.com`.
    const malicious = [
      'evil.com/?',
      'evil.com/',
      'evil.com#',
      'evil.com?',
      'user@evil.com',
      'evil.com:8443/x',
      '../evil.com',
      'prefix.evil.com',
      '',
    ];

    it.each(malicious)('refuses domainPrefix %p without contacting it', async (prefix) => {
      await controller.callback('auth-code', stateFor(prefix), '', res as any);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        'https://app.example.com/admin/stores/new?ls_error=invalid_state',
      );
    });
  });

  it('exchanges the code against the real Lightspeed host for a valid prefix', async () => {
    await controller.callback('auth-code', stateFor('acme-retail'), '', res as any);

    expect(hostsTried()).toEqual(['acme-retail.retail.lightspeed.app']);

    const [, init] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(String(init.body));
    expect(body.get('client_secret')).toBe('secret-1');
    expect(body.get('code')).toBe('auth-code');
  });

  it('never sends the client secret to a non-Lightspeed host', async () => {
    for (const prefix of ['evil.com/?', 'acme-retail', 'evil.com#']) {
      await controller.callback('auth-code', stateFor(prefix), '', res as any);
    }

    for (const host of hostsTried()) {
      expect(host.endsWith('.retail.lightspeed.app')).toBe(true);
    }
  });

  it('rejects malformed (non-base64-JSON) state before any outbound request', async () => {
    await controller.callback('auth-code', 'not-base64-json', '', res as any);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(
      'https://app.example.com/admin/stores/new?ls_error=invalid_state',
    );
  });
});
