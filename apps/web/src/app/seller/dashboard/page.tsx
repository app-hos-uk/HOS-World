'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function SellerDashboardPage() {
  const [dashboardData, setDashboardData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  interface SellerDashboardData {
    totalSales: number;
    totalOrders: number;
    totalProducts: number;
    averageOrderValue: number;
    submissions?: any[];
    submissionsByStatus?: Array<{ status: string; _count: number }>;
    recentOrders?: any[];
  }

  const menuItems = [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
    { title: 'Support', href: '/seller/support', icon: '🎧' },
  ];

  useEffect(() => {
    const checkOnboardingAndFetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // First check if seller profile is complete
        try {
          const profileResponse = await apiClient.getSellerProfile();
          const seller = profileResponse?.data;

          // If profile is incomplete, redirect to onboarding
          if (!seller || !seller.storeName || !seller.country) {
            window.location.href = '/seller/onboarding';
            return;
          }
        } catch (profileErr: any) {
          // If profile doesn't exist, redirect to onboarding
          if (profileErr.message?.includes('not found') || profileErr.status === 404) {
            window.location.href = '/seller/onboarding';
            return;
          }
        }

        // Fetch dashboard data
        const response = await apiClient.getSellerDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching seller dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingAndFetchData();
  }, []);

  const pendingApprovals = dashboardData?.submissionsByStatus?.find(
    (s) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW'
  )?._count || 0;

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Seller Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your products, orders, and submissions</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Total Sales</h3>
                    <p className="text-3xl font-bold text-green-600">
                      ${dashboardData?.totalSales?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </p>
                  </div>
                  <div className="text-4xl">💵</div>
                </div>
                <Link
                  href="/seller/orders"
                  className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block"
                >
                  View orders →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Total Orders</h3>
                    <p className="text-3xl font-bold text-blue-600">
                      {dashboardData?.totalOrders?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-4xl">🛒</div>
                </div>
                <Link
                  href="/seller/orders"
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                >
                  Manage orders →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Active Products</h3>
                    <p className="text-3xl font-bold text-purple-600">
                      {dashboardData?.totalProducts?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-4xl">📦</div>
                </div>
                <Link
                  href="/seller/products"
                  className="text-sm text-purple-600 hover:text-purple-700 mt-2 inline-block"
                >
                  View products →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Approvals</h3>
                    <p className="text-3xl font-bold text-orange-600">
                      {pendingApprovals.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
                <Link
                  href="/seller/submissions"
                  className="text-sm text-orange-600 hover:text-orange-700 mt-2 inline-block"
                >
                  View submissions →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Submissions</h2>
                  <Link
                    href="/seller/submissions"
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    View all →
                  </Link>
                </div>
                {dashboardData?.submissions && dashboardData.submissions.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData.submissions.slice(0, 10).map((submission: any) => (
                      <Link
                        key={submission.id}
                        href={`/seller/submissions?id=${submission.id}`}
                        className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {submission.productData?.name || 'Untitled Product'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Status: {submission.status}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(submission.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              submission.status === 'PROCUREMENT_APPROVED'
                                ? 'bg-green-100 text-green-800'
                                : submission.status === 'PROCUREMENT_REJECTED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {submission.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent submissions</p>
                    <Link
                      href="/seller/submit-product"
                      className="text-sm text-purple-600 hover:text-purple-700 mt-2 inline-block"
                    >
                      Submit your first product →
                    </Link>
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Orders</h2>
                  <Link
                    href="/seller/orders"
                    className="text-sm text-purple-600 hover:text-purple-700"
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
                        className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              Order #{order.orderNumber || order.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              ${parseFloat(order.total || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(order.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              order.status === 'DELIVERED'
                                ? 'bg-green-100 text-green-800'
                                : order.status === 'CANCELLED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent orders</p>
                    <p className="text-sm mt-2">Orders will appear here when customers purchase your products</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Average Order Value</h3>
                  <p className="text-3xl font-bold text-purple-600">
                    ${dashboardData?.averageOrderValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </p>
                </div>
                <Link
                  href="/seller/submit-product"
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
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

