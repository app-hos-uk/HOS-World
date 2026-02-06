'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard, ChartCard, ActivityItem, EmptyState } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/Badge';
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
  totalUsers?: number;
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

const COLORS = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const quickActions = [
  { title: 'Create Product', href: '/admin/products/create', icon: '➕', bgColor: 'bg-purple-50', iconColor: 'text-purple-600' },
  { title: 'View Orders', href: '/admin/orders', icon: '🛒', bgColor: 'bg-blue-50', iconColor: 'text-blue-600' },
  { title: 'Submissions', href: '/admin/submissions', icon: '📋', bgColor: 'bg-amber-50', iconColor: 'text-amber-600' },
  { title: 'Invite Seller', href: '/admin/sellers', icon: '👤', bgColor: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { title: 'View Reports', href: '/admin/reports/sales', icon: '📊', bgColor: 'bg-indigo-50', iconColor: 'text-indigo-600' },
  { title: 'Settings', href: '/admin/settings', icon: '⚙️', bgColor: 'bg-gray-50', iconColor: 'text-gray-600' },
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
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of platform operations and key metrics</p>
        </div>
          
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="spinner spinner-lg"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
            <p className="font-medium">Error loading dashboard</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <SectionCard title="Quick Actions">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.title}
                    href={action.href}
                    className={`quick-action ${action.bgColor}`}
                  >
                    <span className={`quick-action-icon ${action.iconColor}`}>{action.icon}</span>
                    <span className="quick-action-label">{action.title}</span>
                  </Link>
                ))}
              </div>
            </SectionCard>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatCard
                label="Total Revenue"
                value={`£${(stats.totalRevenue || 0).toLocaleString()}`}
                icon={<span className="text-lg">💰</span>}
                iconBgColor="bg-green-50"
                trend={{ value: 12, label: 'vs last month', isPositive: true }}
              />
              <StatCard
                label="Total Products"
                value={stats.totalProducts}
                icon={<span className="text-lg">📦</span>}
                iconBgColor="bg-purple-50"
              />
              <StatCard
                label="Total Orders"
                value={stats.totalOrders}
                icon={<span className="text-lg">🛒</span>}
                iconBgColor="bg-blue-50"
              />
              <StatCard
                label="Total Sellers"
                value={stats.totalSellers}
                icon={<span className="text-lg">🏪</span>}
                iconBgColor="bg-amber-50"
              />
              <StatCard
                label="Total Users"
                value={stats.totalUsers || (stats.totalCustomers + stats.totalSellers)}
                icon={<span className="text-lg">👥</span>}
                iconBgColor="bg-indigo-50"
              />
              <StatCard
                label="Pending Approvals"
                value={pendingApprovals}
                icon={<span className="text-lg">⏳</span>}
                iconBgColor="bg-orange-50"
                valueColor={pendingApprovals > 0 ? 'text-orange-600' : 'text-gray-900'}
                onClick={pendingApprovals > 0 ? () => window.location.href = '/admin/submissions' : undefined}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend Chart */}
              <ChartCard title="Revenue Trend" subtitle="Last 6 months performance">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis 
                      dataKey="period" 
                      stroke="#9ca3af" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#9ca3af" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `£${value / 1000}k`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                      formatter={(value: number) => [`£${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="#a855f7" 
                      strokeWidth={2.5}
                      dot={{ fill: '#a855f7', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#a855f7', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Order Status Pie Chart */}
              <ChartCard title="Orders by Status" subtitle="Current order distribution">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      fill="#8884d8"
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Top Products and Recent Activity Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products Bar Chart */}
              <ChartCard title="Top Selling Products" subtitle="By number of sales">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      stroke="#9ca3af" 
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={100} 
                      stroke="#9ca3af" 
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                      }}
                    />
                    <Bar 
                      dataKey="sales" 
                      fill="#a855f7" 
                      radius={[0, 6, 6, 0]} 
                      name="Sales"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Recent Activity */}
              <SectionCard 
                title="Recent Activity" 
                action={{ label: 'View all', href: '/admin/activity' }}
              >
                {dashboardData?.recentActivity && dashboardData.recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {dashboardData.recentActivity.slice(0, 5).map((activity: any, index: number) => (
                      <ActivityItem
                        key={activity.id || index}
                        icon={<span className="text-sm">📝</span>}
                        iconBg="bg-purple-100"
                        title={activity.seller?.storeName || activity.user?.email || 'System Activity'}
                        subtitle={activity.status || activity.action}
                        timestamp={activity.createdAt ? new Date(activity.createdAt).toLocaleString() : 'Recently'}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="📭"
                    title="No recent activity"
                    description="Activity will appear here as events occur"
                  />
                )}
              </SectionCard>
            </div>

            {/* Status Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Submissions by Status */}
              <SectionCard
                title="Submissions by Status"
                action={{ label: 'View all', href: '/admin/submissions' }}
              >
                {dashboardData?.submissionsByStatus && dashboardData.submissionsByStatus.length > 0 ? (
                  <div className="space-y-2">
                    {dashboardData.submissionsByStatus.map((item: any) => (
                      <div key={item.status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={item.status} />
                        </div>
                        <span className="text-lg font-semibold text-gray-900 tabular-nums">{item._count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="📋"
                    title="No submissions"
                    description="Product submissions will appear here"
                  />
                )}
              </SectionCard>

              {/* Orders by Status List */}
              <SectionCard
                title="Orders Overview"
                action={{ label: 'View all', href: '/admin/orders' }}
              >
                {dashboardData?.ordersByStatus && dashboardData.ordersByStatus.length > 0 ? (
                  <div className="space-y-2">
                    {dashboardData.ordersByStatus.map((item: any, index: number) => (
                      <div key={item.status} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3">
                          <span 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-gray-700">{item.status}</span>
                        </div>
                        <span className="text-lg font-semibold text-gray-900 tabular-nums">{item._count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="🛒"
                    title="No orders"
                    description="Order data will appear here"
                  />
                )}
              </SectionCard>
            </div>
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
