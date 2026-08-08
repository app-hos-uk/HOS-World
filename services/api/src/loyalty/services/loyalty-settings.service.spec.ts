import { LOYALTY_SETTINGS_CACHE_KEY, LoyaltySettingsService } from './loyalty-settings.service';

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

function createPrisma(row: { value: Record<string, unknown> } | null) {
  const tx = {
    config: {
      findFirst: jest.fn().mockResolvedValue(row ? { id: 'config-1' } : null),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return {
    tx,
    config: { findFirst: jest.fn().mockResolvedValue(row) },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
}

function createService(
  prisma: ReturnType<typeof createPrisma>,
  sharedCache: ReturnType<typeof createSharedCache> | undefined,
  ttlMs: number,
) {
  const config = {
    get: (key: string) => (key === 'LOYALTY_SETTINGS_CACHE_TTL_MS' ? ttlMs : undefined),
  };
  const featureFlags = { isEnabled: () => false };
  return new LoyaltySettingsService(
    prisma as any,
    config as any,
    featureFlags as any,
    sharedCache as any,
  );
}

describe('LoyaltySettingsService caching', () => {
  it('serves repeat reads from the local cache within the TTL', async () => {
    const prisma = createPrisma({ value: { defaultEarnRate: 3 } });
    const service = createService(prisma, createSharedCache(), 5_000);

    const first = await service.getResolved();
    const second = await service.getResolved();

    expect(first.settings.defaultEarnRate).toBe(3);
    expect(second.settings.defaultEarnRate).toBe(3);
    expect(prisma.config.findFirst).toHaveBeenCalledTimes(1);
  });

  it('propagates a save to other instances through the shared cache', async () => {
    const sharedCache = createSharedCache();
    // The other instance still sees the pre-save row, so a fresh value can only
    // have come from the shared cache.
    const staleRow = { value: { defaultEarnRate: 1 } };

    const writer = createService(createPrisma(staleRow), sharedCache, 1);
    const reader = createService(createPrisma(staleRow), sharedCache, 1);

    await reader.getResolved();
    await writer.update({ defaultEarnRate: 7 });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const afterSave = await reader.getResolved();

    expect(afterSave.settings.defaultEarnRate).toBe(7);
    expect(afterSave.source).toBe('database');
    expect(sharedCache.store.get(LOYALTY_SETTINGS_CACHE_KEY)).toBeDefined();
  });

  it('falls back to the database when no shared cache is wired up', async () => {
    const prisma = createPrisma({ value: { defaultEarnRate: 2 } });
    const service = createService(prisma, undefined, 0);

    const first = await service.getResolved();
    const second = await service.getResolved();

    expect(first.settings.defaultEarnRate).toBe(2);
    expect(prisma.config.findFirst).toHaveBeenCalledTimes(2);
    expect(second.source).toBe('database');
  });

  it('invalidate() clears the shared entry so every instance re-reads', async () => {
    const sharedCache = createSharedCache();
    const service = createService(createPrisma({ value: {} }), sharedCache, 5_000);

    await service.getResolved();
    expect(sharedCache.store.has(LOYALTY_SETTINGS_CACHE_KEY)).toBe(true);

    await service.invalidate();
    expect(sharedCache.store.has(LOYALTY_SETTINGS_CACHE_KEY)).toBe(false);
  });

  it('rejects a POS voucher minimum above the maximum', async () => {
    const service = createService(createPrisma({ value: {} }), createSharedCache(), 0);

    await expect(
      service.update({ posVoucherMinAmount: 100, posVoucherMaxAmount: 50 }),
    ).rejects.toThrow('posVoucherMinAmount cannot exceed posVoucherMaxAmount');
  });
});
