'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useMoney } from '@/hooks/useMoney';
import Link from 'next/link';

type Connection = {
  id: string;
  storeId: string;
  provider: string;
  isActive: boolean;
  store?: { id?: string; name?: string; code?: string };
};

type PosProduct = {
  externalId: string;
  sku?: string;
  name: string;
  price?: number;
  costPrice?: number;
  imageUrl?: string;
  alreadyLinkedProductId?: string | null;
};

const INPUT_CLS =
  'w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

export default function AdminPosProductPullPage() {
  const toast = useToast();
  const { formatMoney } = useMoney();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConn, setSelectedConn] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PosProduct[]>([]);

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getPosConnections();
      const data = res?.data;
      setConnections(
        Array.isArray(data)
          ? data.filter((c: Connection) => c.isActive && c.provider === 'lightspeed')
          : [],
      );
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  const handleSearch = useCallback(async () => {
    if (!selectedConn || !query.trim()) return;
    setSearching(true);
    try {
      const res = await apiClient.searchPosConnectionProducts(selectedConn, {
        query: query.trim(),
      });
      setResults(Array.isArray(res?.data) ? res.data : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }, [selectedConn, query, toast]);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/pos" className="text-sm text-hos-gold hover:text-hos-gold-hover">&larr; POS</Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Pull Products from POS</h1>
        </div>
        <p className="text-sm text-hos-text-muted">
          Search the connected Lightspeed catalogue. Selecting a product pre-fills a submission &mdash; it does not create a live product.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Connection</label>
            <select
              className={`${INPUT_CLS} min-w-[200px]`}
              value={selectedConn}
              onChange={(e) => setSelectedConn(e.target.value)}
            >
              <option value="">Select…</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.store?.name || c.storeId} ({c.provider})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Search</label>
            <input
              className={INPUT_CLS}
              placeholder="Product name or SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            type="button"
            disabled={searching || !selectedConn || !query.trim()}
            onClick={handleSearch}
            className="px-4 py-2 rounded-lg bg-hos-gold text-white text-sm disabled:opacity-50"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {!searching && results.length === 0 && query.trim() && selectedConn && (
          <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-8 text-center">
            <p className="text-hos-text-muted">No products found for &ldquo;{query}&rdquo;</p>
            <p className="text-xs text-hos-text-muted mt-1">Try a different name, SKU, or check the connection.</p>
          </div>
        )}

        {results.length > 0 && (
          <div>
            <p className="text-xs text-hos-text-muted mb-2">{results.length} product{results.length !== 1 ? 's' : ''} found</p>
            <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-hos-border text-xs uppercase text-hos-text-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((p) => (
                  <tr key={p.externalId} className="border-b border-hos-border/50 hover:bg-hos-bg-tertiary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-hos-text-secondary">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-hos-border/50" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-hos-bg-tertiary flex items-center justify-center text-hos-text-muted text-xs">—</div>
                        )}
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-hos-text-muted">{p.sku || '—'}</td>
                    <td className="px-4 py-3 text-sm text-hos-text-secondary">
                      {p.price != null ? formatMoney(p.price) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {p.alreadyLinkedProductId ? (
                        <Link
                          href={`/admin/products?id=${p.alreadyLinkedProductId}`}
                          className="text-hos-gold hover:underline"
                        >
                          Already linked
                        </Link>
                      ) : (
                        <span className="text-hos-text-muted">Not linked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {!loading && connections.length === 0 && (
          <p className="text-sm text-hos-text-muted">
            No active Lightspeed connections. <Link href="/admin/pos" className="text-hos-gold">Configure one first</Link>.
          </p>
        )}
      </div>
    </RouteGuard>
  );
}
