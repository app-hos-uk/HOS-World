'use client';

import { useCurrency } from '@/contexts/CurrencyContext';
import { getCurrencySymbol } from '@hos-marketplace/utils';

const SUPPORTED_CURRENCIES = [
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
];

export function CurrencySelector() {
  const { currency, setCurrency, loading } = useCurrency();

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-gray-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
        aria-label="Select currency"
      >
        {SUPPORTED_CURRENCIES.map((curr) => (
          <option key={curr.code} value={curr.code}>
            {curr.symbol} {curr.code}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <svg
          className="w-4 h-4 text-gray-500"
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

