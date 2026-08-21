import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getAccessControlStore, isMarketScopeBypassed } from '../access-control/access-control.als';

/**
 * Prisma model names (as reported to extension hooks) for models carrying
 * `marketId`. Must stay in sync with the schema.
 */
export const MARKET_SCOPED_MODELS = new Set([
  'Store',
  'Order',
  'Payment',
  'Transaction',
  'Settlement',
  'Cart',
  'GiftCard',
  'ReturnRequest',
  'CancellationRequest',
  'Dispute',
  'POSSale',
  'StoreShipmentRequest',
  'VendorLedgerEntry',
]);

/**
 * Operations whose `where` accepts arbitrary filters, so `marketId` can simply
 * be ANDed in.
 */
const FILTERABLE_WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

/**
 * Operations whose `where` must identify a unique record. Prisma's
 * extendedWhereUnique (GA since v5) still allows an additional non-unique
 * filter alongside the unique field, so the market can be enforced before the
 * query runs rather than validated on the result.
 */
const UNIQUE_WHERE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete']);

const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);

const logger = new Logger('PrismaMarketScope');

interface ScopeDecision {
  marketId: string;
  enforce: boolean;
}

function currentScope(): ScopeDecision | null {
  const store = getAccessControlStore();
  if (!store) return null;
  if (store.dataScopeMode === 'legacy') return null;
  // `bypassMarketScope` is the single decision point; MarketContextService
  // already folds global-admin status and explicit market selection into it.
  if (isMarketScopeBypassed()) return null;
  if (!store.marketId) return null;
  return { marketId: store.marketId, enforce: store.dataScopeMode === 'enforce' };
}

function withMarketFilter(where: unknown, marketId: string) {
  return where ? { AND: [where, { marketId }] } : { marketId };
}

/**
 * Forces `marketId` onto write payloads.
 *
 * A caller-supplied value is overwritten rather than preserved: request data
 * reaches Prisma from DTOs, so honouring it would let a client create rows in
 * a market it is not acting in. Code that legitimately needs to write into
 * another market must declare that through `withoutMarketScope(reason, …)` or
 * `withSystemActor`, which is audited.
 */
function withMarketData(data: unknown, marketId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) =>
      row && typeof row === 'object' ? { ...(row as Record<string, unknown>), marketId } : row,
    );
  }
  if (data && typeof data === 'object') {
    return { ...(data as Record<string, unknown>), marketId };
  }
  return data;
}

/**
 * Strips `marketId` from an update payload so an update cannot re-home a row
 * into another market. Re-homing is a deliberate, audited operation.
 */
function withoutMarketReassignment(data: unknown, marketId: string, context: string): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  if (!('marketId' in record)) return data;

  const requested = record.marketId;
  const value =
    requested && typeof requested === 'object'
      ? (requested as Record<string, unknown>).set
      : requested;
  if (value === marketId) return data;

  logger.warn(`Blocked market reassignment on ${context} (attempted ${String(value)})`);
  const { marketId: _dropped, ...rest } = record;
  return rest;
}

function belongsToOtherMarket(result: unknown, marketId: string): boolean {
  if (!result || typeof result !== 'object') return false;
  const rowMarket = (result as Record<string, unknown>).marketId;
  // `marketId` is nullable during rollout and may not be selected at all; only
  // a concrete mismatch is treated as a cross-market read.
  if (typeof rowMarket !== 'string') return false;
  return rowMarket !== marketId;
}

/**
 * Injects the active market into a single query against a market-scoped model.
 * Exported separately from the extension so it can be exercised directly in
 * tests — `Prisma.defineExtension` returns an opaque function.
 */
export async function applyMarketScope(params: {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}): Promise<unknown> {
  const { model, operation, query: run } = params;
  const rawArgs = params.args;

  const scope = currentScope();
  if (!scope || !model || !MARKET_SCOPED_MODELS.has(model)) {
    return run(rawArgs);
  }

  const { marketId, enforce } = scope;
  const typedArgs: Record<string, unknown> =
    rawArgs && typeof rawArgs === 'object' ? (rawArgs as Record<string, unknown>) : {};

  if (FILTERABLE_WHERE_OPS.has(operation)) {
    if (!enforce) {
      logger.debug(`shadow: would scope ${model}.${operation} to market ${marketId}`);
      return run(rawArgs);
    }
    const scoped: Record<string, unknown> = {
      ...typedArgs,
      where: withMarketFilter(typedArgs.where, marketId),
    };
    if ('data' in typedArgs) {
      scoped.data = withoutMarketReassignment(typedArgs.data, marketId, `${model}.${operation}`);
    }
    return run(scoped);
  }

  if (CREATE_OPS.has(operation)) {
    if (!enforce) {
      logger.debug(`shadow: would stamp ${model}.${operation} with market ${marketId}`);
      return run(rawArgs);
    }
    return run({ ...typedArgs, data: withMarketData(typedArgs.data, marketId) });
  }

  if (operation === 'upsert') {
    if (!enforce) {
      logger.debug(`shadow: would stamp ${model}.upsert with market ${marketId}`);
      return run(rawArgs);
    }
    // The `where` must be scoped too. Without it a matching unique key in
    // another market would be updated in place; with it, Prisma finds no match
    // in this market and inserts the (market-stamped) `create` branch instead.
    return run({
      ...typedArgs,
      where: withMarketFilter(typedArgs.where, marketId),
      create: withMarketData(typedArgs.create, marketId),
      update: withoutMarketReassignment(typedArgs.update, marketId, `${model}.upsert`),
    });
  }

  if (UNIQUE_WHERE_OPS.has(operation)) {
    if (!enforce) {
      const result = await run(rawArgs);
      if (belongsToOtherMarket(result, marketId)) {
        logger.warn(`shadow: ${model}.${operation} crossed markets (row market != ${marketId})`);
      }
      return result;
    }
    const scoped: Record<string, unknown> = {
      ...typedArgs,
      where: withMarketFilter(typedArgs.where, marketId),
    };
    if ('data' in typedArgs) {
      scoped.data = withoutMarketReassignment(typedArgs.data, marketId, `${model}.${operation}`);
    }
    return run(scoped);
  }

  return run(rawArgs);
}

/**
 * Injects the active market into queries against market-scoped models.
 *
 * Implemented as a client extension rather than by patching delegates: only
 * extensions run for queries issued inside `$transaction`, which is where most
 * of the write path lives.
 */
export const marketScopeExtension = Prisma.defineExtension({
  name: 'market-scope',
  query: {
    $allModels: {
      // The per-model argument unions are too large for TypeScript to
      // represent across every model at once, so the shared handler is typed
      // loosely; Prisma validates the shapes at runtime.
      $allOperations: applyMarketScope as never,
    },
  },
});
