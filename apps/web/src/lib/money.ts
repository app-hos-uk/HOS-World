import {
  formatCurrency as formatCurrencyCore,
  formatNumber as formatNumberCore,
  getCurrencySymbol,
} from '@hos-marketplace/utils';
import { getRegionConfig } from '@/lib/regionConfig';

/**
 * Format a major-unit amount. Omitting currency/locale uses the platform region snapshot
 * (defaults to USD / en-US until CurrencyProvider loads /config/region).
 */
export function formatMoney(
  amount: number | string | null | undefined,
  currency?: string,
  locale?: string,
): string {
  const region = getRegionConfig();
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (value == null || Number.isNaN(value)) return '—';
  return formatCurrencyCore(value, currency ?? region.currency, locale ?? region.locale);
}

/**
 * Format a count or other non-monetary number using the platform region locale.
 * Use this rather than formatMoney for row counts, which must not render a currency symbol.
 */
export function formatCount(
  value: number | string | null | undefined,
  locale?: string,
): string {
  const region = getRegionConfig();
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  if (parsed == null || Number.isNaN(parsed)) return '—';
  return formatNumberCore(parsed, locale ?? region.locale);
}

/**
 * Abbreviated money for chart axes and other tight spaces, e.g. "$5.2K".
 *
 * A full currency string on an axis tick overlaps its neighbours at typical revenue
 * magnitudes, which is why axes need their own formatter rather than reusing formatMoney.
 */
export function formatMoneyCompact(
  amount: number | string | null | undefined,
  currency?: string,
  locale?: string,
): string {
  const region = getRegionConfig();
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (value == null || Number.isNaN(value)) return '—';

  return new Intl.NumberFormat(locale ?? region.locale, {
    style: 'currency',
    currency: currency ?? region.currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export { getCurrencySymbol };
