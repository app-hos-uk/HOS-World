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
export const DEFAULT_REGION: RegionConfig = {
  currency: DEFAULT_CURRENCY,
  country: 'US',
  locale: 'en-US',
  timezone: 'America/New_York',
};

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
