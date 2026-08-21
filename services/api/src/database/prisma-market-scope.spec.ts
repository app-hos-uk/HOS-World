import type { AccessControlMode } from '@hos-marketplace/shared-types';
import {
  emptyAccessControlStore,
  runWithAccessControl,
} from '../access-control/access-control.als';
import { applyMarketScope } from './prisma-market-scope';

function inMarket(
  opts: { marketId?: string | null; mode?: AccessControlMode; bypass?: boolean },
  fn: () => Promise<unknown>,
) {
  return runWithAccessControl(
    {
      ...emptyAccessControlStore(),
      marketId: opts.marketId === undefined ? 'm-us' : opts.marketId,
      dataScopeMode: opts.mode ?? 'enforce',
      bypassMarketScope: opts.bypass ?? false,
    },
    fn,
  );
}

async function call(
  model: string,
  operation: string,
  args: unknown,
  opts: Parameters<typeof inMarket>[0] = {},
) {
  let received: unknown;
  await inMarket(opts, () =>
    applyMarketScope({
      model,
      operation,
      args,
      query: async (a) => {
        received = a;
        return null;
      },
    }),
  );
  return received as Record<string, any>;
}

describe('marketScopeExtension', () => {
  it('filters list queries on market-scoped models', async () => {
    const args = await call('Order', 'findMany', { where: { status: 'PAID' } });
    expect(args.where).toEqual({ AND: [{ status: 'PAID' }, { marketId: 'm-us' }] });
  });

  it('adds a filter when the query has no where clause', async () => {
    const args = await call('Order', 'count', {});
    expect(args.where).toEqual({ marketId: 'm-us' });
  });

  it('scopes unique reads without discarding the unique field', async () => {
    const args = await call('Order', 'findUnique', { where: { id: 'o1' } });
    expect(args.where).toEqual({ AND: [{ id: 'o1' }, { marketId: 'm-us' }] });
  });

  it('scopes update and delete so they cannot cross markets', async () => {
    const updated = await call('Order', 'update', { where: { id: 'o1' }, data: { total: 1 } });
    expect(updated.where).toEqual({ AND: [{ id: 'o1' }, { marketId: 'm-us' }] });

    const deleted = await call('Order', 'delete', { where: { id: 'o1' } });
    expect(deleted.where).toEqual({ AND: [{ id: 'o1' }, { marketId: 'm-us' }] });
  });

  it('stamps the market onto creates', async () => {
    const single = await call('Order', 'create', { data: { total: 10 } });
    expect(single.data).toEqual({ total: 10, marketId: 'm-us' });

    const many = await call('Order', 'createMany', { data: [{ total: 1 }, { total: 2 }] });
    expect(many.data).toEqual([
      { total: 1, marketId: 'm-us' },
      { total: 2, marketId: 'm-us' },
    ]);
  });

  it('overrides a caller-supplied market on create', async () => {
    const args = await call('Order', 'create', { data: { total: 10, marketId: 'm-gb' } });
    expect(args.data).toEqual({ total: 10, marketId: 'm-us' });

    const many = await call('Order', 'createMany', { data: [{ total: 1, marketId: 'm-gb' }] });
    expect(many.data).toEqual([{ total: 1, marketId: 'm-us' }]);
  });

  it('strips an attempt to re-home a row via update', async () => {
    const args = await call('Order', 'update', {
      where: { id: 'o1' },
      data: { total: 5, marketId: 'm-gb' },
    });
    expect(args.data).toEqual({ total: 5 });
    expect(args.where).toEqual({ AND: [{ id: 'o1' }, { marketId: 'm-us' }] });
  });

  it('strips a re-homing attempt using the nested set form', async () => {
    const args = await call('Order', 'updateMany', {
      where: { status: 'PAID' },
      data: { marketId: { set: 'm-gb' } },
    });
    expect(args.data).toEqual({});
  });

  it('leaves an update that keeps the active market untouched', async () => {
    const args = await call('Order', 'update', {
      where: { id: 'o1' },
      data: { marketId: 'm-us' },
    });
    expect(args.data).toEqual({ marketId: 'm-us' });
  });

  it('scopes the upsert where clause so it cannot update another market', async () => {
    const args = await call('Order', 'upsert', {
      where: { id: 'o1' },
      create: { total: 1 },
      update: { total: 2, marketId: 'm-gb' },
    });
    expect(args.where).toEqual({ AND: [{ id: 'o1' }, { marketId: 'm-us' }] });
    expect(args.create).toEqual({ total: 1, marketId: 'm-us' });
    expect(args.update).toEqual({ total: 2 });
  });

  it('leaves models without a marketId column untouched', async () => {
    const args = await call('Product', 'findMany', { where: { status: 'ACTIVE' } });
    expect(args.where).toEqual({ status: 'ACTIVE' });
  });

  it('does nothing in legacy or shadow mode', async () => {
    const legacy = await call('Order', 'findMany', { where: {} }, { mode: 'legacy' });
    expect(legacy.where).toEqual({});

    const shadow = await call('Order', 'findMany', { where: {} }, { mode: 'shadow' });
    expect(shadow.where).toEqual({});
  });

  it('respects the audited bypass and a missing market', async () => {
    const bypassed = await call('Order', 'findMany', { where: {} }, { bypass: true });
    expect(bypassed.where).toEqual({});

    const noMarket = await call('Order', 'findMany', { where: {} }, { marketId: null });
    expect(noMarket.where).toEqual({});
  });
});
