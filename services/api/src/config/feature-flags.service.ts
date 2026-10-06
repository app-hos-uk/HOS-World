import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export enum FeatureFlag {
  FOUNDING_MEMBERS = 'FOUNDING_MEMBERS',
  EMAIL_TEMPLATE_OVERRIDES = 'EMAIL_TEMPLATE_OVERRIDES',
  ADMIN_EMAIL_COMPOSE = 'ADMIN_EMAIL_COMPOSE',
  LOYALTY_PROGRAMME = 'LOYALTY_PROGRAMME',
  AMBASSADOR_PROGRAMME = 'AMBASSADOR_PROGRAMME',
  BRAND_PARTNERSHIPS = 'BRAND_PARTNERSHIPS',
  CLICK_COLLECT = 'CLICK_COLLECT',
  DIGITAL_PRODUCTS = 'DIGITAL_PRODUCTS',
  INFLUENCER_STOREFRONTS = 'INFLUENCER_STOREFRONTS',
  GUEST_CHECKOUT = 'GUEST_CHECKOUT',
  AI_RECOMMENDATIONS = 'AI_RECOMMENDATIONS',
  POS_INTEGRATION = 'POS_INTEGRATION',
  MULTI_CURRENCY = 'MULTI_CURRENCY',
  /** HOS → Xero daily journals (offline by default; also requires ACCOUNTING_ENABLED). */
  ACCOUNTING_XERO = 'ACCOUNTING_XERO',
  /** Stripe card payment on the customer phone for in-store shipping. Off = staff confirms cash/card at the counter. */
  SHIPPING_ONLINE_PAYMENT = 'SHIPPING_ONLINE_PAYMENT',
  /** Marketplace-owned catalog. Default false: publish keeps writing seller-owned products. */
  MARKETPLACE_OWNED_CATALOG = 'MARKETPLACE_OWNED_CATALOG',
  /** Multiple active vendor offers. Default false: one active listing per product. */
  MULTI_VENDOR_OFFERS = 'MULTI_VENDOR_OFFERS',
  /** Anchor-store gating. Default false: POS earn is not gated until outlets are backfilled. */
  ANCHOR_STORE_GATING = 'ANCHOR_STORE_GATING',
  /** POS product push. Default true: push stays available until staging turns it off. */
  POS_PRODUCT_PUSH = 'POS_PRODUCT_PUSH',
  /** Per-market catalogue rows. Default false: products with no ProductMarket stay visible everywhere. */
  MARKET_CATALOG = 'MARKET_CATALOG',
}

const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  [FeatureFlag.FOUNDING_MEMBERS]: true,
  [FeatureFlag.EMAIL_TEMPLATE_OVERRIDES]: true,
  [FeatureFlag.ADMIN_EMAIL_COMPOSE]: true,
  [FeatureFlag.LOYALTY_PROGRAMME]: true,
  [FeatureFlag.AMBASSADOR_PROGRAMME]: true,
  [FeatureFlag.BRAND_PARTNERSHIPS]: true,
  [FeatureFlag.CLICK_COLLECT]: true,
  [FeatureFlag.DIGITAL_PRODUCTS]: true,
  [FeatureFlag.INFLUENCER_STOREFRONTS]: true,
  [FeatureFlag.GUEST_CHECKOUT]: true,
  [FeatureFlag.AI_RECOMMENDATIONS]: false,
  [FeatureFlag.POS_INTEGRATION]: false,
  [FeatureFlag.MULTI_CURRENCY]: false,
  [FeatureFlag.ACCOUNTING_XERO]: false,
  [FeatureFlag.SHIPPING_ONLINE_PAYMENT]: false,
  [FeatureFlag.MARKETPLACE_OWNED_CATALOG]: false,
  [FeatureFlag.MULTI_VENDOR_OFFERS]: false,
  [FeatureFlag.ANCHOR_STORE_GATING]: false,
  [FeatureFlag.POS_PRODUCT_PUSH]: true,
  [FeatureFlag.MARKET_CATALOG]: false,
};

const CACHE_TTL_MS = 30_000;
const FEATURE_FLAG_CATEGORY = 'feature_flag';

/** Effective flags for one market, plus the global defaults and explicit overrides. */
export interface FeatureFlagMarketView {
  flags: Record<string, boolean>;
  global: Record<string, boolean>;
  overrides: Record<string, boolean>;
}

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly flags = new Map<string, boolean>();
  private readonly envDefaults = new Map<string, boolean>();
  /** flag -> marketId -> enabled. Only explicit per-market rows. */
  private marketFlags = new Map<string, Map<string, boolean>>();
  /** Flags that have a real global row (marketId null), not a lone backfilled market row. */
  private explicitGlobalFlags = new Set<string>();
  private lastRefreshAt = 0;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    for (const [flag, defaultValue] of Object.entries(FLAG_DEFAULTS)) {
      const envKey = `FF_${flag}`;
      const envValue = this.configService.get<string>(envKey);
      const resolved =
        envValue !== undefined ? envValue === 'true' || envValue === '1' : defaultValue;
      this.flags.set(flag, resolved);
      this.envDefaults.set(flag, resolved);
    }

    await this.refreshFromDb();

    const enabled = [...this.flags.entries()].filter(([, v]) => v).map(([k]) => k);
    this.logger.log(
      `Feature flags loaded: ${enabled.length} enabled, ${this.flags.size - enabled.length} disabled`,
    );
  }

  /**
   * Cache-only lookup. This is the previous synchronous `isEnabled`.
   * When `marketId` is set, an in-memory override wins; otherwise the global flag is used.
   * Callers that cannot await should keep using this (or `isEnabled(flag)` with no market).
   */
  isEnabledSync(flag: FeatureFlag, marketId?: string): boolean {
    this.maybeRefresh();
    return this.readCached(flag, marketId);
  }

  /**
   * Global checks stay synchronous so existing callers keep a boolean.
   * A market id does a fresh database read, then falls back to the global flag.
   */
  isEnabled(flag: FeatureFlag): boolean;
  isEnabled(flag: FeatureFlag, marketId: string): Promise<boolean>;
  isEnabled(flag: FeatureFlag, marketId?: string): boolean | Promise<boolean> {
    if (marketId?.trim()) {
      return this.resolveMarketFlag(flag, marketId.trim());
    }
    return this.isEnabledSync(flag);
  }

  getAll(): Record<string, boolean> {
    this.maybeRefresh();
    return this.readGlobalFlags();
  }

  /**
   * Effective values for one market. Overrides replace the global flag only
   * where a market-specific row exists.
   */
  async getMarketView(marketId: string): Promise<FeatureFlagMarketView> {
    await this.refreshFromDb();
    const global = this.readGlobalFlags();
    const overrides: Record<string, boolean> = {};
    for (const [flag, byMarket] of this.marketFlags) {
      if (!byMarket.has(marketId)) continue;
      // A single backfilled row is the global value until a real global row exists.
      if (!this.explicitGlobalFlags.has(flag) && byMarket.size === 1) continue;
      overrides[flag] = byMarket.get(marketId) as boolean;
    }
    const flags: Record<string, boolean> = { ...global };
    for (const [flag, enabled] of Object.entries(overrides)) {
      flags[flag] = enabled;
    }
    return { flags, global, overrides };
  }

  async setFlag(
    flag: FeatureFlag,
    enabled: boolean,
    marketId?: string,
  ): Promise<{ persisted: boolean }> {
    const scopedMarketId = marketId?.trim() || undefined;
    if (scopedMarketId) {
      this.rememberMarketFlag(flag, scopedMarketId, enabled);
    } else {
      this.flags.set(flag, enabled);
    }

    let persisted = false;
    try {
      await this.persistFlag(flag, enabled, scopedMarketId);
      persisted = true;
    } catch (err) {
      const detail =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
          ? 'unique (category, key) still blocks a second row — apply the platform_settings market uniqueness migration'
          : (err as Error).message;
      this.logger.warn(`Could not persist flag ${flag} — ${detail}`);
    }
    this.lastRefreshAt = Date.now();
    this.logger.log(
      `Feature flag ${flag} set to ${enabled}${scopedMarketId ? ` (market ${scopedMarketId})` : ''} (persisted=${persisted})`,
    );
    return { persisted };
  }

  private refreshPromise: Promise<void> | null = null;

  private maybeRefresh() {
    if (Date.now() - this.lastRefreshAt > CACHE_TTL_MS) {
      this.lastRefreshAt = Date.now();
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshFromDb()
          .catch((err) =>
            this.logger.warn(`Flag refresh failed: ${(err as Error).message}`),
          )
          .finally(() => { this.refreshPromise = null; });
      }
    }
  }

  private readCached(flag: string, marketId?: string): boolean {
    if (marketId) {
      const override = this.marketFlags.get(flag)?.get(marketId);
      if (override !== undefined) return override;
    }
    return this.flags.get(flag) ?? false;
  }

  private readGlobalFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [key, value] of this.flags) {
      result[key] = value;
    }
    return result;
  }

  private rememberMarketFlag(flag: string, marketId: string, enabled: boolean) {
    let byMarket = this.marketFlags.get(flag);
    if (!byMarket) {
      byMarket = new Map();
      this.marketFlags.set(flag, byMarket);
    }
    byMarket.set(marketId, enabled);
  }

  private forgetMarketFlag(flag: string, marketId: string) {
    const byMarket = this.marketFlags.get(flag);
    if (!byMarket) return;
    byMarket.delete(marketId);
    if (byMarket.size === 0) this.marketFlags.delete(flag);
  }

  /**
   * Fresh row lookup. Missing override falls back to the global cache.
   * A database error falls back to the cached override, then the global flag.
   */
  private async resolveMarketFlag(flag: FeatureFlag, marketId: string): Promise<boolean> {
    try {
      const row = await this.prisma.platformSetting.findFirst({
        where: { category: FEATURE_FLAG_CATEGORY, key: flag, marketId },
      });
      if (row) {
        const enabled = row.value === 'true';
        this.rememberMarketFlag(flag, marketId, enabled);
        return enabled;
      }
      this.forgetMarketFlag(flag, marketId);
    } catch (err) {
      this.logger.warn(
        `Market feature flag lookup failed for ${flag}/${marketId}: ${(err as Error).message}`,
      );
      return this.isEnabledSync(flag, marketId);
    }
    return this.isEnabledSync(flag);
  }

  /**
   * marketId is nullable and the historical unique is (category, key), so
   * Prisma upsert on a compound market key is not available. findFirst +
   * create/update keeps global and per-market rows distinct.
   */
  private async persistFlag(flag: string, enabled: boolean, marketId?: string) {
    const value = String(enabled);
    if (marketId) {
      const existing = await this.prisma.platformSetting.findFirst({
        where: { category: FEATURE_FLAG_CATEGORY, key: flag, marketId },
      });
      if (existing) {
        await this.prisma.platformSetting.update({
          where: { id: existing.id },
          data: { value },
        });
        return;
      }
      await this.preserveLegacyGlobalRow(flag);
      await this.prisma.platformSetting.create({
        data: { category: FEATURE_FLAG_CATEGORY, key: flag, value, marketId },
      });
      return;
    }

    const existingGlobal = await this.prisma.platformSetting.findFirst({
      where: { category: FEATURE_FLAG_CATEGORY, key: flag, marketId: null },
    });
    if (existingGlobal) {
      await this.prisma.platformSetting.update({
        where: { id: existingGlobal.id },
        data: { value },
      });
      return;
    }

    try {
      await this.prisma.platformSetting.create({
        data: { category: FEATURE_FLAG_CATEGORY, key: flag, value },
      });
      this.explicitGlobalFlags.add(flag);
      return;
    } catch (err) {
      // The pre-migration unique index is (category, key), so a second row
      // cannot be inserted. Update the single existing row instead.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err;
      }
    }

    const legacy = await this.prisma.platformSetting.findMany({
      where: { category: FEATURE_FLAG_CATEGORY, key: flag },
    });
    if (legacy.length === 1) {
      await this.prisma.platformSetting.update({
        where: { id: legacy[0].id },
        data: { value },
      });
      if (legacy[0].marketId) {
        this.rememberMarketFlag(flag, legacy[0].marketId, enabled);
      }
      return;
    }

    throw new Error(
      `Could not persist global flag ${flag} separately from market overrides`,
    );
  }

  /**
   * Copy a single pre-market row into an explicit global (marketId null) row
   * before inserting a second, market-scoped row. If the old unique index is
   * still in place this insert fails and the caller surfaces persisted=false.
   */
  private async preserveLegacyGlobalRow(flag: string) {
    const rows = await this.prisma.platformSetting.findMany({
      where: { category: FEATURE_FLAG_CATEGORY, key: flag },
    });
    if (rows.some((row) => !row.marketId) || rows.length !== 1) return;
    const legacy = rows[0];
    if (!legacy.marketId) return;
    await this.prisma.platformSetting.create({
      data: {
        category: FEATURE_FLAG_CATEGORY,
        key: flag,
        value: legacy.value,
        marketId: null,
      },
    });
    this.flags.set(flag, legacy.value === 'true');
    this.explicitGlobalFlags.add(flag);
  }

  private async refreshFromDb() {
    try {
      const rows = await this.prisma.platformSetting.findMany({
        where: { category: FEATURE_FLAG_CATEGORY },
      });

      const nextMarket = new Map<string, Map<string, boolean>>();
      const explicitGlobal = new Set<string>();
      for (const row of rows) {
        if (!row.marketId) {
          explicitGlobal.add(row.key);
          continue;
        }
        let byMarket = nextMarket.get(row.key);
        if (!byMarket) {
          byMarket = new Map();
          nextMarket.set(row.key, byMarket);
        }
        byMarket.set(row.marketId, row.value === 'true');
      }
      this.marketFlags = nextMarket;
      this.explicitGlobalFlags = explicitGlobal;

      for (const [flag, envDefault] of this.envDefaults) {
        const globalRow = rows.find((row) => row.key === flag && !row.marketId);
        if (globalRow) {
          this.flags.set(flag, globalRow.value === 'true');
          continue;
        }
        // Rows written before per-market flags were backfilled onto the US
        // market. While that is the only stored row, it remains the global value.
        const scoped = rows.filter((row) => row.key === flag && row.marketId);
        if (scoped.length === 1) {
          this.flags.set(flag, scoped[0].value === 'true');
          continue;
        }
        this.flags.set(flag, envDefault);
      }
      this.lastRefreshAt = Date.now();
    } catch {
      this.logger.warn('platform_settings table not available yet — using env/defaults');
    }
  }
}
