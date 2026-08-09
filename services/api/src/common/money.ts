/**
 * Stripe-style minor-unit helpers.
 *
 * Currency exponents follow Stripe's zero-decimal and three-decimal sets.
 * Default (everything else) is 2 decimal places.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

/** Stripe minor-unit exponent: 0, 2, or 3. */
export function minorUnitExponent(currency: string): number {
  const code = normalizeCurrency(currency);
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/**
 * Convert a major-unit amount to an integer minor-unit value for Stripe.
 *
 * Binary floats cannot represent many decimal amounts exactly, so
 * `Math.round(amount * 100)` is wrong for values like 1.005 (→ 100, not 101).
 * We round via a fixed-precision decimal string before scaling.
 */
export function toMinorUnits(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`toMinorUnits: amount must be finite (got ${amount})`);
  }

  const exp = minorUnitExponent(currency);
  if (exp === 0) {
    return Math.round(amount);
  }

  const negative = amount < 0;
  // One extra fractional digit so we can half-up round into the minor unit.
  const fixed = Math.abs(amount).toFixed(exp + 1);
  const [whole, frac = ''] = fixed.split('.');
  const digits = frac.padEnd(exp + 1, '0');
  const factor = 10 ** exp;
  let minor = parseInt(whole, 10) * factor + parseInt(digits.slice(0, exp), 10);
  if (digits.charAt(exp) >= '5') {
    minor += 1;
  }
  return negative ? -minor : minor;
}

/** Convert an integer Stripe minor-unit value back to major units. */
export function fromMinorUnits(value: number, currency: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`fromMinorUnits: value must be finite (got ${value})`);
  }
  const exp = minorUnitExponent(currency);
  return value / 10 ** exp;
}
