'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function CatalogDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pendingCount =
    dashboardData?.totalPending ??
    (Array.isArray(dashboardData?.pendingEntries) ? dashboardData.pendingEntries.length : 0);
  const inProgressCount =
    dashboardData?.totalInProgress ??
    (Array.isArray(dashboardData?.inProgress) ? dashboardData.inProgress.length : 0);
  const menuItems = [
    { title: 'Dashboard', href: '/catalog/dashboard', icon: '📊' },
    { title: 'Catalog Entries', href: '/catalog/entries', icon: '📚', badge: pendingCount },
  ];

  const fetchDashboardData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getCatalogDashboardData();
      if (response?.data) {
        setDashboardData(response.data);
      } else if (showLoading) {
        setError('Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error('Error fetching catalog dashboard:', err);
      if (showLoading) setError(err.message || 'Failed to load dashboard data');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData(true);
  }, [fetchDashboardData]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchDashboardData(false);
    };
    const interval = setInterval(() => fetchDashboardData(false), 30_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchDashboardData]);
  const completedToday = dashboardData?.completedToday || 0;
  const totalEntries = dashboardData?.totalEntries || 0;

  return (
    <RouteGuard allowedRoles={['CATALOG', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="CATALOG" menuItems={menuItems} title="Catalog">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Catalog Dashboard</h1>
            <p className="text-gray-600 mt-2">Create marketplace-ready product listings</p>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Entries</h3>
                    <p className="text-3xl font-bold text-purple-600">{pendingCount.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">📝</div>
                </div>
                <Link
                  href="/catalog/entries"
                  className="text-sm text-purple-600 hover:text-purple-700 mt-2 inline-block"
                >
                  Create entries →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">In Progress</h3>
                    <p className="text-3xl font-bold text-yellow-600">{inProgressCount.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
                <Link
                  href="/catalog/entries?status=in_progress"
                  className="text-sm text-yellow-600 hover:text-yellow-700 mt-2 inline-block"
                >
                  Continue work →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Completed Today</h3>
                    <p className="text-3xl font-bold text-green-600">{completedToday.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">✅</div>
                </div>
                <Link
                  href="/catalog/entries?status=completed"
                  className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Total Entries</h3>
                    <p className="text-3xl font-bold text-blue-600">{totalEntries.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">📚</div>
                </div>
                <Link
                  href="/catalog/entries"
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Pending Catalog Creation</h2>
                  <Link
                    href="/catalog/entries"
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    View all →
                  </Link>
                </div>
                {dashboardData?.pendingSubmissions && dashboardData.pendingSubmissions.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData.pendingSubmissions.slice(0, 10).map((submission: any) => (
                      <Link
                        key={submission.id}
                        href={`/catalog/entries?submission=${submission.id}`}
                        className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {submission.product?.name || (submission.productData as any)?.name || 'Untitled Product'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {submission.seller?.storeName || 'Unknown Seller'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Ready for catalog creation
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                            PENDING
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No pending catalog entries</p>
                    <p className="text-sm mt-2">Approved submissions will appear here</p>
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Link
                    href="/catalog/entries"
                    className="block p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">➕</div>
                    <p className="font-medium">Create New Entry</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {pendingCount} submissions ready for catalog creation
                    </p>
                  </Link>
                  <Link
                    href="/catalog/entries?status=in_progress"
                    className="block p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📝</div>
                    <p className="font-medium">Continue Work</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {inProgressCount} entries in progress
                    </p>
                  </Link>
                  <Link
                    href="/procurement/submissions?view=cross-seller"
                    className="block p-4 border-2 border-dashed border-amber-300 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">🔄</div>
                    <p className="font-medium">Same product from multiple sellers</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Review and resolve duplicate submissions across sellers
                    </p>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}


