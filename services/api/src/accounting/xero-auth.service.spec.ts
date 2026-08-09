import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { XeroAuthService } from './xero-auth.service';
import {
  XERO_INTEGRATION_CATEGORY,
  XERO_INTEGRATION_PROVIDER,
  type XeroTokenCredentials,
} from './accounting.types';

const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

function buildService(overrides?: {
  configGet?: (key: string) => string | undefined;
  upsert?: jest.Mock;
  findUnique?: jest.Mock;
  encryptJson?: jest.Mock;
  decryptJson?: jest.Mock;
}) {
  const configGet =
    overrides?.configGet ??
    ((key: string) => {
      const map: Record<string, string> = {
        XERO_CLIENT_ID: 'client-id',
        XERO_CLIENT_SECRET: 'client-secret',
        XERO_REDIRECT_URI: 'https://example.com/callback',
        XERO_TENANT_ID: '',
      };
      return map[key];
    });

  const config = { get: jest.fn(configGet) } as any;

  const prisma = {
    integrationConfig: {
      upsert: overrides?.upsert ?? jest.fn().mockResolvedValue({}),
      findUnique: overrides?.findUnique ?? jest.fn().mockResolvedValue(null),
    },
  } as any;

  const encryption = {
    encryptJson: overrides?.encryptJson ?? jest.fn().mockReturnValue('encrypted'),
    decryptJson: overrides?.decryptJson ?? jest.fn(),
  } as any;

  const redis = {
    isRedisConnected: jest.fn().mockReturnValue(false),
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(undefined),
    setNX: jest.fn().mockResolvedValue(true),
  } as any;

  const service = new XeroAuthService(config, prisma, encryption, redis);
  return { service, config, prisma, encryption, redis };
}

afterEach(() => {
  jest.restoreAllMocks();
  mockFetch.mockReset();
});

describe('XeroAuthService', () => {
  describe('createConnectUrl', () => {
    it('returns an authorize URL with correct params and state', async () => {
      const { service } = buildService();
      const result = await service.createConnectUrl();

      expect(result.state).toBeDefined();
      expect(result.state.length).toBe(32);
      expect(result.url).toContain('https://login.xero.com/identity/connect/authorize');
      expect(result.url).toContain('client_id=client-id');
      expect(result.url).toContain(encodeURIComponent('https://example.com/callback'));
      expect(result.scopes).toEqual([
        'offline_access',
        'accounting.manualjournals',
        'accounting.settings.read',
      ]);
    });

    it('throws when XERO_CLIENT_ID is missing', async () => {
      const { service } = buildService({
        configGet: (key: string) => (key === 'XERO_REDIRECT_URI' ? 'https://cb' : undefined),
      });
      await expect(service.createConnectUrl()).rejects.toThrow(BadRequestException);
    });

    it('throws when XERO_REDIRECT_URI is missing', async () => {
      const { service } = buildService({
        configGet: (key: string) => (key === 'XERO_CLIENT_ID' ? 'id' : undefined),
      });
      await expect(service.createConnectUrl()).rejects.toThrow(BadRequestException);
    });

    it('stores state in Redis when connected', async () => {
      const { service, redis } = buildService();
      redis.isRedisConnected.mockReturnValue(true);
      const { state } = await service.createConnectUrl();
      expect(redis.set).toHaveBeenCalledWith(`xero:oauth:state:${state}`, expect.any(String), 600);
    });
  });

  describe('validateAndConsumeState', () => {
    it('validates and consumes a valid state token', async () => {
      const { service } = buildService();
      const { state } = await service.createConnectUrl();
      await expect(service.validateAndConsumeState(state)).resolves.toBeUndefined();
      // Second use should fail
      await expect(service.validateAndConsumeState(state)).rejects.toThrow(ForbiddenException);
    });

    it('throws for an unknown state', async () => {
      const { service } = buildService();
      await expect(service.validateAndConsumeState('unknown-state')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws for an expired state', async () => {
      const { service } = buildService();
      const { state } = await service.createConnectUrl();

      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now + 11 * 60 * 1000);

      await expect(service.validateAndConsumeState(state)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('exchangeCode', () => {
    it('exchanges an authorization code for tokens and stores them', async () => {
      const upsert = jest.fn().mockResolvedValue({});
      const { service } = buildService({ upsert });

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 1800,
            token_type: 'Bearer',
            scope: 'offline_access',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ tenantId: 'tenant-1' }],
        });

      const result = await service.exchangeCode('auth-code');
      expect(result.accessToken).toBe('at');
      expect(result.refreshToken).toBe('rt');
      expect(result.tenantId).toBe('tenant-1');
      expect(upsert).toHaveBeenCalled();
    });

    it('uses XERO_TENANT_ID from config if available', async () => {
      const { service } = buildService({
        configGet: (key: string) => {
          const map: Record<string, string> = {
            XERO_CLIENT_ID: 'cid',
            XERO_CLIENT_SECRET: 'cs',
            XERO_REDIRECT_URI: 'https://cb',
            XERO_TENANT_ID: 'env-tenant',
          };
          return map[key];
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 1800,
        }),
      });

      const result = await service.exchangeCode('code');
      expect(result.tenantId).toBe('env-tenant');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws when token exchange fails', async () => {
      const { service } = buildService();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      });
      await expect(service.exchangeCode('bad-code')).rejects.toThrow(BadRequestException);
    });

    it('throws when XERO_CLIENT_ID/SECRET are missing', async () => {
      const { service } = buildService({
        configGet: (key: string) => (key === 'XERO_REDIRECT_URI' ? 'https://cb' : undefined),
      });
      await expect(service.exchangeCode('code')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getValidAccessToken', () => {
    it('returns cached token if not expired', async () => {
      const creds: XeroTokenCredentials = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 5 * 60 * 1000,
        tenantId: 'tid',
      };
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ credentials: 'enc' }),
        decryptJson: jest.fn().mockReturnValue(creds),
      });

      const result = await service.getValidAccessToken();
      expect(result.accessToken).toBe('at');
      expect(result.tenantId).toBe('tid');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('refreshes the token when expired', async () => {
      const creds: XeroTokenCredentials = {
        accessToken: 'old-at',
        refreshToken: 'rt',
        expiresAt: Date.now() - 60_000,
        tenantId: 'tid',
      };
      const upsert = jest.fn().mockResolvedValue({});
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ credentials: 'enc' }),
        decryptJson: jest.fn().mockReturnValue(creds),
        upsert,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-at',
          refresh_token: 'new-rt',
          expires_in: 1800,
        }),
      });

      const result = await service.getValidAccessToken();
      expect(result.accessToken).toBe('new-at');
      expect(upsert).toHaveBeenCalled();
    });

    it('throws when no tokens stored', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue(null),
      });
      await expect(service.getValidAccessToken()).rejects.toThrow(BadRequestException);
    });

    it('throws when tenant id is missing from creds and config', async () => {
      const creds: XeroTokenCredentials = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 300_000,
      };
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ credentials: 'enc' }),
        decryptJson: jest.fn().mockReturnValue(creds),
        configGet: (key: string) => {
          const map: Record<string, string> = {
            XERO_CLIENT_ID: 'cid',
            XERO_CLIENT_SECRET: 'cs',
            XERO_REDIRECT_URI: 'https://cb',
            XERO_TENANT_ID: '',
          };
          return map[key];
        },
      });
      await expect(service.getValidAccessToken()).rejects.toThrow('Xero tenant id missing');
    });
  });

  describe('getConnectionStatus', () => {
    it('returns connected=false when no tokens', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue(null),
      });
      const status = await service.getConnectionStatus();
      expect(status.connected).toBe(false);
      expect(status.hasRefreshToken).toBe(false);
    });

    it('returns connected=true when tokens exist', async () => {
      const creds: XeroTokenCredentials = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 300_000,
        tenantId: 'tid',
      };
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ credentials: 'enc' }),
        decryptJson: jest.fn().mockReturnValue(creds),
      });
      const status = await service.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.hasRefreshToken).toBe(true);
      expect(status.tenantId).toBe('tid');
    });
  });

  describe('storeTokens', () => {
    it('upserts encrypted credentials into integrationConfig', async () => {
      const upsert = jest.fn().mockResolvedValue({});
      const encryptJson = jest.fn().mockReturnValue('enc-blob');
      const { service } = buildService({ upsert, encryptJson });

      const creds: XeroTokenCredentials = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: 1234,
      };
      await service.storeTokens(creds);
      expect(encryptJson).toHaveBeenCalledWith(creds);
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            category_provider: {
              category: XERO_INTEGRATION_CATEGORY,
              provider: XERO_INTEGRATION_PROVIDER,
            },
          },
        }),
      );
    });
  });

  describe('loadTokens', () => {
    it('returns null when no row exists', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue(null),
      });
      expect(await service.loadTokens()).toBeNull();
    });

    it('returns null when row has no credentials', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ credentials: null }),
      });
      expect(await service.loadTokens()).toBeNull();
    });

    it('returns decrypted tokens', async () => {
      const creds: XeroTokenCredentials = {
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: 1234,
      };
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ credentials: 'enc' }),
        decryptJson: jest.fn().mockReturnValue(creds),
      });
      expect(await service.loadTokens()).toEqual(creds);
    });

    it('returns null when decryption fails', async () => {
      const { service } = buildService({
        findUnique: jest.fn().mockResolvedValue({ credentials: 'enc' }),
        decryptJson: jest.fn().mockImplementation(() => {
          throw new Error('decrypt failed');
        }),
      });
      expect(await service.loadTokens()).toBeNull();
    });
  });

  describe('fetchPrimaryTenantId (via exchangeCode)', () => {
    it('returns null when connections fetch fails', async () => {
      const { service } = buildService();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 1800,
          }),
        })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await service.exchangeCode('code');
      expect(result.tenantId).toBeUndefined();
    });

    it('returns null when connections returns empty array', async () => {
      const { service } = buildService();

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'at',
            refresh_token: 'rt',
            expires_in: 1800,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      const result = await service.exchangeCode('code');
      expect(result.tenantId).toBeUndefined();
    });
  });
});
