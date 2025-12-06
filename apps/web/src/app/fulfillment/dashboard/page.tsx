'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function FulfillmentDashboardPage() {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems = [
    { title: 'Dashboard', href: '/fulfillment/dashboard', icon: '📊' },
    { title: 'Manage Shipments', href: '/fulfillment/shipments', icon: '🚚', badge: 0 },
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getFulfillmentDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
          const pendingCount = response.data.incomingShipments || 0;
          menuItems[1].badge = pendingCount;
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching fulfillment dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const incomingShipments = dashboardData?.incomingShipments || 0;
  const pendingVerification = dashboardData?.pendingVerification || 0;
  const verifiedToday = dashboardData?.verifiedToday || 0;
  const rejectedCount = dashboardData?.rejectedCount || 0;

  return (
    <RouteGuard allowedRoles={['FULFILLMENT', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="FULFILLMENT" menuItems={menuItems} title="Fulfillment">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Fulfillment Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage incoming shipments and fulfillment operations</p>
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
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Incoming Shipments</h3>
                    <p className="text-3xl font-bold text-blue-600">{incomingShipments.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">📦</div>
                </div>
                <Link
                  href="/fulfillment/shipments?status=PENDING"
                  className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Pending Verification</h3>
                    <p className="text-3xl font-bold text-yellow-600">{pendingVerification.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">⏳</div>
                </div>
                <Link
                  href="/fulfillment/shipments?status=PENDING"
                  className="text-sm text-yellow-600 hover:text-yellow-700 mt-2 inline-block"
                >
                  Verify now →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Verified Today</h3>
                    <p className="text-3xl font-bold text-green-600">{verifiedToday.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">✅</div>
                </div>
                <Link
                  href="/fulfillment/shipments?status=VERIFIED"
                  className="text-sm text-green-600 hover:text-green-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-600 mb-1">Rejected</h3>
                    <p className="text-3xl font-bold text-red-600">{rejectedCount.toLocaleString()}</p>
                  </div>
                  <div className="text-4xl">❌</div>
                </div>
                <Link
                  href="/fulfillment/shipments?status=REJECTED"
                  className="text-sm text-red-600 hover:text-red-700 mt-2 inline-block"
                >
                  View all →
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Recent Shipments</h2>
                  <Link
                    href="/fulfillment/shipments"
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    View all →
                  </Link>
                </div>
                {dashboardData?.recentShipments && dashboardData.recentShipments.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {dashboardData.recentShipments.slice(0, 10).map((shipment: any) => (
                      <Link
                        key={shipment.id}
                        href={`/fulfillment/shipments?id=${shipment.id}`}
                        className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {shipment.submission?.productData?.name || 'Unknown Product'}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              {shipment.fulfillmentCenter?.name || 'Unknown Center'}
                            </p>
                            {shipment.trackingNumber && (
                              <p className="text-xs text-gray-400 mt-1">
                                Tracking: {shipment.trackingNumber}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded ${
                              shipment.status === 'VERIFIED'
                                ? 'bg-green-100 text-green-800'
                                : shipment.status === 'REJECTED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {shipment.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No recent shipments</p>
                    <p className="text-sm mt-2">Incoming shipments will appear here</p>
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-6 shadow-sm">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <Link
                    href="/fulfillment/shipments?status=PENDING"
                    className="block p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">🔍</div>
                    <p className="font-medium">Verify Pending Shipments</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {pendingVerification} shipments need verification
                    </p>
                  </Link>
                  <Link
                    href="/fulfillment/shipments"
                    className="block p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📋</div>
                    <p className="font-medium">View All Shipments</p>
                    <p className="text-sm text-gray-500 mt-1">Manage all shipment records</p>
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

