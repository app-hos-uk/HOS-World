'use client';

import { useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';

const CURRENCY_META: Record<string, { name: string; symbol: string }> = {
  USD: { name: 'US Dollar', symbol: '$' },
  EUR: { name: 'Euro', symbol: '€' },
  GBP: { name: 'British Pound', symbol: '£' },
  AED: { name: 'UAE Dirham', symbol: 'د.إ' },
  JPY: { name: 'Japanese Yen', symbol: '¥' },
  AUD: { name: 'Australian Dollar', symbol: 'A$' },
  CAD: { name: 'Canadian Dollar', symbol: 'C$' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$' },
};

export function CurrencySelector() {
  const { currency, setCurrency, loading, rates, regionCurrency } = useCurrency();

  // Backend /currency/rates only returns supported currencies (region-only when
  // FF_MULTI_CURRENCY is off). One entry ⇒ nothing meaningful to select.
  const available = useMemo(() => {
    const codes = Object.keys(rates || {}).map((c) => c.toUpperCase());
    const list = codes.length > 0 ? codes : [regionCurrency];
    return [...new Set(list)].map((code) => ({
      code,
      symbol: CURRENCY_META[code]?.symbol || code,
      name: CURRENCY_META[code]?.name || code,
    }));
  }, [rates, regionCurrency]);

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-hos-text-muted">
        Loading...
      </div>
    );
  }

  if (available.length <= 1) {
    return null;
  }

  const selectValue = available.some((c) => c.code === currency)
    ? currency
    : available[0]?.code || regionCurrency;

  return (
    <div className="relative">
      <select
        value={selectValue}
        onChange={(e) => setCurrency(e.target.value)}
        className="appearance-none bg-hos-bg-secondary border border-hos-border rounded-lg px-3 py-2 pr-8 text-sm font-medium text-hos-text-secondary hover:border-hos-gold focus:outline-none focus:ring-1 focus:ring-hos-gold focus:border-hos-gold cursor-pointer transition-colors duration-200"
        aria-label="Select currency"
      >
        {available.map((curr) => (
          <option key={curr.code} value={curr.code} className="bg-hos-bg-secondary text-hos-text-primary">
            {curr.symbol} {curr.code}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg
          className="w-4 h-4 text-hos-text-muted"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
