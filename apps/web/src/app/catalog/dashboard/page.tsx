'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

export default function CatalogDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getCatalogDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching catalog dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <RouteGuard allowedRoles={['CATALOG']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Catalog Team Dashboard</h1>
            <div className="flex gap-3">
              <a
                href="/catalog/entries"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
              >
                Manage Entries
              </a>
            </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:p-6 mb-6 sm:mb-8">
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Pending Entries</h3>
                  <p className="text-2xl sm:text-3xl font-bold">{dashboardData?.totalPending?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">In Progress</h3>
                  <p className="text-2xl sm:text-3xl font-bold">{dashboardData?.totalInProgress?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Completed Today</h3>
                  <p className="text-2xl sm:text-3xl font-bold">-</p>
                </div>
              </div>
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Pending Catalog Creation</h2>
                {dashboardData?.pendingEntries && dashboardData.pendingEntries.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {dashboardData.pendingEntries.slice(0, 20).map((entry: any) => (
                      <div key={entry.id} className="text-sm text-gray-600 border-b pb-2">
                        <p className="font-medium">{entry.seller?.storeName || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">Status: {entry.status}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No pending catalog entries</p>
                )}
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
