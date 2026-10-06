export type RegionConfig = {
  currency: string;
  country: string;
  locale: string;
  timezone: string;
};

/**
 * Sole allowlisted home for the platform default ISO 4217 currency on the web app.
 * Prefer getRegionConfig().currency at runtime; use this only as a static fallback.
 */
export const DEFAULT_CURRENCY = 'USD';

/** Platform defaults when /config/region is unavailable — keep in sync with API PlatformRegionService. */
const MARKET_DEFAULTS: Record<string, RegionConfig> = {
  US: { currency: 'USD', country: 'US', locale: 'en-US', timezone: 'America/New_York' },
  GB: { currency: 'GBP', country: 'GB', locale: 'en-GB', timezone: 'Europe/London' },
  AE: { currency: 'AED', country: 'AE', locale: 'en-AE', timezone: 'Asia/Dubai' },
  MY: { currency: 'MYR', country: 'MY', locale: 'en-MY', timezone: 'Asia/Kuala_Lumpur' },
};

const marketCode = process.env.NEXT_PUBLIC_MARKET_CODE || 'US';
export const DEFAULT_REGION: RegionConfig = MARKET_DEFAULTS[marketCode] || MARKET_DEFAULTS.US;

export const REGION_STORAGE_KEY = 'platform_region';

let cachedRegion: RegionConfig = DEFAULT_REGION;

export function normalizeRegion(input: Partial<RegionConfig> | null | undefined): RegionConfig {
  return {
    currency: (input?.currency || DEFAULT_REGION.currency).toUpperCase(),
    country: (input?.country || DEFAULT_REGION.country).toUpperCase(),
    locale: input?.locale || DEFAULT_REGION.locale,
    timezone: input?.timezone || DEFAULT_REGION.timezone,
  };
}

/** Synchronous region snapshot for formatters (defaults until CurrencyProvider hydrates). */
export function getRegionConfig(): RegionConfig {
  return cachedRegion;
}

export function setRegionConfig(region: RegionConfig): void {
  cachedRegion = normalizeRegion(region);
}

export function readStoredRegion(): RegionConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(REGION_STORAGE_KEY);
    if (!raw) return null;
    return normalizeRegion(JSON.parse(raw) as Partial<RegionConfig>);
  } catch {
    return null;
  }
}

export function persistRegion(region: RegionConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGION_STORAGE_KEY, JSON.stringify(region));
  } catch {
    // ignore quota / private mode
  }
}

/** Map ISO 3166-1 alpha-2 country code to its primary ISO 4217 currency code. */
export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD', GB: 'GBP', AE: 'AED', MY: 'MYR', AU: 'AUD', CA: 'CAD',
  IN: 'INR', SG: 'SGD', NZ: 'NZD', IE: 'EUR', DE: 'EUR', FR: 'EUR',
  JP: 'JPY', KR: 'KRW', CN: 'CNY', HK: 'HKD', CH: 'CHF', MX: 'MXN',
  SA: 'SAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', ZA: 'ZAR',
};

/** Prefer cached localStorage region on the client so first paint matches last known config. */
export function getInitialRegion(): RegionConfig {
  const stored = readStoredRegion();
  if (stored) {
    cachedRegion = stored;
    return stored;
  }
  cachedRegion = DEFAULT_REGION;
  return DEFAULT_REGION;
}
