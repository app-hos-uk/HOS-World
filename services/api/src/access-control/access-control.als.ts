import { AsyncLocalStorage } from 'async_hooks';
import type { AccessControlMode, AccessScopeType } from '@hos-marketplace/shared-types';

export type ActorKind = 'user' | 'system';

export interface AccessControlStore {
  actorKind: ActorKind;
  /** Set for HTTP users; omitted for system actors unless impersonating. */
  userId?: string;
  /** Platform UserRole (CUSTOMER, ADMIN, …) */
  userRole?: string;
  marketId: string | null;
  marketCode: string | null;
  tenantId: string | null;
  storeId: string | null;
  /** Widest assignment scope that applies to the current request. */
  scopeType: AccessScopeType;
  /** Global admin (ADMIN + GLOBAL assignment, or ADMIN with no assignments). */
  isGlobalAdmin: boolean;
  /** All market ids the actor may access (empty + global admin = all). */
  allowedMarketIds: string[];
  /** Skip Prisma marketId injection (audited escape hatch). */
  bypassMarketScope: boolean;
  dataScopeMode: AccessControlMode;
  /** Reason recorded when bypassMarketScope is set. */
  bypassReason?: string;
}

export const accessControlStorage = new AsyncLocalStorage<AccessControlStore>();

export function getAccessControlStore(): AccessControlStore | undefined {
  return accessControlStorage.getStore();
}

export function getActiveMarketId(): string | null {
  return getAccessControlStore()?.marketId ?? null;
}

export function isMarketScopeBypassed(): boolean {
  return getAccessControlStore()?.bypassMarketScope === true;
}

export function isGlobalAdmin(): boolean {
  return getAccessControlStore()?.isGlobalAdmin === true;
}

/**
 * Run `fn` with market-scope injection disabled. Every use must supply a reason
 * so shadow/enforce logs can attribute the escape hatch.
 */
export function withoutMarketScope<T>(reason: string, fn: () => T): T {
  const current = getAccessControlStore();
  if (!current) {
    const ephemeral: AccessControlStore = {
      actorKind: 'system',
      marketId: null,
      marketCode: null,
      tenantId: null,
      storeId: null,
      scopeType: 'GLOBAL',
      isGlobalAdmin: true,
      allowedMarketIds: [],
      bypassMarketScope: true,
      dataScopeMode: 'legacy',
      bypassReason: reason,
    };
    return accessControlStorage.run(ephemeral, fn);
  }
  return accessControlStorage.run(
    { ...current, bypassMarketScope: true, bypassReason: reason },
    fn,
  );
}

export function runWithAccessControl<T>(store: AccessControlStore, fn: () => T): T {
  return accessControlStorage.run(store, fn);
}

/**
 * Placeholder installed by AccessControlMiddleware before the market context
 * is known. It grants nothing and leaves data scoping inert.
 */
export function emptyAccessControlStore(): AccessControlStore {
  return {
    actorKind: 'system',
    marketId: null,
    marketCode: null,
    tenantId: null,
    storeId: null,
    scopeType: 'MARKET',
    isGlobalAdmin: false,
    allowedMarketIds: [],
    bypassMarketScope: false,
    dataScopeMode: 'legacy',
  };
}

/**
 * Copies a resolved store into the container the middleware opened, so the
 * context reaches code that already captured the ALS scope. Falls back to
 * `enterWith` when no container exists (e.g. non-HTTP entry points).
 */
export function applyAccessControlStore(next: AccessControlStore): void {
  const current = accessControlStorage.getStore();
  if (!current) {
    accessControlStorage.enterWith(next);
    return;
  }
  Object.assign(current, next);
}
