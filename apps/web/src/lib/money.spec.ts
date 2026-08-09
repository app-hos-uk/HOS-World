import { formatCount, formatMoney, formatMoneyCompact } from '@/lib/money';
import {
  DEFAULT_CURRENCY,
  DEFAULT_REGION,
  setRegionConfig,
} from '@/lib/regionConfig';

describe('formatMoney', () => {
  beforeEach(() => {
    setRegionConfig(DEFAULT_REGION);
  });

  it('renders USD in en-US by default', () => {
    expect(DEFAULT_CURRENCY).toBe('USD');
    const formatted = formatMoney(12.5);
    expect(formatted).toContain('12.50');
    expect(formatted).toMatch(/\$/);
  });

  it('renders zero-decimal JPY with no fractional digits', () => {
    const formatted = formatMoney(1234, 'JPY', 'en-US');
    expect(formatted).toMatch(/¥|JPY/);
    expect(formatted).not.toMatch(/\./);
    expect(formatted.replace(/[^\d]/g, '')).toBe('1234');
  });

  it('renders three-decimal BHD correctly', () => {
    const formatted = formatMoney(1.234, 'BHD', 'en-US');
    expect(formatted).toMatch(/BHD|د\.ب|\.د\.ب/);
    expect(formatted).toContain('1.234');
  });

  it('explicit currency/locale overrides beat the region default', () => {
    setRegionConfig({
      currency: 'USD',
      country: 'US',
      locale: 'en-US',
      timezone: 'America/New_York',
    });
    const formatted = formatMoney(10, 'EUR', 'de-DE');
    expect(formatted).toMatch(/€|EUR/);
    expect(formatted).not.toMatch(/\$/);
  });

  it('returns em-dash for null, undefined, empty, and NaN input', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney('')).toBe('—');
    expect(formatMoney('not-a-number')).toBe('—');
  });

  it('reflects a set region on subsequent formatMoney calls', () => {
    setRegionConfig({
      currency: 'EUR',
      country: 'DE',
      locale: 'de-DE',
      timezone: 'Europe/Berlin',
    });
    const formatted = formatMoney(99);
    expect(formatted).toMatch(/€|EUR/);
    expect(formatted).not.toMatch(/\$/);
  });
});

describe('formatCount', () => {
  beforeEach(() => {
    setRegionConfig(DEFAULT_REGION);
  });

  it('groups thousands without any currency symbol', () => {
    const formatted = formatCount(12345);
    expect(formatted).toBe('12,345');
    expect(formatted).not.toMatch(/[$£€¥]/);
  });

  it('returns em-dash for null, undefined, and non-numeric input', () => {
    expect(formatCount(null)).toBe('—');
    expect(formatCount(undefined)).toBe('—');
    expect(formatCount('not-a-number')).toBe('—');
  });

  it('follows the region locale grouping', () => {
    setRegionConfig({
      currency: 'EUR',
      country: 'DE',
      locale: 'de-DE',
      timezone: 'Europe/Berlin',
    });
    expect(formatCount(12345)).toBe('12.345');
  });
});

// Chart axes need short ticks; a full currency string overlaps its neighbours.
describe('formatMoneyCompact', () => {
  beforeEach(() => {
    setRegionConfig(DEFAULT_REGION);
  });

  it('abbreviates thousands', () => {
    const out = formatMoneyCompact(5234);
    expect(out).toMatch(/5\.2K/i);
    expect(out).toMatch(/\$/);
    expect(out).not.toContain('5,234');
  });

  it('abbreviates millions', () => {
    expect(formatMoneyCompact(2_400_000)).toMatch(/2\.4M/i);
  });

  it('leaves small amounts readable', () => {
    expect(formatMoneyCompact(42)).toMatch(/42/);
  });

  it('respects an explicit currency', () => {
    expect(formatMoneyCompact(5234, 'GBP', 'en-GB')).toMatch(/£/);
  });

  it('returns em-dash for null and invalid input', () => {
    expect(formatMoneyCompact(null)).toBe('—');
    expect(formatMoneyCompact(undefined)).toBe('—');
    expect(formatMoneyCompact('not-a-number')).toBe('—');
  });
});
