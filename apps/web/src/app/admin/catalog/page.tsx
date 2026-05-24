'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function AdminCatalogPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getCatalogPending();
      if (response?.data && Array.isArray(response.data)) {
        setEntries(response.data);
      } else {
        setEntries([]);
      }
    } catch (err: any) {
      console.error('Error fetching catalog entries:', err);
      if (showLoading) {
        setError(err.message || 'Failed to load catalog entries');
        setEntries([]);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries(true);
  }, [fetchEntries]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchEntries(false);
    };
    const interval = setInterval(() => fetchEntries(false), 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchEntries]);

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading catalog entries...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  if (error) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error: {error}</p>
            <button
              onClick={() => fetchEntries(true)}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Catalog Entries</h1>
              <p className="text-sm text-hos-text-muted mt-1">Pending submissions ready for catalog creation</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchEntries(true)}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <Link
                href="/catalog/entries"
                className="px-4 py-2 text-sm font-medium text-white bg-hos-gold rounded-lg hover:bg-hos-gold-hover"
              >
                Full Catalog Workflow →
              </Link>
            </div>
          </div>

          <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-hos-border">
              <thead className="bg-hos-bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                    Submission ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-hos-text-muted">
                      No catalog entries found
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    // API returns ProductSubmission objects: id is submission id, productData/product hold name
                    const submissionId = entry.submissionId ?? entry.id;
                    const productName =
                      (entry.productData && typeof entry.productData === 'object' && (entry.productData as { name?: string }).name) ||
                      entry.product?.name ||
                      entry.submission?.product?.name ||
                      'N/A';
                    const completed = entry.completed ?? !!entry.catalogEntry;
                    return (
                      <tr key={entry.id || submissionId} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                          {submissionId ? `${String(submissionId).substring(0, 8)}...` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {productName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              completed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {completed ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleDateString()
                            : 'N/A'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

