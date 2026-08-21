import type { AccessControlMode } from '@hos-marketplace/shared-types';
import {
  type AccessControlStore,
  runWithAccessControl,
  withoutMarketScope,
} from './access-control.als';

export interface SystemActorOptions {
  /** Required unless `allMarkets` is true. */
  marketId?: string | null;
  marketCode?: string | null;
  tenantId?: string | null;
  storeId?: string | null;
  /** Cross-market job (reconciliation, global reports). Logs as GLOBAL. */
  allMarkets?: boolean;
  reason: string;
  dataScopeMode?: AccessControlMode;
}

/**
 * Wrap a non-HTTP entry point (BullMQ processor, Stripe webhook, cron, seed)
 * so market scope is explicit instead of silently falling through to the
 * process-wide default or bypassing isolation.
 */
export function withSystemActor<T>(options: SystemActorOptions, fn: () => T): T {
  const store: AccessControlStore = {
    actorKind: 'system',
    marketId: options.allMarkets ? null : (options.marketId ?? null),
    marketCode: options.marketCode ?? null,
    tenantId: options.tenantId ?? null,
    storeId: options.storeId ?? null,
    scopeType: options.allMarkets ? 'GLOBAL' : 'MARKET',
    isGlobalAdmin: Boolean(options.allMarkets),
    allowedMarketIds: options.marketId ? [options.marketId] : [],
    bypassMarketScope: Boolean(options.allMarkets),
    dataScopeMode: options.dataScopeMode ?? 'legacy',
    bypassReason: options.allMarkets ? options.reason : undefined,
  };

  if (options.allMarkets) {
    return withoutMarketScope(options.reason, () => runWithAccessControl(store, fn));
  }
  return runWithAccessControl(store, fn);
}

export async function withSystemActorAsync<T>(
  options: SystemActorOptions,
  fn: () => Promise<T>,
): Promise<T> {
  return withSystemActor(options, fn);
}
