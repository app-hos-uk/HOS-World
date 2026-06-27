'use client';

import { useEffect, useState, useCallback } from 'react';
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

const DARK_CHART_TOOLTIP = {
  backgroundColor: '#14141a',
  border: '1px solid rgba(201, 162, 39, 0.22)',
  borderRadius: '12px',
  color: '#e8e4dc',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
};

const DARK_CHART_GRID = 'rgba(201, 162, 39, 0.12)';
const DARK_CHART_AXIS = '#9a958a';

const quickActions = [
  { title: 'Create Product', href: '/admin/products/create', icon: '➕', bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
  { title: 'View Orders', href: '/admin/orders', icon: '🛒', bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
  { title: 'Submissions', href: '/admin/submissions', icon: '📋', bgColor: 'bg-amber-500/10 hover:bg-amber-500/15', iconColor: 'text-amber-400' },
  { title: 'Invite Seller', href: '/admin/sellers', icon: '👤', bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/15', iconColor: 'text-emerald-400' },
  { title: 'View Reports', href: '/admin/reports/sales', icon: '📊', bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
  { title: 'Settings', href: '/admin/settings', icon: '⚙️', bgColor: 'bg-hos-bg-secondary hover:bg-hos-bg-tertiary', iconColor: 'text-hos-text-secondary' },
];

export default function AdminDashboardPage() {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getAdminDashboardData();
      if (response?.data) {
        setDashboardData(response.data);
      } else if (showLoading) {
        setError('Failed to load dashboard data');
      }
    } catch (err: any) {
      console.error('Error fetching admin dashboard:', err);
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

  const salesTrendData = dashboardData?.salesTrends ?? [];

  const orderStatusData = dashboardData?.ordersByStatus?.map(item => ({
    name: item.status,
    value: item._count,
  })) || [];

  const topProductsData = dashboardData?.topProducts || [];

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-hos-text-secondary">Dashboard</h1>
            <p className="text-sm text-hos-text-muted mt-1">Overview of platform operations and key metrics</p>
          </div>
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
          
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="spinner spinner-lg"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl mb-6">
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
                value={`$${(stats.totalRevenue || 0).toLocaleString()}`}
                icon={<span className="text-lg">💰</span>}
                iconBgColor="bg-green-500/10"
                trend={{ value: 0, label: 'from API', isPositive: true }}
              />
              <StatCard
                label="Total Products"
                value={stats.totalProducts}
                icon={<span className="text-lg">📦</span>}
                iconBgColor="bg-hos-gold/10"
              />
              <StatCard
                label="Total Orders"
                value={stats.totalOrders}
                icon={<span className="text-lg">🛒</span>}
                iconBgColor="bg-hos-gold/10"
              />
              <StatCard
                label="Total Sellers"
                value={stats.totalSellers}
                icon={<span className="text-lg">🏪</span>}
                iconBgColor="bg-amber-500/10"
              />
              <StatCard
                label="Total Users"
                value={stats.totalUsers || (stats.totalCustomers + stats.totalSellers)}
                icon={<span className="text-lg">👥</span>}
                iconBgColor="bg-hos-gold/10"
              />
              <StatCard
                label="Pending Approvals"
                value={pendingApprovals}
                icon={<span className="text-lg">⏳</span>}
                iconBgColor="bg-orange-500/10"
                valueColor={pendingApprovals > 0 ? 'text-orange-400' : 'text-hos-text-secondary'}
                onClick={pendingApprovals > 0 ? () => window.location.href = '/admin/submissions' : undefined}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Trend Chart */}
              <ChartCard title="Revenue Trend" subtitle="Rolling six months ending this calendar month">
                {salesTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={DARK_CHART_GRID} />
                      <XAxis 
                        dataKey="period" 
                        stroke={DARK_CHART_AXIS} 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke={DARK_CHART_AXIS} 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: number) =>
                          Math.abs(value) >= 1000
                            ? `$${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`
                            : `$${value}`
                        }
                      />
                      <Tooltip 
                        contentStyle={DARK_CHART_TOOLTIP}
                        formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
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
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-4 text-center text-hos-text-muted">
                    <p className="text-sm font-medium text-hos-text-secondary">No trend data loaded</p>
                    <p className="mt-1 text-xs text-hos-text-muted">Refresh after the dashboard reconnects.</p>
                  </div>
                )}
              </ChartCard>

              {/* Order Status Pie Chart */}
              <ChartCard title="Orders by Status" subtitle="Current order distribution">
                {orderStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={85}
                      fill="#8884d8"
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      labelLine={false}
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={DARK_CHART_TOOLTIP} />
                    <Legend
                      verticalAlign="bottom"
                      align="center"
                      layout="horizontal"
                      wrapperStyle={{ paddingTop: 8 }}
                      formatter={(value, entry) => {
                        const percent = (entry?.payload as { percent?: number })?.percent;
                        return (
                          <span className="text-xs text-hos-text-secondary">
                            {value}
                            {typeof percent === 'number' ? ` ${(percent * 100).toFixed(0)}%` : ''}
                          </span>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-4 text-center text-hos-text-muted">
                    <p className="text-sm font-medium text-hos-text-secondary">No order status data</p>
                    <p className="mt-1 text-xs">Data will appear once orders are placed.</p>
                  </div>
                )}
              </ChartCard>
            </div>

            {/* Top Products and Recent Activity Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products Bar Chart */}
              <ChartCard title="Top Selling Products" subtitle="By number of sales">
                {topProductsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProductsData}
                    layout="vertical"
                    margin={{ top: 10, right: 12, left: 8, bottom: 8 }}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK_CHART_GRID} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke={DARK_CHART_AXIS}
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: DARK_CHART_GRID }}
                      domain={[0, 'auto']}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={DARK_CHART_AXIS}
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: DARK_CHART_GRID }}
                      width={120}
                      tickFormatter={(name: string) =>
                        name.length > 14 ? `${name.slice(0, 12)}…` : name
                      }
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value}`, 'Sales']}
                      contentStyle={DARK_CHART_TOOLTIP}
                    />
                    <Bar
                      dataKey="sales"
                      fill="#a855f7"
                      radius={[0, 6, 6, 0]}
                      name="Sales"
                      maxBarSize={48}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-4 text-center text-hos-text-muted">
                    <p className="text-sm font-medium text-hos-text-secondary">No sales data yet</p>
                    <p className="mt-1 text-xs">Top products will appear after sales are recorded.</p>
                  </div>
                )}
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
                        iconBg="bg-hos-gold/20"
                        title={activity.seller?.storeName || activity.user?.email || 'System Activity'}
                        subtitle={
                          typeof activity.description === 'string' && activity.description.trim()
                            ? `${(activity.description as string).length > 100 ? `${(activity.description as string).slice(0, 100)}…` : activity.description}`
                            : `${activity.status || ''}${activity.status && activity.action ? ' · ' : ''}${activity.action || ''}`.trim() ||
                              '—'
                        }
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
                      <div key={item.status} className="flex items-center justify-between p-3 bg-hos-bg-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                        <div className="flex items-center gap-3">
                          <StatusBadge status={item.status} />
                        </div>
                        <span className="text-lg font-semibold text-hos-text-secondary tabular-nums">{item._count}</span>
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
                      <div key={item.status} className="flex items-center justify-between p-3 bg-hos-bg-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                        <div className="flex items-center gap-3">
                          <span 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-hos-text-secondary">{item.status}</span>
                        </div>
                        <span className="text-lg font-semibold text-hos-text-secondary tabular-nums">{item._count}</span>
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
