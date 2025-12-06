'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function WholesalerDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems = [
    { title: 'Dashboard', href: '/wholesaler/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/wholesaler/products', icon: '📦' },
    { title: 'Bulk Orders', href: '/wholesaler/orders', icon: '🛒' },
    { title: 'Submissions', href: '/wholesaler/submissions', icon: '📝' },
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getWholesalerDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching wholesaler dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const pendingApprovals = dashboardData?.submissionsByStatus?.find(
    (s: any) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW'
  )?._count || 0;

  return (
    <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Wholesaler Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage bulk products and wholesale operations</p>
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
                  href="/wholesaler/orders"
                  className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block"
                >
                  View orders →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Bulk Orders</h3>
                    <p className="text-3xl font-bold text-blue-600">
                      {dashboardData?.totalOrders?.toLocaleString() || '0'}
                    </p>
                  </div>
                  <div className="text-4xl">📦</div>
                </div>
                <Link
                  href="/wholesaler/orders"
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
                  <div className="text-4xl">🛍️</div>
                </div>
                <Link
                  href="/wholesaler/products"
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
                  href="/wholesaler/submissions"
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
                    href="/wholesaler/submissions"
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
                        href={`/wholesaler/submissions?id=${submission.id}`}
                        className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {submission.productData?.name || 'Untitled Product'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              Quantity: {submission.productData?.quantity || 'N/A'} | Status: {submission.status}
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
                  <h2 className="text-xl font-semibold">Bulk Order Statistics</h2>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Average Order Quantity</span>
                    <span className="text-lg font-bold text-purple-600">
                      {dashboardData?.averageOrderQuantity?.toLocaleString() || '0'} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Total Units Sold</span>
                    <span className="text-lg font-bold text-green-600">
                      {dashboardData?.totalUnitsSold?.toLocaleString() || '0'} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Average Order Value</span>
                    <span className="text-lg font-bold text-blue-600">
                      ${dashboardData?.averageOrderValue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Wholesale Operations</h3>
                  <p className="text-gray-600">
                    Manage bulk product submissions and wholesale orders
                  </p>
                </div>
                <Link
                  href="/seller/submit-product"
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Submit Bulk Product
                </Link>
              </div>
            </div>
          </>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}

