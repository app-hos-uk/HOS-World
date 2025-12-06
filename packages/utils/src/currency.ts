/**
 * Currency conversion rates (GBP base - should come from API in production)
 */
const CURRENCY_RATES: Record<string, number> = {
  GBP: 1, // Base currency
  USD: 1.27, // Approximate
  EUR: 1.17, // Approximate
  AED: 4.67, // Approximate
};

/**
 * Convert amount from one currency to another (GBP base)
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
  
  // Convert to base currency (GBP), then to target currency
  const baseAmount = amount / fromRate;
  return baseAmount * toRate;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    GBP: '£',
    USD: '$',
    EUR: '€',
    AED: 'د.إ',
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


