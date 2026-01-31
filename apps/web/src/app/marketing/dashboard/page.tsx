'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function MarketingDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems = [
    { title: 'Dashboard', href: '/marketing/dashboard', icon: '📊' },
    { title: 'Marketing Materials', href: '/marketing/materials', icon: '📢', badge: 0 },
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getMarketingDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
          const pendingCount = response.data.pendingProducts || 0;
          menuItems[1].badge = pendingCount;
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching marketing dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pendingProducts = dashboardData?.pendingProducts || 0;
  const materialsCreated = dashboardData?.materialsCreated || 0;
  const activeCampaigns = dashboardData?.activeCampaigns || 0;
  const totalMaterials = dashboardData?.totalMaterials || 0;

  return (
    <RouteGuard allowedRoles={['MARKETING', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="MARKETING" menuItems={menuItems} title="Marketing">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Marketing Dashboard</h1>
          <p className="text-gray-600 mt-2">Create and manage marketing materials</p>
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
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Products</h3>
                    <p className="text-3xl font-bold text-purple-600">{pendingProducts.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">📦</div>
                </div>
                <Link
                  href="/marketing/materials"
                  className="text-sm text-purple-600 hover:text-purple-700 mt-2 inline-block"
                >
                  Create materials →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Materials Created</h3>
                    <p className="text-3xl font-bold text-green-600">{materialsCreated.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">✅</div>
                </div>
                <Link
                  href="/marketing/materials?tab=library"
                  className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block"
                >
                  View library →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Active Campaigns</h3>
                    <p className="text-3xl font-bold text-blue-600">{activeCampaigns.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">📢</div>
                </div>
                <Link
                  href="/marketing/materials?tab=library"
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                >
                  View campaigns →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Total Materials</h3>
                    <p className="text-3xl font-bold text-indigo-600">{totalMaterials.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">📚</div>
                </div>
                <Link
                  href="/marketing/materials?tab=library"
                  className="text-sm text-indigo-600 hover:text-indigo-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Pending Materials</h2>
                  <Link
                    href="/marketing/materials"
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
                        href={`/marketing/materials?submission=${submission.id}`}
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
                              Ready for marketing materials
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
                    <p>No pending products</p>
                    <p className="text-sm mt-2">Products ready for marketing will appear here</p>
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Materials Library</h2>
                {dashboardData?.materials && dashboardData.materials.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {dashboardData.materials.slice(0, 8).map((material: any) => (
                      <Link
                        key={material.id}
                        href={`/marketing/materials?tab=library&material=${material.id}`}
                        className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="relative aspect-video bg-gray-100">
                          {material.url ? (
                            <Image
                              src={material.url}
                              alt={material.type}
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, 33vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              {material.type}
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {material.submission?.productData?.name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">{material.type}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No materials created yet</p>
                    <p className="text-sm mt-2">Create your first marketing material</p>
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


