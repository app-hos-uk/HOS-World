'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function FinanceDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pendingApprovals = dashboardData?.pendingApprovals || 0;
  const menuItems = [
    { title: 'Dashboard', href: '/finance/dashboard', icon: '📊' },
    { title: 'Pricing Approvals', href: '/finance/pricing', icon: '💰', badge: pendingApprovals },
  ];

  const fetchDashboardData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getFinanceDashboardData();
      if (response?.data) {
        setDashboardData(response.data);
      } else if (showLoading) {
        setError('Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error('Error fetching finance dashboard:', err);
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
    const interval = setInterval(() => fetchDashboardData(false), 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchDashboardData]);
  const totalRevenue = dashboardData?.totalRevenue || 0;
  const platformFees = dashboardData?.platformFees || 0;
  const payoutsPending = dashboardData?.payoutsPending || 0;

  return (
    <RouteGuard allowedRoles={['FINANCE', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="FINANCE" menuItems={menuItems} title="Finance">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Finance Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage pricing approvals and financial operations</p>
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
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Approvals</h3>
                    <p className="text-3xl font-bold text-purple-600">{pendingApprovals.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">💰</div>
                </div>
                <Link
                  href="/finance/pricing"
                  className="text-sm text-purple-600 hover:text-purple-700 mt-2 inline-block"
                >
                  Review now →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Total Revenue</h3>
                    <p className="text-3xl font-bold text-green-600">
                      ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-4xl">💵</div>
                </div>
                <Link
                  href="/finance/reports/revenue"
                  className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block"
                >
                  View reports →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Platform Fees</h3>
                    <p className="text-3xl font-bold text-blue-600">
                      ${platformFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-4xl">📊</div>
                </div>
                <Link
                  href="/finance/reports/fees"
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                >
                  View details →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Payouts Pending</h3>
                    <p className="text-3xl font-bold text-orange-600">
                      ${payoutsPending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-4xl">💸</div>
                </div>
                <Link
                  href="/finance/payouts"
                  className="text-sm text-orange-600 hover:text-orange-700 mt-2 inline-block"
                >
                  Process payouts →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Pricing Approvals</h2>
                  <Link
                    href="/finance/pricing"
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    View all →
                  </Link>
                </div>
                {dashboardData?.pricingApprovals && dashboardData.pricingApprovals.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData.pricingApprovals.slice(0, 10).map((approval: any) => (
                      <Link
                        key={approval.id}
                        href={`/finance/pricing?submission=${approval.submissionId}`}
                        className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {approval.submission?.catalogEntry?.title ||
                                approval.submission?.productData?.name ||
                                'Untitled Product'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {approval.submission?.seller?.storeName || 'Unknown Seller'}
                            </p>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              {approval.submission?.productData?.price && (
                                <span>
                                  Price: ${parseFloat(approval.submission.productData.price).toFixed(2)}
                                </span>
                              )}
                              {approval.margin && <span>Margin: {approval.margin}%</span>}
                            </div>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            PENDING
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No pending pricing approvals</p>
                    <p className="text-sm mt-2">Catalog entries ready for pricing will appear here</p>
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Pricing History</h2>
                {dashboardData?.pricingHistory && dashboardData.pricingHistory.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData.pricingHistory.slice(0, 10).map((item: any) => (
                      <div
                        key={item.id}
                        className="p-3 border rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {item.submission?.catalogEntry?.title || 'Unknown Product'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Margin: {item.margin}% | Visibility: {item.visibilityLevel}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(item.financeApprovedAt || item.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            APPROVED
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No pricing history</p>
                    <p className="text-sm mt-2">Approved pricing will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}


