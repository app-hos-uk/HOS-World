/**
 * Currency conversion helpers.
 * Rates must be supplied by the caller (e.g. CurrencyContext via GET /currency/rates).
 * No static production rates are embedded here.
 */

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  if (!rates || Object.keys(rates).length === 0) {
    return amount;
  }

  const fromRate = rates[fromCurrency];
  const toRate = rates[toCurrency];
  if (!fromRate || !toRate) {
    return amount;
  }

  const baseAmount = amount / fromRate;
  return baseAmount * toRate;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    AED: 'د.إ',
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
    SGD: 'S$',
  };
  return symbols[currency] || currency;
}

/**
 * Format amount with tax
 */
export function calculateTax(amount: number, taxRate: number): number {
  return amount * taxRate;
}

/**
 * Calculate total with tax
 */
export function calculateTotalWithTax(amount: number, taxRate: number): number {
  return amount + calculateTax(amount, taxRate);
}
