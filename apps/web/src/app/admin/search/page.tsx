'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

interface SearchStats {
  totalDocuments?: number;
  indexSize?: string;
  lastUpdate?: string;
  indexes?: any[];
  health?: boolean;
}

interface SearchResult {
  id: string;
  name?: string;
  title?: string;
  price?: number;
  [key: string]: any;
}

export default function AdminSearchPage() {
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const SEARCH_PAGE_SIZE = 20;

  const [confirmAction, setConfirmAction] = useState<'sync' | 'rebuild' | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getSearchStats();
      if (response?.data) {
        setStats(response.data);
        setHealthy(true);
      }
    } catch (err: any) {
      console.error('Error fetching search stats:', err);
      setHealthy(false);
      setError(err.message || 'Failed to connect to search service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchCount(null);
      setSearchPage(1);
    }
  }, [searchQuery]);

  const handleSync = async () => {
    setConfirmAction(null);
    try {
      setSyncing(true);
      setActionMessage(null);
      await apiClient.syncSearchIndex();
      setActionMessage({ type: 'success', text: 'Products synced to search index successfully.' });
      fetchStats();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleRebuild = async () => {
    setConfirmAction(null);
    try {
      setRebuilding(true);
      setActionMessage(null);
      await apiClient.rebuildSearchIndex();
      setActionMessage({ type: 'success', text: 'Search index rebuilt successfully.' });
      fetchStats();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Rebuild failed.' });
    } finally {
      setRebuilding(false);
    }
  };

  const handleSearch = async (page: number = 1) => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const q = searchQuery.trim();
      const response = await apiClient.searchProducts(q, {
        page,
        limit: SEARCH_PAGE_SIZE,
      });
      const data = response?.data as any;
      const hits = data?.products || data?.hits || data?.data || [];
      setSearchResults(Array.isArray(hits) ? hits : []);
      const total =
        data?.total ??
        data?.totalHits ??
        (Array.isArray(hits) ? hits.length : 0);
      setSearchCount(Number(total) || 0);
      setSearchPage(page);
    } catch (err: any) {
      setSearchResults([]);
      setSearchCount(0);
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
                  <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" />
          </div>
              </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="space-y-6">
          <h1 className="text-2xl font-bold text-hos-text-secondary">Search Management</h1>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button onClick={fetchStats} className="mt-2 text-sm text-red-400 underline hover:text-red-300">
                Retry
              </button>
            </div>
          )}

          {actionMessage && (
            <div
              className={`rounded-lg p-4 border ${
                actionMessage.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {actionMessage.text}
            </div>
          )}

          {/* Health & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Health Status</h3>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    healthy ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                />
                <span className={`text-lg font-semibold ${healthy ? 'text-green-400' : 'text-red-400'}`}>
                  {healthy ? 'Healthy' : 'Unreachable'}
                </span>
              </div>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Documents</h3>
              <p className="text-3xl font-bold text-hos-text-secondary mt-2">
                {stats?.totalDocuments?.toLocaleString() ?? '—'}
              </p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Index Size</h3>
              <p className="text-3xl font-bold text-hos-text-secondary mt-2">{stats?.indexSize ?? '—'}</p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Last Updated</h3>
              <p className="text-lg font-semibold text-hos-text-secondary mt-2">
                {stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleString() : '—'}
              </p>
            </div>
          </div>

          {/* Index Actions */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Index Operations</h2>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setConfirmAction('sync')}
                disabled={syncing || rebuilding}
                className="px-5 py-2.5 text-sm font-medium text-[#1a1406] bg-hos-gold rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {syncing && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {syncing ? 'Syncing...' : 'Sync Products'}
              </button>
              <button
                onClick={() => setConfirmAction('rebuild')}
                disabled={syncing || rebuilding}
                className="px-5 py-2.5 text-sm font-medium text-hos-text-secondary bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {rebuilding && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {rebuilding ? 'Rebuilding...' : 'Rebuild Index'}
              </button>
              <button
                onClick={fetchStats}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-lg hover:bg-hos-bg-tertiary"
              >
                Refresh Stats
              </button>
            </div>
          </div>

          {/* Confirmation Dialog */}
          {confirmAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-hos-bg-secondary rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                <h3 className="text-lg font-semibold text-hos-text-secondary">
                  {confirmAction === 'sync' ? 'Sync Products?' : 'Rebuild Index?'}
                </h3>
                <p className="mt-2 text-sm text-hos-text-secondary">
                  {confirmAction === 'sync'
                    ? 'This will sync all products to the Meilisearch index. Existing documents will be updated.'
                    : 'This will completely rebuild the search index from scratch. This may take a while and search may be temporarily unavailable.'}
                </p>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-md hover:bg-hos-bg-tertiary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAction === 'sync' ? handleSync : handleRebuild}
                    className={`px-4 py-2 text-sm font-medium text-hos-text-secondary rounded-md ${
                      confirmAction === 'sync' ? 'bg-hos-gold hover:bg-hos-gold-hover' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search Testing Tool */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Search Testing</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(1)}
                placeholder="Enter search query (leave empty for all products, paginated)"
                className="flex-1 px-4 py-2.5 border border-hos-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
              />
              <button
                type="button"
                onClick={() => handleSearch(1)}
                disabled={searching || !searchQuery.trim()}
                className="px-5 py-2.5 text-sm font-medium text-[#1a1406] bg-hos-gold rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {searching && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                Search
              </button>
            </div>

            {searchCount !== null && (
              <div className="mt-4">
                <p className="text-sm text-hos-text-secondary mb-3">
                  Found <span className="font-semibold text-hos-text-secondary">{searchCount}</span> result{searchCount !== 1 ? 's' : ''}
                  {searchCount > 0 && (
                    <span className="text-hos-text-muted">
                      {' '}
                      (page {searchPage} of {Math.max(1, Math.ceil(searchCount / SEARCH_PAGE_SIZE))}, {SEARCH_PAGE_SIZE} per page)
                    </span>
                  )}
                </p>

                {searchResults.length > 0 && (
                  <>
                  <div className="overflow-x-auto border border-hos-border rounded-lg">
                    <table className="min-w-full divide-y divide-hos-border">
                      <thead className="bg-hos-bg-secondary">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Name</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hos-border">
                        {searchResults.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-hos-bg-tertiary">
                            <td className="px-4 py-3 text-sm text-hos-text-muted font-mono">
                              {String(item.id).slice(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-hos-text-secondary">
                              {item.name || item.title || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-hos-text-secondary text-right">
                              {item.price != null ? `$${Number(item.price).toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(() => {
                    const totalPages = Math.max(1, Math.ceil(searchCount / SEARCH_PAGE_SIZE));
                    if (totalPages <= 1) return null;
                    return (
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSearch(searchPage - 1)}
                          disabled={searching || searchPage <= 1}
                          className="px-3 py-2 text-sm border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-sm text-hos-text-secondary">
                          Page {searchPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSearch(searchPage + 1)}
                          disabled={searching || searchPage >= totalPages}
                          className="px-3 py-2 text-sm border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>
                    );
                  })()}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Index Details */}
          {stats?.indexes && stats.indexes.length > 0 && (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Index Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Index</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Documents</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hos-border">
                    {stats.indexes.map((idx: any, i: number) => (
                      <tr key={idx.uid || i} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4 text-sm font-medium text-hos-text-secondary">{idx.uid || idx.name || `Index ${i + 1}`}</td>
                        <td className="px-6 py-4 text-sm text-hos-text-secondary text-right">{idx.numberOfDocuments?.toLocaleString() ?? '—'}</td>
                        <td className="px-6 py-4 text-sm text-hos-text-muted text-right">{idx.size ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
