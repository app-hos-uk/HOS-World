/**
 * Shared currency/date formatting. Locale and currency must be supplied by the caller
 * (e.g. platform region config). Intl handles zero-decimal currencies (JPY, KRW, …).
 */

export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US',
): string {
  const safeAmount = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(safeAmount);
  } catch {
    return `${currency} ${safeAmount.toFixed(2)}`;
  }
}

/**
 * Format a plain (non-monetary) number, e.g. row or record counts.
 */
export function formatNumber(
  value: number,
  locale: string = 'en-US',
  options?: Intl.NumberFormatOptions,
): string {
  const safeValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  try {
    return new Intl.NumberFormat(locale, options).format(safeValue);
  } catch {
    return String(safeValue);
  }
}

/**
 * Format price with tax
 */
export function formatPriceWithTax(
  price: number,
  taxRate: number,
  currency: string = 'USD',
  locale: string = 'en-US',
): string {
  const taxAmount = price * taxRate;
  const total = price + taxAmount;
  return formatCurrency(total, currency, locale);
}

export type FormatDateOptions = Intl.DateTimeFormatOptions;

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Format date (always pass an explicit locale — never rely on the runtime default).
 */
export function formatDate(
  date: Date | string | number,
  locale: string = 'en-US',
  options?: FormatDateOptions,
): string {
  const dateObj = toDate(date);
  if (Number.isNaN(dateObj.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(dateObj);
}

/**
 * Format date and time
 */
export function formatDateTime(
  date: Date | string | number,
  locale: string = 'en-US',
  options?: FormatDateOptions,
): string {
  const dateObj = toDate(date);
  if (Number.isNaN(dateObj.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(dateObj);
}

/**
 * Relative time (e.g. "3 days ago") using the given locale.
 */
export function formatRelative(date: Date | string | number, locale: string = 'en-US'): string {
  const dateObj = toDate(date);
  if (Number.isNaN(dateObj.getTime())) return '—';

  const diffMs = dateObj.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  if (absMs < minute) return rtf.format(Math.round(diffMs / 1000), 'second');
  if (absMs < hour) return rtf.format(Math.round(diffMs / minute), 'minute');
  if (absMs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  if (absMs < week) return rtf.format(Math.round(diffMs / day), 'day');
  if (absMs < month) return rtf.format(Math.round(diffMs / week), 'week');
  if (absMs < year) return rtf.format(Math.round(diffMs / month), 'month');
  return rtf.format(Math.round(diffMs / year), 'year');
}

/**
 * Truncate text to specified length
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Format order number
 */
export function formatOrderNumber(orderNumber: string): string {
  return `#${orderNumber.toUpperCase()}`;
}
