'use client';

import { useCurrency } from '@/contexts/CurrencyContext';

const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
];

export function CurrencySelector() {
  const { currency, setCurrency, loading } = useCurrency();

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-hos-text-muted">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="appearance-none bg-hos-bg-secondary border border-hos-border rounded-lg px-3 py-2 pr-8 text-sm font-medium text-hos-text-secondary hover:border-hos-gold focus:outline-none focus:ring-1 focus:ring-hos-gold focus:border-hos-gold cursor-pointer transition-colors duration-200"
        aria-label="Select currency"
      >
        {SUPPORTED_CURRENCIES.map((curr) => (
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
