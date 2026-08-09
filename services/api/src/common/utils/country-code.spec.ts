import { normalizeCountryCode, countriesMatch, isDomestic } from './country-code';

describe('normalizeCountryCode', () => {
  it('passes through ISO alpha-2 codes, upper-casing them', () => {
    expect(normalizeCountryCode('US')).toBe('US');
    expect(normalizeCountryCode('us')).toBe('US');
    expect(normalizeCountryCode(' gb ')).toBe('GB');
  });

  // Every address row in production stored a display name rather than a code, which is what
  // defeated the carriers' domestic check.
  it('resolves the display names that exist in production data', () => {
    expect(normalizeCountryCode('United States')).toBe('US');
    expect(normalizeCountryCode('United Kingdom')).toBe('GB');
    expect(normalizeCountryCode('Italy')).toBe('IT');
    expect(normalizeCountryCode('United Arab Emirates')).toBe('AE');
  });

  it('resolves localised names', () => {
    expect(normalizeCountryCode('Estados Unidos')).toBe('US');
    expect(normalizeCountryCode('Brasil')).toBe('BR');
    expect(normalizeCountryCode('Italia')).toBe('IT');
  });

  it('maps non-ISO abbreviations to their real codes', () => {
    expect(normalizeCountryCode('USA')).toBe('US');
    expect(normalizeCountryCode('UK')).toBe('GB');
    expect(normalizeCountryCode('GBR')).toBe('GB');
    expect(normalizeCountryCode('England')).toBe('GB');
  });

  it('rejects placeholder values that are not countries', () => {
    expect(normalizeCountryCode('Other')).toBeUndefined();
    expect(normalizeCountryCode('Otro')).toBeUndefined();
    expect(normalizeCountryCode('N/A')).toBeUndefined();
  });

  it('returns undefined for empty and missing input', () => {
    expect(normalizeCountryCode(undefined)).toBeUndefined();
    expect(normalizeCountryCode(null)).toBeUndefined();
    expect(normalizeCountryCode('')).toBeUndefined();
    expect(normalizeCountryCode('   ')).toBeUndefined();
  });

  // Guessing would route a parcel to the wrong country, which is worse than refusing it.
  it('returns undefined rather than guessing at unrecognised values', () => {
    expect(normalizeCountryCode('Freedonia')).toBeUndefined();
    expect(normalizeCountryCode('DEU')).toBeUndefined();
  });
});

describe('countriesMatch', () => {
  it('matches a display name against a code', () => {
    expect(countriesMatch('United States', 'US')).toBe(true);
    expect(countriesMatch('USA', 'us')).toBe(true);
  });

  it('treats UK and GB as the same country', () => {
    expect(countriesMatch('UK', 'GB')).toBe(true);
    expect(countriesMatch('United Kingdom', 'GB')).toBe(true);
  });

  it('does not match different countries', () => {
    expect(countriesMatch('United States', 'GB')).toBe(false);
  });

  it('never matches when either side is unresolvable', () => {
    expect(countriesMatch('Other', 'US')).toBe(false);
    expect(countriesMatch(undefined, 'US')).toBe(false);
    expect(countriesMatch('Other', 'Other')).toBe(false);
  });
});

describe('isDomestic', () => {
  it('treats a display-name address as domestic against the platform country', () => {
    expect(isDomestic('United States', 'US')).toBe(true);
  });

  it('treats a foreign address as international', () => {
    expect(isDomestic('United Kingdom', 'US')).toBe(false);
  });

  it('treats an unresolvable country as international rather than assuming domestic', () => {
    expect(isDomestic('Other', 'US')).toBe(false);
  });
});
