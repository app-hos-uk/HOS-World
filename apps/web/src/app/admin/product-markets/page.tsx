'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

type Market = { id: string; code: string; name: string; isActive: boolean };
type ProductMarketRow = {
  id: string;
  productId: string;
  marketId: string;
  isActive: boolean;
  priceOverride: number | null;
  currency: string | null;
  product?: { name: string; sku?: string };
  market?: { code: string; name: string };
};

const INPUT_CLS =
  'w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

export default function AdminProductMarketsPage() {
  const [rows, setRows] = useState<ProductMarketRow[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterMarket, setFilterMarket] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 350);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [pmRes, mRes] = await Promise.all([
        apiClient.getProductMarkets({ search: debouncedSearch || undefined, marketCode: filterMarket || undefined }),
        apiClient.getMarkets(),
      ]);
      setRows(Array.isArray(pmRes?.data) ? pmRes.data : []);
      setMarkets(Array.isArray(mRes?.data) ? mRes.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterMarket]);

  useEffect(() => { load(); }, [load]);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Product Markets</h1>
          <p className="text-sm text-hos-text-muted mt-1">
            Assign products to markets and manage per-market pricing. Products without a market assignment are visible in every country.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <label className="block text-xs font-medium text-hos-text-muted mb-1">Search</label>
            <input
              className={INPUT_CLS}
              placeholder="Product name or SKU…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div className="min-w-[160px] max-w-[200px]">
            <label className="block text-xs font-medium text-hos-text-muted mb-1">Market</label>
            <select
              className={INPUT_CLS}
              value={filterMarket}
              onChange={(e) => setFilterMarket(e.target.value)}
            >
              <option value="">All markets</option>
              {markets.map((m) => (
                <option key={m.id} value={m.code}>{m.name} ({m.code})</option>
              ))}
            </select>
          </div>
          {!loading && rows.length > 0 && (
            <p className="text-xs text-hos-text-muted pb-2">{rows.length} assignment{rows.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-hos-bg-secondary animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-10 text-center">
            <p className="text-hos-text-muted">No product-market assignments found.</p>
            <p className="text-xs text-hos-text-muted mt-2 max-w-md mx-auto">
              {debouncedSearch || filterMarket
                ? 'Try adjusting your search or market filter.'
                : 'Use the API to assign products to markets, or enable the MARKET_CATALOG flag to start filtering.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-hos-border text-xs uppercase text-hos-text-muted">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Market</th>
                  <th className="px-4 py-3">Price override</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-hos-border/50 hover:bg-hos-bg-tertiary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-hos-text-secondary">
                      <span className="font-medium">{r.product?.name || r.productId}</span>
                      {r.product?.sku && <span className="text-xs text-hos-text-muted ml-2 font-mono">{r.product.sku}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-hos-bg-tertiary text-hos-text-secondary text-xs font-medium">
                        {r.market?.code || '??'}
                      </span>
                      <span className="text-hos-text-muted text-xs ml-2">{r.market?.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-hos-text-secondary font-mono">
                      {r.priceOverride != null ? `${r.currency || ''} ${r.priceOverride.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.isActive ? (
                        <span className="inline-flex items-center gap-1 text-green-400 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-hos-text-muted text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-hos-text-muted/50" />
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
