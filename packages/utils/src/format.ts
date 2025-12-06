/**
 * Format currency amount
 * Note: Base currency is GBP. For other currencies, amount should already be converted.
 */
export function formatCurrency(amount: number, currency: string = 'GBP', locale: string = 'en-GB'): string {
  // Map currency to appropriate locale
  const localeMap: Record<string, string> = {
    GBP: 'en-GB',
    USD: 'en-US',
    EUR: 'de-DE', // or 'fr-FR', 'es-ES' etc.
    AED: 'ar-AE',
  };
  
  const selectedLocale = localeMap[currency] || locale;
  
  return new Intl.NumberFormat(selectedLocale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format price with tax
 * Note: Base currency is GBP. For other currencies, price should already be converted.
 */
export function formatPriceWithTax(price: number, taxRate: number, currency: string = 'GBP'): string {
  const taxAmount = price * taxRate;
  const total = price + taxAmount;
  return formatCurrency(total, currency);
}

/**
 * Format date
 */
export function formatDate(date: Date | string, locale: string = 'en-US'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string, locale: string = 'en-US'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(dateObj);
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


