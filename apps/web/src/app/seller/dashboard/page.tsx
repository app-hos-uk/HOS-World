'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import Link from 'next/link';

interface SellerDashboardData {
  totalSales: number;
  totalOrders: number;
  totalProducts: number;
  averageOrderValue: number;
  submissions?: any[];
  submissionsByStatus?: Array<{ status: string; _count: number }>;
  recentOrders?: any[];
}

export default function SellerDashboardPage() {
  const { formatPrice } = useCurrency();
  const [dashboardData, setDashboardData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems = getSellerMenuItems(false);

  const fetchDashboardData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      try {
        const profileResponse = await apiClient.getSellerProfile();
        const seller = profileResponse?.data;
        if (!seller || !seller.storeName || !seller.country) {
          if (showLoading) window.location.href = '/seller/onboarding';
          return;
        }
      } catch (profileErr: any) {
        if (profileErr.message?.includes('not found') || profileErr.status === 404) {
          if (showLoading) window.location.href = '/seller/onboarding';
          return;
        }
      }
      const response = await apiClient.getSellerDashboardData();
      if (response?.data) {
        setDashboardData(response.data);
      } else if (showLoading) {
        setError('Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error('Error fetching seller dashboard:', err);
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
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Seller Dashboard</h1>
          <p className="text-hos-text-secondary mt-2">Manage your products, orders, and submissions</p>
        </div>

        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                  <div className="h-4 bg-hos-bg-tertiary rounded w-24 mb-3" />
                  <div className="h-8 bg-hos-bg-tertiary rounded w-32 mb-2" />
                  <div className="h-3 bg-hos-bg-tertiary rounded w-20 mt-2" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                  <div className="h-5 bg-hos-bg-tertiary rounded w-40 mb-4" />
                  <div className="space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-16 bg-hos-bg-tertiary rounded" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-6 flex items-center justify-between">
            <span>Error: {error}</span>
            <button
              onClick={() => fetchDashboardData(true)}
              className="ml-4 px-4 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Retry
            </button>
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
                      {formatPrice(Number(dashboardData?.totalSales) || 0)}
                    </p>
                  </div>
                  <div className="text-4xl">💵</div>
                </div>
                <Link
                  href="/seller/orders"
                  className="text-sm text-green-400 hover:text-green-400 mt-2 inline-block"
                >
                  View orders →
                </Link>
              </div>

              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Total Orders</h3>
                    <p className="text-3xl font-bold text-hos-gold">
                      {dashboardData?.totalOrders?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-4xl">🛒</div>
                </div>
                <Link
                  href="/seller/orders"
                  className="text-sm text-hos-gold hover:text-hos-gold-hover mt-2 inline-block"
                >
                  Manage orders →
                </Link>
              </div>

              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-hos-text-secondary mb-1">Total Products</h3>
                    <p className="text-3xl font-bold text-hos-gold">
                      {dashboardData?.totalProducts?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-4xl">📦</div>
                </div>
                <Link
                  href="/seller/products"
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
                  href="/seller/submissions"
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
                    href="/seller/submissions"
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
                        href={`/seller/submit-product?id=${submission.id}`}
                        className="block p-3 border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-hos-text-secondary">
                              {submission.productData?.name || 'Untitled Product'}
                            </p>
                            <p className="text-sm text-hos-text-muted mt-1">
                              Status: {submission.status}
                            </p>
                            <p className="text-xs text-hos-text-muted mt-1">
                              {new Date(submission.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              ['PROCUREMENT_APPROVED', 'FINANCE_APPROVED', 'PUBLISHED', 'CATALOG_COMPLETED'].includes(submission.status)
                                ? 'bg-green-500/15 text-green-300'
                                : ['PROCUREMENT_REJECTED', 'FINANCE_REJECTED', 'REJECTED'].includes(submission.status)
                                  ? 'bg-red-500/15 text-red-300'
                                  : 'bg-yellow-500/15 text-yellow-300'
                            }`}
                          >
                            {submission.status?.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-hos-text-muted">
                    <p>No recent submissions</p>
                    <Link
                      href="/seller/submit-product"
                      className="text-sm text-hos-gold hover:text-hos-gold-hover mt-2 inline-block"
                    >
                      Submit your first product →
                    </Link>
                  </div>
                )}
              </div>

              <div className="bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Orders</h2>
                  <Link
                    href="/seller/orders"
                    className="text-sm text-hos-gold hover:text-hos-gold-hover"
                  >
                    View all →
                  </Link>
                </div>
                {dashboardData?.recentOrders && dashboardData.recentOrders.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData.recentOrders.slice(0, 10).map((order: any) => (
                      <Link
                        key={order.id}
                        href={`/seller/orders?id=${order.id}`}
                        className="block p-3 border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-hos-text-secondary">
                              Order #{order.orderNumber || order.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-hos-text-muted mt-1">
                              {formatPrice(parseFloat(order.total || 0))}
                            </p>
                            <p className="text-xs text-hos-text-muted mt-1">
                              {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              (order.status || '').toUpperCase() === 'DELIVERED'
                                ? 'bg-green-500/15 text-green-300'
                                : (order.status || '').toUpperCase() === 'CANCELLED'
                                  ? 'bg-red-500/15 text-red-300'
                                  : 'bg-hos-gold/20 text-hos-gold'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-hos-text-muted">
                    <p>No recent orders</p>
                    <p className="text-sm mt-2">Orders will appear here when customers purchase your products</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 bg-hos-bg-secondary border rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Average Order Value</h3>
                  <p className="text-3xl font-bold text-hos-gold">
                    {formatPrice(Number(dashboardData?.averageOrderValue) || 0)}
                  </p>
                </div>
                <Link
                  href="/seller/submit-product"
                  className="px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
                >
                  Submit New Product
                </Link>
              </div>
            </div>
          </>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}


