'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const response = await apiClient.searchProducts(searchQuery.trim());
      const data = response?.data;
      const hits = data?.hits || data?.data || data?.products || [];
      setSearchResults(Array.isArray(hits) ? hits.slice(0, 10) : []);
      setSearchCount(data?.totalHits ?? data?.total ?? (Array.isArray(hits) ? hits.length : 0));
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
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Search Management</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchStats} className="mt-2 text-sm text-red-600 underline hover:text-red-800">
                Retry
              </button>
            </div>
          )}

          {actionMessage && (
            <div
              className={`rounded-lg p-4 border ${
                actionMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {actionMessage.text}
            </div>
          )}

          {/* Health & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Health Status</h3>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className={`inline-block w-3 h-3 rounded-full ${
                    healthy ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className={`text-lg font-semibold ${healthy ? 'text-green-700' : 'text-red-700'}`}>
                  {healthy ? 'Healthy' : 'Unreachable'}
                </span>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Documents</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.totalDocuments?.toLocaleString() ?? '—'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Index Size</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.indexSize ?? '—'}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Last Updated</h3>
              <p className="text-lg font-semibold text-gray-900 mt-2">
                {stats?.lastUpdate ? new Date(stats.lastUpdate).toLocaleString() : '—'}
              </p>
            </div>
          </div>

          {/* Index Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Index Operations</h2>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => setConfirmAction('sync')}
                disabled={syncing || rebuilding}
                className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {syncing && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {syncing ? 'Syncing...' : 'Sync Products'}
              </button>
              <button
                onClick={() => setConfirmAction('rebuild')}
                disabled={syncing || rebuilding}
                className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {rebuilding && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {rebuilding ? 'Rebuilding...' : 'Rebuild Index'}
              </button>
              <button
                onClick={fetchStats}
                disabled={loading}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Refresh Stats
              </button>
            </div>
          </div>

          {/* Confirmation Dialog */}
          {confirmAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {confirmAction === 'sync' ? 'Sync Products?' : 'Rebuild Index?'}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {confirmAction === 'sync'
                    ? 'This will sync all products to the Meilisearch index. Existing documents will be updated.'
                    : 'This will completely rebuild the search index from scratch. This may take a while and search may be temporarily unavailable.'}
                </p>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAction === 'sync' ? handleSync : handleRebuild}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                      confirmAction === 'sync' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Search Testing Tool */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Testing</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter search query..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {searching && <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                Search
              </button>
            </div>

            {searchCount !== null && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-3">
                  Found <span className="font-semibold text-gray-900">{searchCount}</span> result{searchCount !== 1 ? 's' : ''}
                  {searchResults.length > 0 && searchCount > searchResults.length && (
                    <span className="text-gray-500"> (showing first {searchResults.length})</span>
                  )}
                </p>

                {searchResults.length > 0 && (
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {searchResults.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                              {String(item.id).slice(0, 8)}...
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {item.name || item.title || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 text-right">
                              {item.price != null ? `£${Number(item.price).toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Index Details */}
          {stats?.indexes && stats.indexes.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Index Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Index</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Documents</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stats.indexes.map((idx: any, i: number) => (
                      <tr key={idx.uid || i} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{idx.uid || idx.name || `Index ${i + 1}`}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 text-right">{idx.numberOfDocuments?.toLocaleString() ?? '—'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500 text-right">{idx.size ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
