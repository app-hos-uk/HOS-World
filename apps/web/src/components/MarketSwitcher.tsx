'use client';

import { useAuth } from '@/contexts/AuthContext';

/**
 * Lets multi-market staff pin `x-market-code` for subsequent API calls.
 * Hidden when the caller has fewer than two visible markets.
 */
export function MarketSwitcher() {
  const { accessProfile, activeMarketCode, setActiveMarketCode } = useAuth();
  const markets = accessProfile?.markets || [];
  if (markets.length < 2) return null;

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-gray-500">Market</span>
      <select
        value={activeMarketCode || accessProfile?.activeMarket?.code || ''}
        onChange={(e) => setActiveMarketCode(e.target.value || null)}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
      >
        {markets.map((m) => (
          <option key={m.id} value={m.code}>
            {m.code} — {m.name}
          </option>
        ))}
      </select>
    </label>
  );
}
