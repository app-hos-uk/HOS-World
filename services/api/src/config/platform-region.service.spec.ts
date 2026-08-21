import {
  PLATFORM_COUNTRY_CONFIG_KEY,
  PLATFORM_CURRENCY_CONFIG_KEY,
  PLATFORM_LOCALE_CONFIG_KEY,
  PLATFORM_REGION_CACHE_KEY,
  PLATFORM_TIMEZONE_CONFIG_KEY,
  PlatformRegionService,
} from './platform-region.service';
import {
  emptyAccessControlStore,
  runWithAccessControl,
} from '../access-control/access-control.als';

/** Stand-in for the Redis-backed CacheService shared by every API instance. */
function createSharedCache() {
  const store = new Map<string, unknown>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

function createPrisma(rows: Array<{ key: string; value: unknown }> = [], marketRow?: unknown) {
  return {
    config: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
    market: {
      findUnique: jest.fn().mockResolvedValue(marketRow ?? null),
    },
  };
}

function createService(
  prisma: ReturnType<typeof createPrisma>,
  sharedCache: ReturnType<typeof createSharedCache> | undefined,
  env: Record<string, string | undefined> = {},
  ttlMs = 15_000,
) {
  const config = {
    get: (key: string) => {
      if (key === 'PLATFORM_REGION_CACHE_TTL_MS') return ttlMs;
      return env[key];
    },
  };
  return new PlatformRegionService(prisma as any, config as any, sharedCache as any);
}

describe('PlatformRegionService', () => {
  it('resolves defaults when env and DB are empty', async () => {
    const service = createService(createPrisma(), undefined, {}, 0);

    const region = await service.getRegion();

    expect(region).toEqual({
      currency: 'USD',
      country: 'US',
      locale: 'en-US',
      timezone: 'America/New_York',
      taxOrigin: null,
    });
    expect(await service.getCurrency()).toBe('USD');
    expect(await service.getCountry()).toBe('US');
    expect(await service.getLocale()).toBe('en-US');
    expect(await service.getTimezone()).toBe('America/New_York');
  });

  it('applies env overrides over defaults', async () => {
    const service = createService(
      createPrisma(),
      undefined,
      {
        PLATFORM_CURRENCY: 'EUR',
        PLATFORM_COUNTRY: 'DE',
        PLATFORM_LOCALE: 'de-DE',
        PLATFORM_TIMEZONE: 'Europe/Berlin',
      },
      0,
    );

    const region = await service.getRegion();

    expect(region.currency).toBe('EUR');
    expect(region.country).toBe('DE');
    expect(region.locale).toBe('de-DE');
    expect(region.timezone).toBe('Europe/Berlin');
  });

  it('lets DB overrides beat env values', async () => {
    const prisma = createPrisma([
      { key: PLATFORM_CURRENCY_CONFIG_KEY, value: 'CAD' },
      { key: PLATFORM_COUNTRY_CONFIG_KEY, value: 'CA' },
      { key: PLATFORM_LOCALE_CONFIG_KEY, value: 'en-CA' },
      { key: PLATFORM_TIMEZONE_CONFIG_KEY, value: 'America/Toronto' },
    ]);
    const service = createService(
      prisma,
      undefined,
      {
        PLATFORM_CURRENCY: 'EUR',
        PLATFORM_COUNTRY: 'DE',
        PLATFORM_LOCALE: 'de-DE',
        PLATFORM_TIMEZONE: 'Europe/Berlin',
      },
      0,
    );

    const region = await service.getRegion();

    expect(region.currency).toBe('CAD');
    expect(region.country).toBe('CA');
    expect(region.locale).toBe('en-CA');
    expect(region.timezone).toBe('America/Toronto');
    expect(prisma.config.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          level: 'PLATFORM',
          levelId: 'PLATFORM',
        }),
      }),
    );
  });

  describe('active market context', () => {
    const usMarket = {
      currency: 'USD',
      country: 'United States',
      countryCode: 'US',
      locale: 'en-US',
      timezone: 'America/New_York',
      taxOrigin: null,
      isActive: true,
    };

    function withStore(dataScopeMode: string, fn: () => Promise<void>) {
      return runWithAccessControl(
        {
          ...emptyAccessControlStore(),
          marketId: 'm-us',
          dataScopeMode: dataScopeMode as never,
        },
        fn,
      );
    }

    // AccessGuard resolves a market (falling back to the seeded US default) on
    // every request. While scoping is off, region must still come from env/DB
    // or a GBP deploy would silently serve USD.
    it('ignores the active market while data scope is legacy', async () => {
      const prisma = createPrisma([], usMarket);
      const service = createService(prisma, undefined, { PLATFORM_CURRENCY: 'GBP' }, 0);

      await withStore('legacy', async () => {
        expect((await service.getRegion()).currency).toBe('GBP');
      });
      expect(prisma.market.findUnique).not.toHaveBeenCalled();
    });

    it('follows the active market once data scope is enforced', async () => {
      const prisma = createPrisma([], usMarket);
      const service = createService(prisma, undefined, { PLATFORM_CURRENCY: 'GBP' }, 0);

      await withStore('enforce', async () => {
        const region = await service.getRegion();
        expect(region.currency).toBe('USD');
        expect(region.country).toBe('US');
      });
    });
  });

  it('serves repeat reads from the local cache within the TTL', async () => {
    const prisma = createPrisma([{ key: PLATFORM_CURRENCY_CONFIG_KEY, value: 'USD' }]);
    const service = createService(prisma, createSharedCache(), {}, 5_000);

    const first = await service.getRegion();
    const second = await service.getRegion();

    expect(first.currency).toBe('USD');
    expect(second.currency).toBe('USD');
    expect(prisma.config.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalidate() clears local and shared cache so the next read hits the DB', async () => {
    const sharedCache = createSharedCache();
    const prisma = createPrisma([{ key: PLATFORM_CURRENCY_CONFIG_KEY, value: 'USD' }]);
    const service = createService(prisma, sharedCache, {}, 5_000);

    await service.getRegion();
    expect(sharedCache.store.has(PLATFORM_REGION_CACHE_KEY)).toBe(true);
    expect(prisma.config.findMany).toHaveBeenCalledTimes(1);

    await service.invalidate();
    expect(sharedCache.store.has(PLATFORM_REGION_CACHE_KEY)).toBe(false);

    await service.getRegion();
    expect(prisma.config.findMany).toHaveBeenCalledTimes(2);
  });

  it('getTaxOrigin() returns null when the origin is incomplete', async () => {
    const incomplete = createService(
      createPrisma(),
      undefined,
      {
        TAX_ORIGIN_STREET: '1564 Broadway',
        TAX_ORIGIN_CITY: 'New York',
        // postal code missing
        TAX_ORIGIN_COUNTRY: 'US',
        TAX_ORIGIN_STATE: 'NY',
      },
      0,
    );
    expect(await incomplete.getTaxOrigin()).toBeNull();

    const missingStateForUs = createService(
      createPrisma(),
      undefined,
      {
        TAX_ORIGIN_STREET: '1564 Broadway',
        TAX_ORIGIN_CITY: 'New York',
        TAX_ORIGIN_POSTAL_CODE: '10036',
        TAX_ORIGIN_COUNTRY: 'US',
      },
      0,
    );
    expect(await missingStateForUs.getTaxOrigin()).toBeNull();
  });

  it('getTaxOrigin() returns a complete origin and falls TAX_ORIGIN_COUNTRY back to country', async () => {
    const service = createService(
      createPrisma(),
      undefined,
      {
        PLATFORM_COUNTRY: 'US',
        TAX_ORIGIN_STREET: '1564 Broadway',
        TAX_ORIGIN_CITY: 'New York',
        TAX_ORIGIN_STATE: 'NY',
        TAX_ORIGIN_POSTAL_CODE: '10036',
      },
      0,
    );

    await expect(service.getTaxOrigin()).resolves.toEqual({
      street: '1564 Broadway',
      city: 'New York',
      state: 'NY',
      postalCode: '10036',
      country: 'US',
    });
  });

  it('assertTaxOriginConfigured throws in production when a provider is active and origin is missing', async () => {
    const service = createService(createPrisma(), undefined, { NODE_ENV: 'production' }, 0);

    await expect(service.assertTaxOriginConfigured(true)).rejects.toThrow(/TAX_ORIGIN_STREET/);
  });

  it('assertTaxOriginConfigured throws in staging when a provider is active and origin is missing', async () => {
    const service = createService(createPrisma(), undefined, { NODE_ENV: 'staging' }, 0);

    await expect(service.assertTaxOriginConfigured(true)).rejects.toThrow(
      /tax origin is incomplete/,
    );
  });

  it('assertTaxOriginConfigured is a no-op when the tax provider is inactive', async () => {
    const service = createService(createPrisma(), undefined, { NODE_ENV: 'production' }, 0);

    await expect(service.assertTaxOriginConfigured(false)).resolves.toBeUndefined();
  });

  it('assertTaxOriginConfigured is a no-op outside production/staging', async () => {
    const service = createService(createPrisma(), undefined, { NODE_ENV: 'development' }, 0);

    await expect(service.assertTaxOriginConfigured(true)).resolves.toBeUndefined();
  });

  it('assertTaxOriginConfigured passes in production when origin is complete', async () => {
    const service = createService(
      createPrisma(),
      undefined,
      {
        NODE_ENV: 'production',
        TAX_ORIGIN_STREET: '1564 Broadway',
        TAX_ORIGIN_CITY: 'New York',
        TAX_ORIGIN_STATE: 'NY',
        TAX_ORIGIN_POSTAL_CODE: '10036',
        TAX_ORIGIN_COUNTRY: 'US',
      },
      0,
    );

    await expect(service.assertTaxOriginConfigured(true)).resolves.toBeUndefined();
  });
});
