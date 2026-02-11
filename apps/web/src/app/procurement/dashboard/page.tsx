'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';

export default function ProcurementDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems = [
    { title: 'Dashboard', href: '/procurement/dashboard', icon: '📊' },
    { title: 'Review Submissions', href: '/procurement/submissions', icon: '📦', badge: 0 },
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getProcurementDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
          // Update badge count
          const pendingCount = response.data.totalPending || 0;
          menuItems[1].badge = pendingCount;
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching procurement dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingCount = dashboardData?.totalPending || 0;
  const duplicatesCount = dashboardData?.totalDuplicates || 0;
  const underReview = dashboardData?.statistics?.find((s: any) => s.status === 'UNDER_REVIEW')?._count || 0;
  const approvedCount = dashboardData?.statistics?.find((s: any) => s.status === 'PROCUREMENT_APPROVED')?._count || 0;

  return (
    <RouteGuard allowedRoles={['PROCUREMENT', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="PROCUREMENT" menuItems={menuItems} title="Procurement">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Procurement Dashboard</h1>
          <p className="text-gray-600 mt-2">Review and approve product submissions</p>
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
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Submissions</h3>
                    <p className="text-3xl font-bold text-purple-600">{pendingCount.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">📦</div>
                </div>
                <Link
                  href="/procurement/submissions?status=SUBMITTED"
                  className="text-sm text-purple-600 hover:text-purple-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Duplicate Alerts</h3>
                    <p className="text-3xl font-bold text-orange-600">{duplicatesCount.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">⚠️</div>
                </div>
                <Link
                  href="/procurement/submissions?view=cross-seller"
                  className="text-sm text-orange-600 hover:text-orange-700 mt-2 inline-block"
                >
                  Review duplicates →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Under Review</h3>
                    <p className="text-3xl font-bold text-yellow-600">{underReview.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">🔍</div>
                </div>
                <Link
                  href="/procurement/submissions?status=UNDER_REVIEW"
                  className="text-sm text-yellow-600 hover:text-yellow-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Approved Today</h3>
                    <p className="text-3xl font-bold text-green-600">{approvedCount.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">✅</div>
                </div>
                <Link
                  href="/procurement/submissions?status=PROCUREMENT_APPROVED"
                  className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">New Submissions</h2>
                  <Link
                    href="/procurement/submissions?status=SUBMITTED"
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
                        href={`/procurement/submissions?id=${submission.id}`}
                        className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {submission.productData?.name || 'Untitled Product'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {submission.seller?.storeName || 'Unknown Seller'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(submission.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            {submission.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No pending submissions</p>
                    <p className="text-sm mt-2">New product submissions will appear here</p>
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Duplicate Detection</h2>
                  <Link
                    href="/procurement/submissions?duplicates=true"
                    className="text-sm text-orange-600 hover:text-orange-700"
                  >
                    View all →
                  </Link>
                </div>
                {dashboardData?.duplicateAlerts && dashboardData.duplicateAlerts.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData.duplicateAlerts.slice(0, 10).map((alert: any) => (
                      <div
                        key={alert.id}
                        className="p-3 border border-orange-200 bg-orange-50 rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-orange-900">
                              Similarity: {alert.similarityScore}%
                            </p>
                            <p className="text-sm text-orange-700 mt-1">
                              {alert.submission?.productData?.name || 'Unknown Product'}
                            </p>
                            <p className="text-xs text-orange-600 mt-1">
                              {alert.submission?.seller?.storeName || 'Unknown Seller'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No duplicate alerts</p>
                    <p className="text-sm mt-2">All submissions are unique</p>
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


