/**
 * Currency conversion rates (example - should come from API in production)
 */
const CURRENCY_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.85,
  GBP: 0.73,
  JPY: 110,
  CAD: 1.25,
  AUD: 1.35,
};

/**
 * Convert amount from one currency to another
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number> = CURRENCY_RATES
): number {
  if (fromCurrency === toCurrency) return amount;
  
  const fromRate = rates[fromCurrency] || 1;
  const toRate = rates[toCurrency] || 1;
  
  // Convert to base currency (USD), then to target currency
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
    JPY: '¥',
    CAD: 'C$',
    AUD: 'A$',
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


