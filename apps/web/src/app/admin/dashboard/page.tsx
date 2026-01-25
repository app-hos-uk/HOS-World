'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalSubmissions: number;
  totalSellers: number;
  totalCustomers: number;
  totalRevenue?: number;
  todayRevenue?: number;
  weeklyRevenue?: number;
  monthlyRevenue?: number;
}

interface AdminDashboardData {
  statistics: DashboardStats;
  submissionsByStatus: Array<{ status: string; _count: number }>;
  ordersByStatus: Array<{ status: string; _count: number }>;
  recentActivity: any[];
  recentOrders?: any[];
  salesTrends?: Array<{ period: string; revenue: number; orders: number }>;
  topProducts?: Array<{ name: string; sales: number; revenue: number }>;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const quickActions = [
  { title: 'Create Product', href: '/admin/products/create', icon: '➕', color: 'bg-purple-100 text-purple-700' },
  { title: 'View Orders', href: '/admin/orders', icon: '🛒', color: 'bg-blue-100 text-blue-700' },
  { title: 'Pending Submissions', href: '/admin/submissions', icon: '📋', color: 'bg-yellow-100 text-yellow-700' },
  { title: 'Invite Seller', href: '/admin/sellers', icon: '👤', color: 'bg-green-100 text-green-700' },
  { title: 'View Reports', href: '/admin/reports/sales', icon: '📊', color: 'bg-indigo-100 text-indigo-700' },
  { title: 'Settings', href: '/admin/settings', icon: '⚙️', color: 'bg-gray-100 text-gray-700' },
];

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
    totalRevenue: 0,
    todayRevenue: 0,
    weeklyRevenue: 0,
    monthlyRevenue: 0,
  };

  const pendingApprovals = dashboardData?.submissionsByStatus?.find(
    (s) => s.status === 'SUBMITTED' || s.status === 'UNDER_REVIEW'
  )?._count || 0;

  // Mock data for charts when real data is not available
  const salesTrendData = dashboardData?.salesTrends || [
    { period: 'Jan', revenue: 4000, orders: 24 },
    { period: 'Feb', revenue: 3000, orders: 18 },
    { period: 'Mar', revenue: 5000, orders: 32 },
    { period: 'Apr', revenue: 4500, orders: 28 },
    { period: 'May', revenue: 6000, orders: 40 },
    { period: 'Jun', revenue: 5500, orders: 36 },
  ];

  const orderStatusData = dashboardData?.ordersByStatus?.map(item => ({
    name: item.status,
    value: item._count,
  })) || [
    { name: 'Pending', value: 12 },
    { name: 'Processing', value: 8 },
    { name: 'Shipped', value: 15 },
    { name: 'Delivered', value: 45 },
    { name: 'Cancelled', value: 3 },
  ];

  const topProductsData = dashboardData?.topProducts || [
    { name: 'Harry Potter Wand', sales: 120, revenue: 3600 },
    { name: 'Hogwarts Robe', sales: 85, revenue: 4250 },
    { name: 'Time Turner', sales: 65, revenue: 1950 },
    { name: 'Marauders Map', sales: 55, revenue: 1375 },
    { name: 'Golden Snitch', sales: 45, revenue: 900 },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Overview of platform operations and statistics</p>
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
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white border rounded-lg p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    className={`flex flex-col items-center justify-center p-4 rounded-lg ${action.color} hover:opacity-80 transition-opacity`}
                  >
                    <span className="text-2xl mb-2">{action.icon}</span>
                    <span className="text-sm font-medium text-center">{action.title}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
                  <span className="text-2xl">💰</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  £{(stats.totalRevenue || 0).toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">+12% from last month</p>
              </div>
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
                  <span className="text-2xl">📦</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalProducts.toLocaleString()}</p>
              </div>
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
                  <span className="text-2xl">🛒</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalOrders.toLocaleString()}</p>
              </div>
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">Total Sellers</h3>
                  <span className="text-2xl">👤</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalSellers.toLocaleString()}</p>
              </div>
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">Total Customers</h3>
                  <span className="text-2xl">👥</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalCustomers.toLocaleString()}</p>
              </div>
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-500">Pending Approvals</h3>
                  <span className="text-2xl">⏳</span>
                </div>
                <p className="text-2xl font-bold text-orange-600 mt-2">{pendingApprovals.toLocaleString()}</p>
                {pendingApprovals > 0 && (
                  <Link href="/admin/submissions" className="text-xs text-purple-600 hover:underline mt-1 block">
                    Review now
                  </Link>
                )}
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Trend Chart */}
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="period" stroke="#6b7280" fontSize={12} />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        formatter={(value: number) => [`£${value.toLocaleString()}`, 'Revenue']}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#8b5cf6" 
                        strokeWidth={2}
                        dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                        name="Revenue (£)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Order Status Pie Chart */}
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Orders by Status</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {orderStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Products and Recent Activity Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products Bar Chart */}
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProductsData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" stroke="#6b7280" fontSize={12} />
                      <YAxis dataKey="name" type="category" width={120} stroke="#6b7280" fontSize={11} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      />
                      <Bar dataKey="sales" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Sales" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                  <Link href="/admin/activity" className="text-sm text-purple-600 hover:underline">
                    View all
                  </Link>
                </div>
                {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.recentActivity.slice(0, 6).map((activity: any, index: number) => (
                      <div key={activity.id || index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <span className="text-sm">📝</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {activity.seller?.storeName || activity.user?.email || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">{activity.status || activity.action}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : 'Recently'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl mb-2 block">📭</span>
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Submissions by Status */}
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Submissions by Status</h2>
                  <Link href="/admin/submissions" className="text-sm text-purple-600 hover:underline">
                    View all
                  </Link>
                </div>
                {dashboardData?.submissionsByStatus && dashboardData.submissionsByStatus.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.submissionsByStatus.map((item: any) => (
                      <div key={item.status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${
                            item.status === 'APPROVED' ? 'bg-green-500' :
                            item.status === 'REJECTED' ? 'bg-red-500' :
                            item.status === 'SUBMITTED' ? 'bg-yellow-500' :
                            'bg-gray-400'
                          }`}></span>
                          <span className="text-sm font-medium text-gray-700">{item.status}</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{item._count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No submissions data</p>
                )}
              </div>

              {/* Orders by Status List */}
              <div className="bg-white border rounded-lg p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Orders Overview</h2>
                  <Link href="/admin/orders" className="text-sm text-purple-600 hover:underline">
                    View all
                  </Link>
                </div>
                {dashboardData?.ordersByStatus && dashboardData.ordersByStatus.length > 0 ? (
                  <div className="space-y-3">
                    {dashboardData.ordersByStatus.map((item: any, index: number) => (
                      <div key={item.status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                          <span className="text-sm font-medium text-gray-700">{item.status}</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">{item._count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No orders data</p>
                )}
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
