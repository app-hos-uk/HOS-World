'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import Link from 'next/link';

export default function WholesalerDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems = getSellerMenuItems(true);

  const fetchDashboardData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getWholesalerDashboardData();
      if (response?.data) {
        setDashboardData(response.data);
      } else if (showLoading) {
        setError('Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error('Error fetching wholesaler dashboard:', err);
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

  const pendingApprovals = dashboardData?.submissionsByStatus
    ?.filter((s: any) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW')
    .reduce((sum: number, s: any) => sum + (typeof s._count === 'number' ? s._count : s._count?._all || 0), 0) || 0;

  return (
    <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Wholesaler Dashboard</h1>
          <p className="text-hos-text-secondary mt-2">Manage bulk products and wholesale operations</p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-6">
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Total Sales</h3>
                    <p className="text-3xl font-bold text-green-400">
                      ${dashboardData?.totalSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>
                  <div className="text-4xl">💵</div>
                </div>
                <Link
                  href="/wholesaler/orders"
                  className="text-sm text-green-400 hover:text-green-400 mt-2 inline-block"
                >
                  View orders →
                </Link>
              </div>

              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Bulk Orders</h3>
                    <p className="text-3xl font-bold text-hos-gold">
                      {dashboardData?.totalOrders?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-4xl">📦</div>
                </div>
                <Link
                  href="/wholesaler/orders"
                  className="text-sm text-hos-gold hover:text-hos-gold-hover mt-2 inline-block"
                >
                  Manage orders →
                </Link>
              </div>

              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Active Products</h3>
                    <p className="text-3xl font-bold text-hos-gold">
                      {dashboardData?.totalProducts?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-4xl">🛍️</div>
                </div>
                <Link
                  href="/wholesaler/products"
                  className="text-sm text-hos-gold hover:text-hos-gold-hover mt-2 inline-block"
                >
                  View products →
                </Link>
              </div>

              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Pending Approvals</h3>
                    <p className="text-3xl font-bold text-orange-400">
                      {pendingApprovals.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
                <Link
                  href="/wholesaler/submissions"
                  className="text-sm text-orange-400 hover:text-orange-400 mt-2 inline-block"
                >
                  View submissions →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Submissions</h2>
                  <Link
                    href="/wholesaler/submissions"
                    className="text-sm text-hos-gold hover:text-hos-gold-hover"
                  >
                    View all →
                  </Link>
                </div>
                {dashboardData?.submissions && dashboardData.submissions.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData.submissions.slice(0, 10).map((submission: any) => (
                      <Link
                        key={submission.id}
                        href={`/wholesaler/submissions?id=${submission.id}`}
                        className="block p-3 border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-hos-text-secondary">
                              {submission.productData?.name || 'Untitled Product'}
                            </p>
                            <p className="text-sm text-hos-text-muted mt-1">
                              Stock: {submission.productData?.stock ?? 'N/A'}{submission.productData?.quantity ? ` · Min. Order: ${submission.productData.quantity}` : ''} | Status: {submission.status}
                            </p>
                            <p className="text-xs text-hos-text-muted mt-1">
                              {new Date(submission.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              submission.status === 'PROCUREMENT_APPROVED'
                                ? 'bg-green-500/15 text-green-300'
                                : submission.status === 'PROCUREMENT_REJECTED'
                                  ? 'bg-red-500/15 text-red-300'
                                  : 'bg-yellow-500/15 text-yellow-300'
                            }`}
                          >
                            {submission.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-hos-text-muted">
                    <p>No recent submissions</p>
                    <Link
                      href="/wholesaler/submit-product"
                      className="text-sm text-hos-gold hover:text-hos-gold-hover mt-2 inline-block"
                    >
                      Submit your first product →
                    </Link>
                  </div>
                )}
              </div>

              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Bulk Order Statistics</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-hos-bg-secondary rounded-lg">
                    <span className="text-sm font-medium text-hos-text-secondary">Average Order Quantity</span>
                    <span className="text-lg font-bold text-hos-gold">
                      {dashboardData?.averageOrderQuantity?.toLocaleString() || '0'} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-hos-bg-secondary rounded-lg">
                    <span className="text-sm font-medium text-hos-text-secondary">Total Units Sold</span>
                    <span className="text-lg font-bold text-green-400">
                      {dashboardData?.totalUnitsSold?.toLocaleString() || '0'} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-hos-bg-secondary rounded-lg">
                    <span className="text-sm font-medium text-hos-text-secondary">Average Order Value</span>
                    <span className="text-lg font-bold text-hos-gold">
                      ${dashboardData?.averageOrderValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Wholesale operations</h3>
                  <p className="text-hos-text-secondary">
                    Submit one product for review, or import many at once from a CSV file.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Link
                    href="/wholesaler/bulk"
                    className="px-6 py-3 border-2 border-hos-gold text-hos-gold-hover rounded-lg hover:bg-hos-gold/10 transition-colors font-medium text-center"
                  >
                    Bulk upload (CSV)
                  </Link>
                  <Link
                    href="/wholesaler/submit-product"
                    className="px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium text-center"
                  >
                    Submit single product
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


