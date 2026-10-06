import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { FeatureFlagsService, FeatureFlag } from '../../config/feature-flags.service';
import { PlatformRegionService } from '../../config/platform-region.service';
import { PrismaService } from '../../database/prisma.service';
import { isTruthy } from '../../common/utils/config';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';
import { isPosRuntimeEnabled } from '../../pos/pos-enabled';
import { campaignEarnRateToFraction, DEFAULT_CAMPAIGN_BONUS_EARN_RATE } from '../qualifying-amount';

export const LOYALTY_SETTINGS_CONFIG_KEY = 'LOYALTY_PROGRAMME_SETTINGS';
export const LOYALTY_SETTINGS_CACHE_KEY = 'loyalty:settings:resolved';

export type LoyaltyProgrammeSettings = {
  defaultEarnRate: number;
  defaultRedeemValue: number;
  minRedemptionPoints: number;
  /** Minimum qualifying merchandise spend to redeem the Welcome Reward (signup bonus). */
  welcomeRewardMinPurchase: number;
  pointsExpiryMonths: number;
  cardPrefix: string;
  redemptionAtCheckout: boolean;
  posVoucherEnabled: boolean;
  posRedemptionMethod: 'GIFT_CARD' | 'PROMO_CODE';
  posVoucherMinAmount: number;
  posVoucherMaxAmount: number;
  giftCardCatalogAmounts: string;
  giftCardDefaultCurrency: string;
  restoreBurnOnCancel: boolean;
  clawEarnOnCancel: boolean;
  restoreBurnOnReturn: boolean;
  clawEarnOnReturn: boolean;
  /** Minimum purchase (currency units) for Enchanted Circle welcome-reward redemption. */
  campaignMinPurchaseThreshold: number;
  /** Fraction of qualifying amount earned as campaign bonus (0.20 = 20%). */
  campaignBonusEarnRate: number;
  /** Loyalty points per currency unit of campaign bonus. */
  campaignBonusPointsPerDollar: number;
  /** Max % of qualifying subtotal payable by loyalty points (1–100). 100 = no cap. */
  maxRedemptionPercent: number;
  /** Max points a member can burn per single order/transaction. 0 = unlimited. */
  maxRedemptionPointsPerOrder: number;
  /** Max total points a member can burn in a calendar day. 0 = unlimited. */
  dailyRedemptionPointsLimit: number;
};

export type LoyaltyRuntimeStatus = {
  loyaltyRuntimeEnabled: boolean;
  loyaltyEnv: boolean;
  loyaltyFlag: boolean;
  posRuntimeEnabled: boolean;
  posEnv: boolean;
  posFlag: boolean;
  accountingEnv: boolean;
  accountingFlag: boolean;
  settingsSource: 'database' | 'env';
  settings: LoyaltyProgrammeSettings;
};

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return isTruthy(v);
  return Boolean(v);
}

type ResolvedSettings = { settings: LoyaltyProgrammeSettings; source: 'database' | 'env' };

@Injectable()
export class LoyaltySettingsService {
  private readonly logger = new Logger(LoyaltySettingsService.name);
  private localCache: { at: number; value: ResolvedSettings } | null = null;
  /** Market-scoped snapshots. Kept apart from `localCache` so a market read cannot replace the platform value. */
  private marketLocalCache = new Map<string, { at: number; value: ResolvedSettings }>();
  /** Redis keys written for market merges, so a platform save can evict them without a SCAN. */
  private knownSharedMarketKeys = new Set<string>();
  /**
   * Bounds how long any single instance can serve a stale value after another
   * instance saves. Kept short because the backing read is one indexed
   * single-row lookup; the shared cache (Redis, when configured) absorbs the
   * repeated reads across instances.
   */
  private readonly cacheTtlMs: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    private platformRegion: PlatformRegionService,
    @Optional() private sharedCache?: CacheService,
  ) {
    this.cacheTtlMs = Math.max(0, num(this.config.get('LOYALTY_SETTINGS_CACHE_TTL_MS'), 2_000));
  }

  async envDefaults(): Promise<LoyaltyProgrammeSettings> {
    const regionCurrency = await this.platformRegion.getCurrency();
    return {
      defaultEarnRate: num(this.config.get('LOYALTY_DEFAULT_EARN_RATE'), 1),
      defaultRedeemValue: num(this.config.get('LOYALTY_DEFAULT_REDEEM_VALUE'), 0.01),
      minRedemptionPoints: Math.max(
        0,
        Math.floor(num(this.config.get('LOYALTY_MIN_REDEMPTION_POINTS'), 100)),
      ),
      welcomeRewardMinPurchase: Math.max(
        0,
        num(this.config.get('LOYALTY_WELCOME_MIN_PURCHASE'), 85),
      ),
      pointsExpiryMonths: Math.max(
        0,
        Math.floor(num(this.config.get('LOYALTY_POINTS_EXPIRY_MONTHS'), 24)),
      ),
      cardPrefix: String(this.config.get('LOYALTY_CARD_PREFIX') || 'HOS').slice(0, 16),
      redemptionAtCheckout: isTruthy(
        this.config.get<string>('LOYALTY_REDEMPTION_AT_CHECKOUT') ?? 'true',
      ),
      posVoucherEnabled: isTruthy(this.config.get<string>('LOYALTY_POS_VOUCHER_ENABLED')),
      posRedemptionMethod: this.normalizeRedemptionMethod(
        this.config.get<string>('LOYALTY_POS_REDEMPTION_METHOD'),
      ),
      posVoucherMinAmount: num(this.config.get('POS_GIFT_CARD_MIN_AMOUNT'), 1),
      posVoucherMaxAmount: num(this.config.get('POS_GIFT_CARD_MAX_AMOUNT'), 500),
      giftCardCatalogAmounts:
        this.config.get<string>('GIFT_CARD_CATALOG_AMOUNTS') || '25,50,100,250,500',
      giftCardDefaultCurrency:
        this.config.get<string>('GIFT_CARD_DEFAULT_CURRENCY') || regionCurrency,
      restoreBurnOnCancel: true,
      clawEarnOnCancel: true,
      restoreBurnOnReturn: true,
      clawEarnOnReturn: true,
      campaignMinPurchaseThreshold: Math.max(
        0,
        num(this.config.get('LOYALTY_CAMPAIGN_MIN_PURCHASE_THRESHOLD'), 85),
      ),
      campaignBonusEarnRate: campaignEarnRateToFraction(
        this.config.get('LOYALTY_CAMPAIGN_BONUS_EARN_RATE') ?? DEFAULT_CAMPAIGN_BONUS_EARN_RATE,
        { treatOneAsProgrammeDefault: true },
      ),
      campaignBonusPointsPerDollar: Math.max(
        0,
        Math.floor(num(this.config.get('LOYALTY_CAMPAIGN_BONUS_POINTS_PER_DOLLAR'), 100)),
      ),
      maxRedemptionPercent: Math.min(
        100,
        Math.max(1, num(this.config.get('LOYALTY_MAX_REDEMPTION_PERCENT'), 100)),
      ),
      maxRedemptionPointsPerOrder: Math.max(
        0,
        Math.floor(num(this.config.get('LOYALTY_MAX_REDEMPTION_POINTS_PER_ORDER'), 0)),
      ),
      dailyRedemptionPointsLimit: Math.max(
        0,
        Math.floor(num(this.config.get('LOYALTY_DAILY_REDEMPTION_POINTS_LIMIT'), 0)),
      ),
    };
  }

  private normalize(
    partial: Partial<LoyaltyProgrammeSettings>,
    base: LoyaltyProgrammeSettings,
  ): LoyaltyProgrammeSettings {
    return {
      defaultEarnRate: Math.max(0, num(partial.defaultEarnRate, base.defaultEarnRate)),
      defaultRedeemValue: Math.max(0, num(partial.defaultRedeemValue, base.defaultRedeemValue)),
      minRedemptionPoints: Math.max(
        0,
        Math.floor(num(partial.minRedemptionPoints, base.minRedemptionPoints)),
      ),
      welcomeRewardMinPurchase: Math.max(
        0,
        num(
          partial.campaignMinPurchaseThreshold ?? partial.welcomeRewardMinPurchase,
          base.campaignMinPurchaseThreshold ?? base.welcomeRewardMinPurchase,
        ),
      ),
      pointsExpiryMonths: Math.max(
        0,
        Math.floor(num(partial.pointsExpiryMonths, base.pointsExpiryMonths)),
      ),
      cardPrefix: String(partial.cardPrefix ?? base.cardPrefix).slice(0, 16) || 'HOS',
      redemptionAtCheckout: bool(partial.redemptionAtCheckout, base.redemptionAtCheckout),
      posVoucherEnabled: bool(partial.posVoucherEnabled, base.posVoucherEnabled),
      posRedemptionMethod: this.normalizeRedemptionMethod(
        partial.posRedemptionMethod ?? base.posRedemptionMethod,
      ),
      posVoucherMinAmount: Math.max(0, num(partial.posVoucherMinAmount, base.posVoucherMinAmount)),
      posVoucherMaxAmount: Math.max(0, num(partial.posVoucherMaxAmount, base.posVoucherMaxAmount)),
      giftCardCatalogAmounts: String(partial.giftCardCatalogAmounts ?? base.giftCardCatalogAmounts),
      giftCardDefaultCurrency: String(
        partial.giftCardDefaultCurrency ?? base.giftCardDefaultCurrency,
      ).toUpperCase(),
      restoreBurnOnCancel: bool(partial.restoreBurnOnCancel, base.restoreBurnOnCancel),
      clawEarnOnCancel: bool(partial.clawEarnOnCancel, base.clawEarnOnCancel),
      restoreBurnOnReturn: bool(partial.restoreBurnOnReturn, base.restoreBurnOnReturn),
      clawEarnOnReturn: bool(partial.clawEarnOnReturn, base.clawEarnOnReturn),
      campaignMinPurchaseThreshold: Math.max(
        0,
        num(
          partial.campaignMinPurchaseThreshold ?? partial.welcomeRewardMinPurchase,
          base.campaignMinPurchaseThreshold ?? base.welcomeRewardMinPurchase,
        ),
      ),
      campaignBonusEarnRate: Math.max(0, campaignEarnRateToFraction(
        partial.campaignBonusEarnRate ?? base.campaignBonusEarnRate,
        { treatOneAsProgrammeDefault: true },
      )),
      campaignBonusPointsPerDollar: Math.max(
        0,
        Math.floor(num(partial.campaignBonusPointsPerDollar, base.campaignBonusPointsPerDollar)),
      ),
      maxRedemptionPercent: Math.min(
        100,
        Math.max(1, num(partial.maxRedemptionPercent, base.maxRedemptionPercent)),
      ),
      maxRedemptionPointsPerOrder: Math.max(
        0,
        Math.floor(num(partial.maxRedemptionPointsPerOrder, base.maxRedemptionPointsPerOrder)),
      ),
      dailyRedemptionPointsLimit: Math.max(
        0,
        Math.floor(num(partial.dailyRedemptionPointsLimit, base.dailyRedemptionPointsLimit)),
      ),
    };
  }

  private async readShared(cacheKey = LOYALTY_SETTINGS_CACHE_KEY): Promise<ResolvedSettings | null> {
    if (!this.sharedCache) return null;
    try {
      const hit = await this.sharedCache.get<ResolvedSettings>(cacheKey);
      if (hit?.settings) return hit;
    } catch {
      // Cache is best-effort; fall through to the database.
    }
    return null;
  }

  private marketCacheKey(marketId: string): string {
    return `${LOYALTY_SETTINGS_CACHE_KEY}:${marketId}`;
  }

  /**
   * Drops Redis snapshots that merge a market overlay onto platform settings.
   * A platform save or full invalidate must evict these so other instances
   * rematerialize instead of serving a merge built from the previous platform row.
   */
  private async dropSharedMarketSnapshots(): Promise<void> {
    if (!this.sharedCache) return;
    try {
      const delPattern = this.sharedCache.delPattern?.bind(this.sharedCache);
      if (delPattern) {
        await delPattern(`${LOYALTY_SETTINGS_CACHE_KEY}:*`);
      }
      for (const key of this.knownSharedMarketKeys) {
        await this.sharedCache.del(key);
      }
      this.knownSharedMarketKeys.clear();
    } catch {
      // Non-fatal.
    }
  }

  private async writeShared(
    value: ResolvedSettings,
    cacheKey = LOYALTY_SETTINGS_CACHE_KEY,
  ): Promise<void> {
    if (!this.sharedCache || this.cacheTtlMs <= 0) return;
    try {
      if (cacheKey !== LOYALTY_SETTINGS_CACHE_KEY) {
        this.knownSharedMarketKeys.add(cacheKey);
      }
      await this.sharedCache.set(cacheKey, value, this.cacheTtlMs);
    } catch {
      // Non-fatal: the database remains the source of truth.
    }
  }

  /** Drops the cached value locally and, when Redis-backed, for every instance. */
  async invalidate(): Promise<void> {
    this.localCache = null;
    this.marketLocalCache.clear();
    if (!this.sharedCache) return;
    try {
      await this.sharedCache.del(LOYALTY_SETTINGS_CACHE_KEY);
      await this.dropSharedMarketSnapshots();
    } catch {
      // Non-fatal.
    }
  }

  private isSettingsValue(value: unknown): value is Partial<LoyaltyProgrammeSettings> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * Platform settings, with an optional market overlay.
   * A boolean first argument is the historical `force` flag (`getResolved(true)`).
   * A string is a market id: market Config is merged on top of the platform row.
   */
  async getResolved(marketIdOrForce?: string | boolean, force = false): Promise<ResolvedSettings> {
    const marketId =
      typeof marketIdOrForce === 'string' && marketIdOrForce.trim()
        ? marketIdOrForce.trim()
        : undefined;
    const forceRefresh = typeof marketIdOrForce === 'boolean' ? marketIdOrForce : force;
    if (marketId) {
      return this.getResolvedForMarket(marketId, forceRefresh);
    }
    if (!forceRefresh && this.localCache && Date.now() - this.localCache.at < this.cacheTtlMs) {
      return this.localCache.value;
    }
    if (!forceRefresh) {
      const shared = await this.readShared();
      if (shared) {
        this.localCache = { at: Date.now(), value: shared };
        return shared;
      }
    }
    const base = await this.envDefaults();
    try {
      const row = await this.prisma.config.findFirst({
        where: { level: 'PLATFORM', levelId: 'PLATFORM', key: LOYALTY_SETTINGS_CONFIG_KEY },
      });
      let resolved: ResolvedSettings = { settings: base, source: 'env' };
      if (this.isSettingsValue(row?.value)) {
        resolved = {
          settings: this.normalize(row.value, base),
          source: 'database',
        };
      }
      this.localCache = { at: Date.now(), value: resolved };
      await this.writeShared(resolved);
      return resolved;
    } catch (e) {
      this.logger.warn(`Loyalty settings DB read failed: ${(e as Error).message}`);
      // Do not cache env fallbacks: a blip must not pin earn/redeem rates across instances.
      if (this.localCache) return this.localCache.value;
      return { settings: base, source: 'env' };
    }
  }

  /** Market Config row overlaid on the platform row (which itself overlays env defaults). */
  private async getResolvedForMarket(marketId: string, force: boolean): Promise<ResolvedSettings> {
    const cacheKey = this.marketCacheKey(marketId);
    this.knownSharedMarketKeys.add(cacheKey);
    if (!force) {
      const local = this.marketLocalCache.get(marketId);
      if (local && Date.now() - local.at < this.cacheTtlMs) return local.value;
      const shared = await this.readShared(cacheKey);
      if (shared) {
        this.marketLocalCache.set(marketId, { at: Date.now(), value: shared });
        return shared;
      }
    }

    const base = await this.envDefaults();
    try {
      const [globalRow, marketRow] = await Promise.all([
        this.prisma.config.findFirst({
          where: { level: 'PLATFORM', levelId: 'PLATFORM', key: LOYALTY_SETTINGS_CONFIG_KEY },
        }),
        this.prisma.config.findFirst({
          where: { level: 'MARKET', levelId: marketId, key: LOYALTY_SETTINGS_CONFIG_KEY },
        }),
      ]);

      let resolved: ResolvedSettings = { settings: base, source: 'env' };
      if (this.isSettingsValue(globalRow?.value)) {
        resolved = {
          settings: this.normalize(globalRow.value, base),
          source: 'database',
        };
      }
      if (this.isSettingsValue(marketRow?.value)) {
        resolved = {
          settings: this.normalize(marketRow.value, resolved.settings),
          source: 'database',
        };
      }
      this.marketLocalCache.set(marketId, { at: Date.now(), value: resolved });
      await this.writeShared(resolved, cacheKey);
      return resolved;
    } catch (e) {
      this.logger.warn(
        `Loyalty settings market read failed for ${marketId}: ${(e as Error).message}`,
      );
      const local = this.marketLocalCache.get(marketId);
      if (local) return local.value;
      return this.getResolved(true);
    }
  }

  async update(
    partial: Partial<LoyaltyProgrammeSettings>,
    updatedByUserId?: string,
    marketId?: string,
  ): Promise<LoyaltyProgrammeSettings> {
    const scopedMarketId = typeof marketId === 'string' ? marketId.trim() : '';
    const { settings: current } = scopedMarketId
      ? await this.getResolved(scopedMarketId, true)
      : await this.getResolved(true);
    const next = this.normalize(partial, current);
    if (next.posVoucherMinAmount > next.posVoucherMaxAmount) {
      throw new Error('posVoucherMinAmount cannot exceed posVoucherMaxAmount');
    }
    const value = {
      ...next,
      updatedByUserId: updatedByUserId ?? null,
      updatedAt: new Date().toISOString(),
    };
    const level = scopedMarketId ? 'MARKET' : 'PLATFORM';
    const levelId = scopedMarketId || 'PLATFORM';

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.config.findFirst({
        where: { level, levelId, key: LOYALTY_SETTINGS_CONFIG_KEY },
        select: { id: true },
      });
      if (existing) {
        await tx.config.update({ where: { id: existing.id }, data: { value } });
      } else {
        await tx.config.create({
          data: { level, levelId, key: LOYALTY_SETTINGS_CONFIG_KEY, value },
        });
      }
    });

    const resolved: ResolvedSettings = { settings: next, source: 'database' };
    if (scopedMarketId) {
      // Market overlays inherit platform defaults for unset fields. Drop the
      // platform snapshot so the next unscoped read rematerializes from DB
      // rather than serving a pre-overlay view.
      this.localCache = null;
      this.marketLocalCache.set(scopedMarketId, { at: Date.now(), value: resolved });
      await this.writeShared(resolved, this.marketCacheKey(scopedMarketId));
    } else {
      this.localCache = { at: Date.now(), value: resolved };
      // Merged market snapshots include the platform row, so drop them after a global save.
      this.marketLocalCache.clear();
      // Publish to the shared cache so other instances pick the new value up on
      // their next read instead of waiting out their own TTL.
      await this.writeShared(resolved);
      await this.dropSharedMarketSnapshots();
    }
    return next;
  }

  async getRuntimeStatus(): Promise<LoyaltyRuntimeStatus> {
    const { settings, source } = await this.getResolved(true);
    return {
      loyaltyRuntimeEnabled: isLoyaltyRuntimeEnabled(this.config, this.featureFlags),
      loyaltyEnv: isTruthy(this.config.get<string>('LOYALTY_ENABLED')),
      loyaltyFlag: this.featureFlags.isEnabled(FeatureFlag.LOYALTY_PROGRAMME),
      posRuntimeEnabled: isPosRuntimeEnabled(this.config, this.featureFlags),
      posEnv: isTruthy(this.config.get<string>('POS_ENABLED')),
      posFlag: this.featureFlags.isEnabled(FeatureFlag.POS_INTEGRATION),
      accountingEnv: isTruthy(this.config.get<string>('ACCOUNTING_ENABLED')),
      accountingFlag: this.featureFlags.isEnabled(FeatureFlag.ACCOUNTING_XERO),
      settingsSource: source,
      settings,
    };
  }

  parseCatalogAmounts(csv: string): number[] {
    return csv
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  private normalizeRedemptionMethod(raw: unknown): 'GIFT_CARD' | 'PROMO_CODE' {
    return String(raw ?? '').toUpperCase() === 'PROMO_CODE' ? 'PROMO_CODE' : 'GIFT_CARD';
  }
}
