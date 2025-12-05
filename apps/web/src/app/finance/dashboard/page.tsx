'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

export default function FinanceDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getFinanceDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching finance dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <RouteGuard allowedRoles={['FINANCE']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Finance Dashboard</h1>
            <div className="flex gap-3">
              <a
                href="/finance/pricing"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
              >
                Review Pricing
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Pending Approvals</h3>
                  <p className="text-2xl sm:text-3xl font-bold">{dashboardData?.totalPending?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Revenue</h3>
                  <p className="text-2xl sm:text-3xl font-bold">$0</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Platform Fees</h3>
                  <p className="text-2xl sm:text-3xl font-bold">$0</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-lg font-semibold mb-2">Payouts Pending</h3>
                  <p className="text-2xl sm:text-3xl font-bold">$0</p>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Pricing Approvals</h2>
                  {dashboardData?.pendingApprovals && dashboardData.pendingApprovals.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {dashboardData.pendingApprovals.slice(0, 10).map((approval: any) => (
                        <div key={approval.id} className="text-sm text-gray-600 border-b pb-2">
                          <p className="font-medium">{approval.seller?.storeName || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{approval.status}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base text-gray-500">No pending pricing approvals</p>
                  )}
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Pricing History</h2>
                  {dashboardData?.pricingHistory && dashboardData.pricingHistory.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {dashboardData.pricingHistory.slice(0, 10).map((history: any) => (
                        <div key={history.id} className="text-sm text-gray-600 border-b pb-2">
                          <p className="font-medium">{history.product?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(history.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base text-gray-500">No pricing history</p>
                  )}
                </div>
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
