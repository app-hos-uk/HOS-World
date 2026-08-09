import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../cache/cache.service';
import { FeatureFlagsService, FeatureFlag } from '../../config/feature-flags.service';
import { PrismaService } from '../../database/prisma.service';
import { isTruthy } from '../../common/utils/config';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';
import { isPosRuntimeEnabled } from '../../pos/pos-enabled';

export const LOYALTY_SETTINGS_CONFIG_KEY = 'LOYALTY_PROGRAMME_SETTINGS';
export const LOYALTY_SETTINGS_CACHE_KEY = 'loyalty:settings:resolved';

export type LoyaltyProgrammeSettings = {
  defaultEarnRate: number;
  defaultRedeemValue: number;
  minRedemptionPoints: number;
  pointsExpiryMonths: number;
  cardPrefix: string;
  redemptionAtCheckout: boolean;
  posVoucherEnabled: boolean;
  posVoucherMinAmount: number;
  posVoucherMaxAmount: number;
  giftCardCatalogAmounts: string;
  giftCardDefaultCurrency: string;
  restoreBurnOnCancel: boolean;
  clawEarnOnCancel: boolean;
  restoreBurnOnReturn: boolean;
  clawEarnOnReturn: boolean;
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
    @Optional() private sharedCache?: CacheService,
  ) {
    this.cacheTtlMs = Math.max(0, num(this.config.get('LOYALTY_SETTINGS_CACHE_TTL_MS'), 2_000));
  }

  envDefaults(): LoyaltyProgrammeSettings {
    return {
      defaultEarnRate: num(this.config.get('LOYALTY_DEFAULT_EARN_RATE'), 1),
      defaultRedeemValue: num(this.config.get('LOYALTY_DEFAULT_REDEEM_VALUE'), 0.01),
      minRedemptionPoints: Math.max(
        0,
        Math.floor(num(this.config.get('LOYALTY_MIN_REDEMPTION_POINTS'), 100)),
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
      posVoucherMinAmount: num(this.config.get('POS_GIFT_CARD_MIN_AMOUNT'), 1),
      posVoucherMaxAmount: num(this.config.get('POS_GIFT_CARD_MAX_AMOUNT'), 500),
      giftCardCatalogAmounts:
        this.config.get<string>('GIFT_CARD_CATALOG_AMOUNTS') || '25,50,100,250,500',
      giftCardDefaultCurrency: this.config.get<string>('GIFT_CARD_DEFAULT_CURRENCY') || 'GBP',
      restoreBurnOnCancel: true,
      clawEarnOnCancel: true,
      restoreBurnOnReturn: true,
      clawEarnOnReturn: true,
    };
  }

  private normalize(
    partial: Partial<LoyaltyProgrammeSettings>,
    base: LoyaltyProgrammeSettings,
  ): LoyaltyProgrammeSettings {
    return {
      defaultEarnRate: num(partial.defaultEarnRate, base.defaultEarnRate),
      defaultRedeemValue: num(partial.defaultRedeemValue, base.defaultRedeemValue),
      minRedemptionPoints: Math.max(
        0,
        Math.floor(num(partial.minRedemptionPoints, base.minRedemptionPoints)),
      ),
      pointsExpiryMonths: Math.max(
        0,
        Math.floor(num(partial.pointsExpiryMonths, base.pointsExpiryMonths)),
      ),
      cardPrefix: String(partial.cardPrefix ?? base.cardPrefix).slice(0, 16) || 'HOS',
      redemptionAtCheckout: bool(partial.redemptionAtCheckout, base.redemptionAtCheckout),
      posVoucherEnabled: bool(partial.posVoucherEnabled, base.posVoucherEnabled),
      posVoucherMinAmount: num(partial.posVoucherMinAmount, base.posVoucherMinAmount),
      posVoucherMaxAmount: num(partial.posVoucherMaxAmount, base.posVoucherMaxAmount),
      giftCardCatalogAmounts: String(partial.giftCardCatalogAmounts ?? base.giftCardCatalogAmounts),
      giftCardDefaultCurrency: String(
        partial.giftCardDefaultCurrency ?? base.giftCardDefaultCurrency,
      ).toUpperCase(),
      restoreBurnOnCancel: bool(partial.restoreBurnOnCancel, base.restoreBurnOnCancel),
      clawEarnOnCancel: bool(partial.clawEarnOnCancel, base.clawEarnOnCancel),
      restoreBurnOnReturn: bool(partial.restoreBurnOnReturn, base.restoreBurnOnReturn),
      clawEarnOnReturn: bool(partial.clawEarnOnReturn, base.clawEarnOnReturn),
    };
  }

  private async readShared(): Promise<ResolvedSettings | null> {
    if (!this.sharedCache) return null;
    try {
      const hit = await this.sharedCache.get<ResolvedSettings>(LOYALTY_SETTINGS_CACHE_KEY);
      if (hit?.settings) return hit;
    } catch {
      // Cache is best-effort; fall through to the database.
    }
    return null;
  }

  private async writeShared(value: ResolvedSettings): Promise<void> {
    if (!this.sharedCache || this.cacheTtlMs <= 0) return;
    try {
      await this.sharedCache.set(LOYALTY_SETTINGS_CACHE_KEY, value, this.cacheTtlMs);
    } catch {
      // Non-fatal: the database remains the source of truth.
    }
  }

  /** Drops the cached value locally and, when Redis-backed, for every instance. */
  async invalidate(): Promise<void> {
    this.localCache = null;
    if (!this.sharedCache) return;
    try {
      await this.sharedCache.del(LOYALTY_SETTINGS_CACHE_KEY);
    } catch {
      // Non-fatal.
    }
  }

  async getResolved(force = false): Promise<ResolvedSettings> {
    if (!force && this.localCache && Date.now() - this.localCache.at < this.cacheTtlMs) {
      return this.localCache.value;
    }
    if (!force) {
      const shared = await this.readShared();
      if (shared) {
        this.localCache = { at: Date.now(), value: shared };
        return shared;
      }
    }
    const base = this.envDefaults();
    let resolved: ResolvedSettings = { settings: base, source: 'env' };
    try {
      const row = await this.prisma.config.findFirst({
        where: { level: 'PLATFORM', levelId: 'PLATFORM', key: LOYALTY_SETTINGS_CONFIG_KEY },
      });
      if (row?.value && typeof row.value === 'object' && !Array.isArray(row.value)) {
        resolved = {
          settings: this.normalize(row.value as Partial<LoyaltyProgrammeSettings>, base),
          source: 'database',
        };
      }
    } catch (e) {
      this.logger.warn(`Loyalty settings DB read failed: ${(e as Error).message}`);
    }
    this.localCache = { at: Date.now(), value: resolved };
    await this.writeShared(resolved);
    return resolved;
  }

  async update(
    partial: Partial<LoyaltyProgrammeSettings>,
    updatedByUserId?: string,
  ): Promise<LoyaltyProgrammeSettings> {
    const { settings: current } = await this.getResolved(true);
    const next = this.normalize(partial, current);
    if (next.posVoucherMinAmount > next.posVoucherMaxAmount) {
      throw new Error('posVoucherMinAmount cannot exceed posVoucherMaxAmount');
    }
    const value = {
      ...next,
      updatedByUserId: updatedByUserId ?? null,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.config.findFirst({
        where: { level: 'PLATFORM', levelId: 'PLATFORM', key: LOYALTY_SETTINGS_CONFIG_KEY },
        select: { id: true },
      });
      if (existing) {
        await tx.config.update({ where: { id: existing.id }, data: { value } });
      } else {
        await tx.config.create({
          data: { level: 'PLATFORM', levelId: 'PLATFORM', key: LOYALTY_SETTINGS_CONFIG_KEY, value },
        });
      }
    });

    const resolved: ResolvedSettings = { settings: next, source: 'database' };
    this.localCache = { at: Date.now(), value: resolved };
    // Publish to the shared cache so other instances pick the new value up on
    // their next read instead of waiting out their own TTL.
    await this.writeShared(resolved);
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
}
