import { MarketContextService } from './market-context.service';
import type { AssignmentSnapshot } from './policy.service';
import type { MarketRow } from './market.service';

const US: MarketRow = {
  id: 'm-us',
  code: 'US',
  name: 'United States',
  country: 'United States',
  countryCode: 'US',
  currency: 'USD',
  locale: 'en-US',
  timezone: 'America/New_York',
  isActive: true,
  isDefault: true,
} as MarketRow;

const GB: MarketRow = { ...US, id: 'm-gb', code: 'GB', currency: 'GBP', isDefault: false };

function assignment(overrides: Partial<AssignmentSnapshot>): AssignmentSnapshot {
  return {
    id: 'a1',
    permissionRoleName: 'STAFF',
    permissions: [],
    scopeType: 'MARKET',
    scopeId: null,
    isActive: true,
    ...overrides,
  };
}

function build(assignments: AssignmentSnapshot[], role = 'CUSTOMER') {
  const markets = {
    getDefault: jest.fn().mockResolvedValue(US),
    listActive: jest.fn().mockResolvedValue([US, GB]),
    findByCode: jest.fn(async (code: string) => (code === 'GB' ? GB : code === 'US' ? US : null)),
    findById: jest.fn(async (id: string) => (id === 'm-gb' ? GB : id === 'm-us' ? US : null)),
  };
  const policy = {
    loadAssignments: jest.fn().mockResolvedValue(assignments),
    isGlobalAdmin: jest.fn().mockReturnValue(role === 'ADMIN'),
    allowedMarketIds: jest.fn((a: AssignmentSnapshot[], all: string[]) =>
      a.some((x) => x.scopeType === 'GLOBAL')
        ? [...all]
        : a.filter((x) => x.scopeType === 'MARKET' && x.scopeId).map((x) => x.scopeId as string),
    ),
  };
  const modes = { getDataScopeMode: jest.fn().mockReturnValue('enforce') };
  return new MarketContextService(markets as any, policy as any, modes as any);
}

describe('MarketContextService.resolve', () => {
  it('lets a shopper with a home market still choose another market', async () => {
    const svc = build([]);
    const resolved = await svc.resolve(
      { code: 'GB' },
      { id: 'u1', role: 'CUSTOMER', homeMarketId: 'm-us' },
    );
    // homeMarketId is a default, not a lock — the migration sets it for
    // everyone, so treating it as a lock would disable the market selector.
    expect(resolved.market?.code).toBe('GB');
  });

  it('falls back to the home market when no market was requested', async () => {
    const svc = build([]);
    const resolved = await svc.resolve({}, { id: 'u1', role: 'CUSTOMER', homeMarketId: 'm-gb' });
    expect(resolved.market?.code).toBe('GB');
  });

  it('pins store-scoped staff to their home market', async () => {
    const svc = build([assignment({ scopeType: 'STORE', scopeId: 'store-1' })]);
    const resolved = await svc.resolve(
      { code: 'GB' },
      { id: 'u1', role: 'STORE_STAFF', homeMarketId: 'm-us' },
    );
    expect(resolved.market?.code).toBe('US');
  });

  it('restricts a user with market-scoped assignments to those markets', async () => {
    const svc = build([assignment({ scopeType: 'MARKET', scopeId: 'm-us' })]);
    const resolved = await svc.resolve({ code: 'GB' }, { id: 'u1', role: 'FINANCE' });
    expect(resolved.market?.code).toBe('US');
  });

  it('scopes a global admin to the market they explicitly selected', async () => {
    const svc = build([assignment({ scopeType: 'GLOBAL' })], 'ADMIN');
    const resolved = await svc.resolve({ code: 'GB' }, { id: 'u1', role: 'ADMIN' });
    expect(resolved.market?.code).toBe('GB');
    expect(resolved.store.bypassMarketScope).toBe(false);
  });

  it('leaves a global admin unscoped when no market was selected', async () => {
    const svc = build([assignment({ scopeType: 'GLOBAL' })], 'ADMIN');
    const resolved = await svc.resolve({}, { id: 'u1', role: 'ADMIN' });
    expect(resolved.store.bypassMarketScope).toBe(true);
  });
});
