import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';

export enum FeatureFlag {
  FOUNDING_MEMBERS = 'FOUNDING_MEMBERS',
  EMAIL_TEMPLATE_OVERRIDES = 'EMAIL_TEMPLATE_OVERRIDES',
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
}

const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  [FeatureFlag.FOUNDING_MEMBERS]: true,
  [FeatureFlag.EMAIL_TEMPLATE_OVERRIDES]: true,
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
};

const CACHE_TTL_MS = 30_000;

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly flags = new Map<string, boolean>();
  private readonly envDefaults = new Map<string, boolean>();
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

  isEnabled(flag: FeatureFlag): boolean {
    this.maybeRefresh();
    return this.flags.get(flag) ?? false;
  }

  getAll(): Record<string, boolean> {
    this.maybeRefresh();
    const result: Record<string, boolean> = {};
    for (const [key, value] of this.flags) {
      result[key] = value;
    }
    return result;
  }

  async setFlag(flag: FeatureFlag, enabled: boolean): Promise<{ persisted: boolean }> {
    this.flags.set(flag, enabled);
    let persisted = false;
    try {
      await this.prisma.platformSetting.upsert({
        where: { category_key: { category: 'feature_flag', key: flag } },
        update: { value: String(enabled) },
        create: { category: 'feature_flag', key: flag, value: String(enabled) },
      });
      persisted = true;
    } catch (err) {
      this.logger.warn(`Could not persist flag ${flag} — ${(err as Error).message}`);
    }
    this.lastRefreshAt = Date.now();
    this.logger.log(`Feature flag ${flag} set to ${enabled} (persisted=${persisted})`);
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

  private async refreshFromDb() {
    try {
      const rows = await this.prisma.platformSetting.findMany({
        where: { category: 'feature_flag' },
      });
      for (const [flag, envDefault] of this.envDefaults) {
        const row = rows.find((r) => r.key === flag);
        this.flags.set(flag, row ? row.value === 'true' : envDefault);
      }
      this.lastRefreshAt = Date.now();
    } catch {
      this.logger.warn('platform_settings table not available yet — using env/defaults');
    }
  }
}
