/**
 * ISO 3166-1 alpha-2 country list
 * Ordered by common usage for HOS platform (US, UK, UAE, MY first, then alphabetical)
 */
export const COUNTRIES = [
  // Primary markets
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'MY', name: 'Malaysia' },
  
  // Other common markets (alphabetical)
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'CN', name: 'China' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'IN', name: 'India' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
] as const;

export type CountryCode = typeof COUNTRIES[number]['code'];

/** Free-text country values seen in legacy records that aren't ISO alpha-2. */
const LEGACY_ALIASES: Record<string, string> = { UK: 'GB', USA: 'US' };

/**
 * Best-effort ISO alpha-2 code for a record that may carry a modern
 * `countryCode`, a legacy free-text `country` name, or neither.
 */
export function resolveCountryCode(
  row: { countryCode?: unknown; country?: unknown },
  fallback = 'US',
): string {
  const cc = String(row.countryCode ?? '').trim();
  if (cc) return cc.toUpperCase();

  const country = String(row.country ?? '').trim();
  if (!country) return fallback;

  return (
    COUNTRIES.find((c) => c.name.toLowerCase() === country.toLowerCase())?.code ||
    LEGACY_ALIASES[country.toUpperCase()] ||
    COUNTRIES.find((c) => c.code === country.toUpperCase())?.code ||
    fallback
  );
}

/** Display name for an ISO alpha-2 code, falling back to the code itself. */
export function countryNameFor(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.name || code;
}
