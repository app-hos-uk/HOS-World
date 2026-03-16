/**
 * Currency conversion rates (USD base - should come from API in production)
 */
const CURRENCY_RATES: Record<string, number> = {
  USD: 1, // Base currency
  EUR: 0.92, // Approximate
  AED: 3.67, // Approximate
  CAD: 1.36, // Approximate
  AUD: 1.53, // Approximate
  JPY: 149.5, // Approximate
};

/**
 * Convert amount from one currency to another (USD base)
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


