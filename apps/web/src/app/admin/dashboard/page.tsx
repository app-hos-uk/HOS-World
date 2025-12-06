'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteGuard } from '@/components/RouteGuard';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { apiClient } from '@/lib/api';

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalSubmissions: number;
  totalSellers: number;
  totalCustomers: number;
}

interface AdminDashboardData {
  statistics: DashboardStats;
  submissionsByStatus: Array<{ status: string; _count: number }>;
  ordersByStatus: Array<{ status: string; _count: number }>;
  recentActivity: any[];
}

export default function AdminDashboardPage() {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.getAdminDashboardData();
        if (response?.data) {
          setDashboardData(response.data);
        } else {
          setError('Failed to load dashboard data');
        }
      } catch (err: any) {
        console.error('Error fetching admin dashboard:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const stats = dashboardData?.statistics || {
    totalProducts: 0,
    totalOrders: 0,
    totalSubmissions: 0,
    totalSellers: 0,
    totalCustomers: 0,
  };

  const pendingApprovals = dashboardData?.submissionsByStatus?.find(
    (s) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW'
  )?._count || 0;

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Admin Dashboard</h1>
            <div className="flex gap-3 flex-wrap items-center">
              {/* Role Switcher - Only visible to ADMIN users */}
              <RoleSwitcher />
              <a
                href="/admin/users"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
              >
                Manage Users
              </a>
              <a
                href="/admin/settings"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
              >
                Settings
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-4 sm:p-6 mb-6 sm:mb-6 sm:mb-8">
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Products</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">{stats.totalProducts.toLocaleString()}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Orders</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">{stats.totalOrders.toLocaleString()}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Sellers</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">{stats.totalSellers.toLocaleString()}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Total Customers</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">{stats.totalCustomers.toLocaleString()}</p>
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h3 className="text-sm sm:text-base lg:text-sm sm:text-base lg:text-lg font-semibold mb-2">Pending Approvals</h3>
                  <p className="text-2xl sm:text-2xl sm:text-3xl font-bold">{pendingApprovals.toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4 sm:p-6">
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Recent Activity</h2>
                  {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 ? (
                    <div className="space-y-2">
                      {dashboardData.recentActivity.slice(0, 5).map((activity: any) => (
                        <div key={activity.id} className="text-sm text-gray-600 border-b pb-2">
                          <p className="font-medium">{activity.seller?.storeName || 'Unknown Seller'}</p>
                          <p className="text-xs text-gray-500">{activity.status}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base text-gray-500">No recent activity</p>
                  )}
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Submissions by Status</h2>
                  {dashboardData?.submissionsByStatus && dashboardData.submissionsByStatus.length > 0 ? (
                    <div className="space-y-2">
                      {dashboardData.submissionsByStatus.map((item: any) => (
                        <div key={item.status} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.status}:</span>
                          <span className="font-semibold">{item._count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base text-gray-500">No submissions data</p>
                  )}
                </div>
                <div className="bg-white border rounded-lg p-4 sm:p-4 sm:p-6 md:col-span-2 lg:col-span-1">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-3 sm:mb-4">Orders by Status</h2>
                  {dashboardData?.ordersByStatus && dashboardData.ordersByStatus.length > 0 ? (
                    <div className="space-y-2">
                      {dashboardData.ordersByStatus.map((item: any) => (
                        <div key={item.status} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.status}:</span>
                          <span className="font-semibold">{item._count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm sm:text-base text-gray-500">No orders data</p>
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
