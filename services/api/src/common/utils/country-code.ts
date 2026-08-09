/**
 * Country values reach us as free text. Historic records store display names
 * ("United States"), localised names ("Estados Unidos"), and non-ISO abbreviations ("USA",
 * "UK"), because address forms captured a label rather than a code.
 *
 * Carrier APIs and every domestic/international decision expect ISO 3166-1 alpha-2, so a raw
 * comparison against 'US' silently fails for a display name and quotes international rates for
 * a domestic parcel. Normalise at the edge, before a value is compared or sent to a carrier.
 */

const ALIASES: Record<string, string> = {
  // United States
  'UNITED STATES': 'US',
  'UNITED STATES OF AMERICA': 'US',
  USA: 'US',
  'U.S.': 'US',
  'U.S.A.': 'US',
  'U.S.A': 'US',
  'ESTADOS UNIDOS': 'US',
  'ETATS-UNIS': 'US',

  // United Kingdom — ISO is GB, and 'UK' is not a valid alpha-2 code.
  'UNITED KINGDOM': 'GB',
  UK: 'GB',
  GBR: 'GB',
  'GREAT BRITAIN': 'GB',
  ENGLAND: 'GB',
  SCOTLAND: 'GB',
  WALES: 'GB',
  'NORTHERN IRELAND': 'GB',

  'UNITED ARAB EMIRATES': 'AE',
  UAE: 'AE',
  MALAYSIA: 'MY',
  CANADA: 'CA',
  AUSTRALIA: 'AU',
  'NEW ZEALAND': 'NZ',
  IRELAND: 'IE',
  GERMANY: 'DE',
  DEUTSCHLAND: 'DE',
  FRANCE: 'FR',
  ITALY: 'IT',
  ITALIA: 'IT',
  SPAIN: 'ES',
  'ESPAÑA': 'ES',
  ESPANA: 'ES',
  NETHERLANDS: 'NL',
  BELGIUM: 'BE',
  PORTUGAL: 'PT',
  SWEDEN: 'SE',
  NORWAY: 'NO',
  DENMARK: 'DK',
  FINLAND: 'FI',
  POLAND: 'PL',
  AUSTRIA: 'AT',
  SWITZERLAND: 'CH',
  INDIA: 'IN',
  CHINA: 'CN',
  JAPAN: 'JP',
  SINGAPORE: 'SG',
  BRAZIL: 'BR',
  BRASIL: 'BR',
  MEXICO: 'MX',
  'SOUTH AFRICA': 'ZA',
};

/**
 * Values that are not countries at all. Historic signup forms offered these as options, so
 * they must resolve to undefined rather than be passed to a carrier as a country code.
 */
// 'NA' is deliberately absent: it is Namibia's ISO code, not an abbreviation for "not applicable".
const NON_COUNTRIES = new Set(['OTHER', 'OTRO', 'AUTRE', 'N/A', 'NONE', 'UNKNOWN', '-']);

/**
 * Resolve a free-text country to ISO 3166-1 alpha-2, or undefined when it cannot be resolved.
 *
 * Returns undefined rather than guessing: sending a wrong country to a carrier books a parcel
 * to the wrong place, which is worse than failing the request.
 */
export function normalizeCountryCode(country?: string | null): string | undefined {
  if (!country) return undefined;

  const trimmed = String(country).trim();
  if (!trimmed) return undefined;

  const upper = trimmed.toUpperCase();
  if (NON_COUNTRIES.has(upper)) return undefined;

  // Aliases are checked before the two-letter passthrough because 'UK' is two letters but is
  // not a valid alpha-2 code; passing it through would leave it never matching 'GB'.
  const alias = ALIASES[upper];
  if (alias) return alias;

  if (/^[A-Za-z]{2}$/.test(trimmed)) return upper;

  // Unrecognised. A three-letter code is very likely alpha-3, but truncating it would turn
  // DEU into DE by luck and CHE into CH incorrectly, so leave it for the caller to reject.
  return undefined;
}

/** True only when both values resolve to the same country. Unresolvable values never match. */
export function countriesMatch(a?: string | null, b?: string | null): boolean {
  const left = normalizeCountryCode(a);
  const right = normalizeCountryCode(b);
  return left !== undefined && right !== undefined && left === right;
}

/** True when the address is domestic relative to the platform's own country. */
export function isDomestic(country: string | null | undefined, platformCountry: string): boolean {
  return countriesMatch(country, platformCountry);
}
