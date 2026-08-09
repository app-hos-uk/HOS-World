import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { PLATFORM_DEFAULT_CURRENCY } from '../common/currency-defaults';
import { PrismaService } from '../database/prisma.service';

export const PLATFORM_REGION_CACHE_KEY = 'platform:region:resolved';

export const PLATFORM_CURRENCY_CONFIG_KEY = 'platformCurrency';
/** Admin "Default Currency" has always written this key; kept as a fallback so existing installs keep working. */
export const LEGACY_CURRENCY_CONFIG_KEY = 'currency';
export const PLATFORM_COUNTRY_CONFIG_KEY = 'platformCountry';
export const PLATFORM_LOCALE_CONFIG_KEY = 'platformLocale';
export const PLATFORM_TIMEZONE_CONFIG_KEY = 'platformTimezone';

const DEFAULT_CURRENCY = PLATFORM_DEFAULT_CURRENCY;
const DEFAULT_COUNTRY = 'US';
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_CACHE_TTL_MS = 15_000;

export type TaxOrigin = {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

export type PlatformRegionConfig = {
  currency: string;
  country: string;
  locale: string;
  timezone: string;
  taxOrigin: TaxOrigin | null;
};

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asTrimmedString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t || undefined;
  }
  return undefined;
}

@Injectable()
export class PlatformRegionService {
  private readonly logger = new Logger(PlatformRegionService.name);
  private localCache: { at: number; value: PlatformRegionConfig } | null = null;
  /**
   * Bounds how long any single instance can serve a stale value after another
   * instance saves. Kept short because the backing read is a small indexed
   * lookup; the shared cache (Redis, when configured) absorbs repeated reads.
   */
  private readonly cacheTtlMs: number;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Optional() private sharedCache?: CacheService,
  ) {
    this.cacheTtlMs = Math.max(
      0,
      num(this.config.get('PLATFORM_REGION_CACHE_TTL_MS'), DEFAULT_CACHE_TTL_MS),
    );
  }

  private envDefaults(): Omit<PlatformRegionConfig, 'taxOrigin'> & {
    taxOriginParts: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  } {
    const country =
      asTrimmedString(this.config.get<string>('PLATFORM_COUNTRY'))?.toUpperCase() ||
      DEFAULT_COUNTRY;
    return {
      currency:
        asTrimmedString(this.config.get<string>('PLATFORM_CURRENCY'))?.toUpperCase() ||
        DEFAULT_CURRENCY,
      country,
      locale: asTrimmedString(this.config.get<string>('PLATFORM_LOCALE')) || DEFAULT_LOCALE,
      timezone: asTrimmedString(this.config.get<string>('PLATFORM_TIMEZONE')) || DEFAULT_TIMEZONE,
      taxOriginParts: {
        street: asTrimmedString(this.config.get<string>('TAX_ORIGIN_STREET')),
        city: asTrimmedString(this.config.get<string>('TAX_ORIGIN_CITY')),
        state: asTrimmedString(this.config.get<string>('TAX_ORIGIN_STATE')),
        postalCode: asTrimmedString(this.config.get<string>('TAX_ORIGIN_POSTAL_CODE')),
        country:
          asTrimmedString(this.config.get<string>('TAX_ORIGIN_COUNTRY'))?.toUpperCase() ||
          undefined,
      },
    };
  }

  private buildTaxOrigin(
    parts: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    },
    fallbackCountry: string,
  ): TaxOrigin | null {
    const street = parts.street;
    const city = parts.city;
    const postalCode = parts.postalCode;
    const country = parts.country || fallbackCountry;
    const state = parts.state;

    if (!street || !city || !postalCode || !country) {
      return null;
    }
    // State is required for US origins; optional elsewhere.
    if (country === 'US' && !state) {
      return null;
    }

    return state
      ? { street, city, state, postalCode, country }
      : { street, city, postalCode, country };
  }

  private missingTaxOriginEnvVars(config: PlatformRegionConfig): string[] {
    const missing: string[] = [];
    if (!asTrimmedString(this.config.get<string>('TAX_ORIGIN_STREET'))) {
      missing.push('TAX_ORIGIN_STREET');
    }
    if (!asTrimmedString(this.config.get<string>('TAX_ORIGIN_CITY'))) {
      missing.push('TAX_ORIGIN_CITY');
    }
    if (!asTrimmedString(this.config.get<string>('TAX_ORIGIN_POSTAL_CODE'))) {
      missing.push('TAX_ORIGIN_POSTAL_CODE');
    }
    const country =
      asTrimmedString(this.config.get<string>('TAX_ORIGIN_COUNTRY'))?.toUpperCase() ||
      config.country;
    if (!country) {
      missing.push('TAX_ORIGIN_COUNTRY');
    }
    if (country === 'US' && !asTrimmedString(this.config.get<string>('TAX_ORIGIN_STATE'))) {
      missing.push('TAX_ORIGIN_STATE');
    }
    return missing;
  }

  /**
   * Production/staging must not calculate US sales tax without a complete origin.
   * Called from the tax layer once provider activity is known (env validation runs
   * before DB access, so it cannot perform this check).
   */
  async assertTaxOriginConfigured(taxProviderActive: boolean): Promise<void> {
    const nodeEnv = this.config.get<string>('NODE_ENV');
    if (nodeEnv !== 'production' && nodeEnv !== 'staging') return;
    if (!taxProviderActive) return;

    const region = await this.getRegion();
    if (region.taxOrigin) return;

    const missing = this.missingTaxOriginEnvVars(region);
    const named = missing.length > 0 ? missing.join(', ') : 'TAX_ORIGIN_*';
    throw new Error(
      `Tax provider is active but tax origin is incomplete. Set ${named} (street, city, postal code, and country are required; state is required for US).`,
    );
  }

  private async readShared(): Promise<PlatformRegionConfig | null> {
    if (!this.sharedCache) return null;
    try {
      const hit = await this.sharedCache.get<PlatformRegionConfig>(PLATFORM_REGION_CACHE_KEY);
      if (hit?.currency && hit?.country && hit?.locale && hit?.timezone) return hit;
    } catch {
      // Cache is best-effort; fall through to the database.
    }
    return null;
  }

  private async writeShared(value: PlatformRegionConfig): Promise<void> {
    if (!this.sharedCache || this.cacheTtlMs <= 0) return;
    try {
      await this.sharedCache.set(PLATFORM_REGION_CACHE_KEY, value, this.cacheTtlMs);
    } catch {
      // Non-fatal: the database remains the source of truth.
    }
  }

  /** Drops the cached value locally and, when Redis-backed, for every instance. */
  async invalidate(): Promise<void> {
    this.localCache = null;
    if (!this.sharedCache) return;
    try {
      await this.sharedCache.del(PLATFORM_REGION_CACHE_KEY);
    } catch {
      // Non-fatal.
    }
  }

  private async resolve(force = false): Promise<PlatformRegionConfig> {
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
    let currency = base.currency;
    let country = base.country;
    let locale = base.locale;
    let timezone = base.timezone;

    try {
      const rows = await this.prisma.config.findMany({
        where: {
          level: 'PLATFORM',
          levelId: 'PLATFORM',
          key: {
            in: [
              PLATFORM_CURRENCY_CONFIG_KEY,
              LEGACY_CURRENCY_CONFIG_KEY,
              PLATFORM_COUNTRY_CONFIG_KEY,
              PLATFORM_LOCALE_CONFIG_KEY,
              PLATFORM_TIMEZONE_CONFIG_KEY,
            ],
          },
        },
      });

      const byKey = new Map(rows.map((r) => [r.key, r.value]));

      const dbCurrency = (
        asTrimmedString(byKey.get(PLATFORM_CURRENCY_CONFIG_KEY)) ??
        asTrimmedString(byKey.get(LEGACY_CURRENCY_CONFIG_KEY))
      )?.toUpperCase();
      const dbCountry = asTrimmedString(byKey.get(PLATFORM_COUNTRY_CONFIG_KEY))?.toUpperCase();
      const dbLocale = asTrimmedString(byKey.get(PLATFORM_LOCALE_CONFIG_KEY));
      const dbTimezone = asTrimmedString(byKey.get(PLATFORM_TIMEZONE_CONFIG_KEY));

      if (dbCurrency) currency = dbCurrency;
      if (dbCountry) country = dbCountry;
      if (dbLocale) locale = dbLocale;
      if (dbTimezone) timezone = dbTimezone;
    } catch (e) {
      this.logger.warn(`Platform region DB read failed: ${(e as Error).message}`);
    }

    const taxOrigin = this.buildTaxOrigin(
      {
        ...base.taxOriginParts,
        country: base.taxOriginParts.country || country,
      },
      country,
    );

    const resolved: PlatformRegionConfig = { currency, country, locale, timezone, taxOrigin };
    this.localCache = { at: Date.now(), value: resolved };
    await this.writeShared(resolved);
    return resolved;
  }

  async getRegion(force = false): Promise<PlatformRegionConfig> {
    return this.resolve(force);
  }

  async getCurrency(): Promise<string> {
    return (await this.resolve()).currency;
  }

  async getCountry(): Promise<string> {
    return (await this.resolve()).country;
  }

  async getLocale(): Promise<string> {
    return (await this.resolve()).locale;
  }

  async getTimezone(): Promise<string> {
    return (await this.resolve()).timezone;
  }

  async getTaxOrigin(): Promise<TaxOrigin | null> {
    return (await this.resolve()).taxOrigin;
  }
}
