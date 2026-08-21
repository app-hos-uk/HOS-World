import { Injectable, Logger } from '@nestjs/common';
import { MarketService, type MarketRow } from './market.service';
import { PolicyService, type AssignmentSnapshot } from './policy.service';
import { type AccessControlStore, runWithAccessControl } from './access-control.als';
import type { AccessScopeType } from '@hos-marketplace/shared-types';
import { AccessModeService } from './access-mode.service';

export const MARKET_HEADER = 'x-market-code';

export interface RequestUserLike {
  id?: string;
  role?: string;
  permissionRoleId?: string | null;
  homeMarketId?: string | null;
  storeId?: string | null;
  defaultTenantId?: string | null;
}

export interface ResolvedMarketContext {
  market: MarketRow | null;
  store: AccessControlStore;
  assignments: AssignmentSnapshot[];
}

@Injectable()
export class MarketContextService {
  private readonly logger = new Logger(MarketContextService.name);

  constructor(
    private readonly markets: MarketService,
    private readonly policy: PolicyService,
    private readonly modes: AccessModeService,
  ) {}

  extractHint(req: {
    headers?: Record<string, unknown>;
    hostname?: string;
    header?: (name: string) => string | undefined;
  }): { code?: string; host?: string } {
    const headerRaw =
      (typeof req.header === 'function' ? req.header(MARKET_HEADER) : undefined) ||
      (req.headers?.[MARKET_HEADER] as string | undefined) ||
      (req.headers?.['x-market-code'] as string | undefined);
    const code = typeof headerRaw === 'string' ? headerRaw.trim().toUpperCase() : undefined;
    const host = req.hostname;
    return { code: code || undefined, host };
  }

  async resolve(
    hint: { code?: string; host?: string },
    user?: RequestUserLike | null,
  ): Promise<ResolvedMarketContext> {
    const defaultMarket = await this.markets.getDefault();
    const all = await this.markets.listActive();
    const assignments = user?.id
      ? await this.policy.loadAssignments({
          id: user.id,
          role: user.role,
          permissionRoleId: user.permissionRoleId,
        })
      : [];
    const isGlobalAdmin = user?.role ? this.policy.isGlobalAdmin(user.role, assignments) : false;
    const allowedMarketIds = user?.id
      ? this.policy.allowedMarketIds(
          assignments,
          all.map((m) => m.id),
        )
      : [];

    let market: MarketRow | null = null;

    if (hint.code) {
      const requested = await this.markets.findByCode(hint.code);
      if (requested) {
        if (this.canUseMarket(requested, user, isGlobalAdmin, allowedMarketIds)) {
          market = requested;
        } else {
          this.logger.warn(
            `Rejected market hint ${hint.code} for user ${user?.id ?? 'anonymous'} (not in allowed set)`,
          );
        }
      }
    }

    const marketExplicitlySelected = market !== null;

    if (!market && user?.homeMarketId) {
      market = await this.markets.findById(user.homeMarketId);
    }

    if (!market) {
      market = defaultMarket;
    }

    const widestScope: AccessScopeType = isGlobalAdmin
      ? 'GLOBAL'
      : assignments.some((a) => a.scopeType === 'MARKET')
        ? 'MARKET'
        : assignments.some((a) => a.scopeType === 'TENANT')
          ? 'TENANT'
          : assignments.some((a) => a.scopeType === 'STORE')
            ? 'STORE'
            : user?.role?.toUpperCase() === 'ADMIN'
              ? 'GLOBAL'
              : 'MARKET';

    const store: AccessControlStore = {
      actorKind: user?.id ? 'user' : 'system',
      userId: user?.id,
      userRole: user?.role,
      marketId: market?.id ?? null,
      marketCode: market?.code ?? null,
      tenantId: user?.defaultTenantId ?? null,
      storeId: user?.storeId ?? null,
      scopeType: widestScope,
      isGlobalAdmin,
      allowedMarketIds,
      // A global admin who explicitly selected a market is scoped to it —
      // otherwise the market switcher would be a no-op for the very people who
      // need it. Bypass only applies when no market was requested.
      bypassMarketScope: isGlobalAdmin && !marketExplicitlySelected,
      dataScopeMode: this.modes.getDataScopeMode(),
    };

    return { market, store, assignments };
  }

  /**
   * Decides whether the caller may act in the market they asked for via
   * `x-market-code`.
   *
   * Switching market narrows the data a request can see rather than widening
   * it, so unnarrowed actors (customers, sellers) may pick any active market —
   * that is the storefront locale/currency selector. Actors whose assignments
   * pin them to specific markets, tenants or stores may not switch away.
   */
  private canUseMarket(
    requested: MarketRow,
    user: RequestUserLike | null | undefined,
    isGlobalAdmin: boolean,
    allowedMarketIds: string[],
  ): boolean {
    if (isGlobalAdmin) return true;
    if (!requested.isActive) return false;
    if (allowedMarketIds.length > 0) {
      return allowedMarketIds.includes(requested.id);
    }
    // Pinned to a home market by their user record — no switching.
    if (user?.homeMarketId) {
      return user.homeMarketId === requested.id;
    }
    return true;
  }

  run<T>(store: AccessControlStore, fn: () => T): T {
    return runWithAccessControl(store, fn);
  }
}
