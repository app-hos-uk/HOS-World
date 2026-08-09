'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard, ChartCard, ActivityItem, EmptyState } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/Badge';
import { formatActivityDescription, formatActivityTitle } from '@/lib/adminFormat';
import { navIcon } from '@/lib/navIcons';
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
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { useMoney } from '@/hooks/useMoney';
import { useDateTime } from '@/hooks/useDateTime';

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

const COLORS = ['#c9a227', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8B5CF6', '#94a3b8', '#ec4899'];

/** Distinct colors per order status for the donut chart */
const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#06b6d4',
  PACKED: '#8b5cf6',
  SHIPPED: '#6366f1',
  OUT_FOR_DELIVERY: '#a78bfa',
  DELIVERED: '#10b981',
  COMPLETED: '#059669',
  CANCELLED: '#ef4444',
  REFUNDED: '#f97316',
  RETURNED: '#ec4899',
  ON_HOLD: '#94a3b8',
  FAILED: '#dc2626',
};

const DARK_CHART_TOOLTIP = {
  backgroundColor: '#14141a',
  border: '1px solid rgba(201, 162, 39, 0.22)',
  borderRadius: '12px',
  color: '#e8e4dc',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
};

const DARK_CHART_TOOLTIP_ITEM = { color: '#e8e4dc' };
const DARK_CHART_TOOLTIP_LABEL = { color: '#c9a227' };

const DARK_CHART_GRID = 'rgba(201, 162, 39, 0.12)';
const DARK_CHART_AXIS = '#9a958a';

const quickActions = [
  { title: 'Create Product', subtitle: 'Add catalog item', href: '/admin/products/create', icon: navIcon('plus'), bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
  { title: 'View Orders', subtitle: 'Fulfillment queue', href: '/admin/orders', icon: navIcon('cart'), bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
  { title: 'Submissions', subtitle: 'Review pipeline', href: '/admin/submissions', icon: navIcon('clipboard'), bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
  { title: 'Invite Seller', subtitle: 'Onboard vendor', href: '/admin/sellers', icon: navIcon('user'), bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
  { title: 'View Reports', subtitle: 'Sales analytics', href: '/admin/reports/sales', icon: navIcon('dashboard'), bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
  { title: 'Settings', subtitle: 'Platform config', href: '/admin/settings', icon: navIcon('settings'), bgColor: 'bg-hos-gold/10 hover:bg-hos-gold/15', iconColor: 'text-hos-gold' },
];

export default function AdminDashboardPage() {
  const { formatDateTime } = useDateTime();
  const { formatMoney, formatMoneyCompact } = useMoney();
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

  const orderStatusData = dashboardData?.ordersByStatus?.map((item, index) => ({
    name: item.status,
    value: item._count,
    fill: ORDER_STATUS_COLORS[item.status] || COLORS[index % COLORS.length],
  })) || [];
  const orderStatusTotal = orderStatusData.reduce((sum, d) => sum + d.value, 0);

  const topProductsData = dashboardData?.topProducts || [];

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
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
                    <span className="text-[11px] text-hos-text-muted mt-1">{action.subtitle}</span>
                  </Link>
                ))}
              </div>
            </SectionCard>

            {/* Main Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              <StatCard
                label="Total Revenue"
                value={formatMoney((stats.totalRevenue || 0))}
                icon={navIcon('dollar', 'w-5 h-5')}
                iconBgColor="bg-green-500/10"
                trend={{
                  value: 0,
                  label: `${formatMoney((stats.monthlyRevenue || 0))} this month`,
                }}
              />
              <StatCard
                label="Total Products"
                value={stats.totalProducts}
                icon={navIcon('package', 'w-5 h-5')}
                iconBgColor="bg-hos-gold/10"
                trend={{ value: 0, label: 'Active catalog' }}
              />
              <StatCard
                label="Total Orders"
                value={stats.totalOrders}
                icon={navIcon('cart', 'w-5 h-5')}
                iconBgColor="bg-hos-gold/10"
                trend={{ value: 0, label: 'All time' }}
              />
              <StatCard
                label="Total Sellers"
                value={stats.totalSellers}
                icon={navIcon('store', 'w-5 h-5')}
                iconBgColor="bg-amber-500/10"
                trend={{ value: 0, label: 'Marketplace vendors' }}
              />
              <StatCard
                label="Total Users"
                value={stats.totalUsers || (stats.totalCustomers + stats.totalSellers)}
                icon={navIcon('users', 'w-5 h-5')}
                iconBgColor="bg-hos-gold/10"
                trend={{ value: 0, label: `${stats.totalCustomers} customers` }}
              />
              <StatCard
                label="Pending Approvals"
                value={pendingApprovals}
                icon={navIcon('hourglass', 'w-5 h-5')}
                iconBgColor="bg-orange-500/10"
                valueColor={pendingApprovals > 0 ? 'text-orange-400' : 'text-hos-text-secondary'}
                trend={{ value: 0, label: 'Awaiting review' }}
                className={pendingApprovals > 0 ? 'admin-stat-card-urgent ring-2 ring-amber-500/60' : ''}
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
                        domain={[
                          (dataMin: number) => Math.max(0, Math.floor(dataMin * 0.85)),
                          'auto',
                        ]}
                        tickFormatter={(value: number) => formatMoneyCompact(value)}
                      />
                      <Tooltip 
                        contentStyle={DARK_CHART_TOOLTIP}
                        itemStyle={DARK_CHART_TOOLTIP_ITEM}
                        labelStyle={DARK_CHART_TOOLTIP_LABEL}
                        formatter={(value: number) => [formatMoney(value), 'Revenue']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#c9a227" 
                        strokeWidth={2.5}
                        dot={{ fill: '#c9a227', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#c9a227', strokeWidth: 2 }}
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

              {/* Order Status Pie Chart — donut + side legend (avoids header clip & tooltip overlap) */}
              <ChartCard title="Orders by Status" subtitle="Current order distribution" height="h-[22rem]">
                {orderStatusData.length > 0 ? (
                <div className="flex h-full w-full items-center gap-3 pt-1">
                  <div className="relative h-full min-w-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <Pie
                          data={orderStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius="58%"
                          outerRadius="82%"
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {orderStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        {/* Center total is an HTML overlay — SVG <Label> baselines often collide in Recharts */}
                        <Tooltip
                          allowEscapeViewBox={{ x: true, y: true }}
                          offset={16}
                          wrapperStyle={{ zIndex: 40, outline: 'none', pointerEvents: 'none' }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const d = payload[0].payload as { name: string; value: number; fill: string };
                            const pct = orderStatusTotal ? ((d.value / orderStatusTotal) * 100).toFixed(0) : '0';
                            return (
                              <div
                                style={{
                                  ...DARK_CHART_TOOLTIP,
                                  padding: '10px 14px',
                                  fontSize: 12,
                                  minWidth: 140,
                                  borderLeft: `3px solid ${d.fill || '#c9a227'}`,
                                }}
                              >
                                <p style={{ color: '#e8e4dc', fontWeight: 600, marginBottom: 4 }}>{d.name}</p>
                                <p style={{ color: '#c9a227' }}>
                                  {d.value} order{d.value !== 1 ? 's' : ''} · {pct}%
                                </p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[1.75rem] font-bold leading-none tabular-nums text-hos-text-secondary">
                        {orderStatusTotal}
                      </span>
                      <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-hos-text-muted">
                        Total
                      </span>
                    </div>
                  </div>
                  <ul className="flex h-full w-[9.5rem] shrink-0 flex-col justify-center gap-2.5 overflow-y-auto py-1 pl-1">
                    {orderStatusData.map((item) => {
                      const pct = orderStatusTotal ? ((item.value / orderStatusTotal) * 100).toFixed(0) : '0';
                      return (
                        <li key={item.name} className="flex items-start gap-2 text-xs leading-snug">
                          <span
                            className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: item.fill }}
                            aria-hidden
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-hos-text-secondary">{item.name}</span>
                            <span className="text-hos-text-muted tabular-nums">
                              {item.value} ({pct}%)
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
              <ChartCard title="Top Selling Products" subtitle="By number of sales" height="min-h-[10rem]">
                {topProductsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(160, topProductsData.length * 44 + 40)}>
                  <BarChart
                    data={topProductsData}
                    layout="vertical"
                    margin={{ top: 4, right: 40, left: 8, bottom: 20 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK_CHART_GRID} horizontal={false} />
                    <XAxis
                      type="number"
                      stroke={DARK_CHART_AXIS}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: DARK_CHART_GRID }}
                      domain={[0, 'auto']}
                      allowDecimals={false}
                      label={{ value: 'Units Sold', position: 'insideBottom', offset: -12, fill: DARK_CHART_AXIS, fontSize: 11 }}
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
                      contentStyle={{ ...DARK_CHART_TOOLTIP, padding: '6px 10px', fontSize: 12 }}
                      itemStyle={DARK_CHART_TOOLTIP_ITEM}
                      labelStyle={{ ...DARK_CHART_TOOLTIP_LABEL, fontSize: 11 }}
                      cursor={{ fill: 'rgba(201, 162, 39, 0.06)' }}
                    />
                    <Bar
                      dataKey="sales"
                      fill="#c9a227"
                      radius={[0, 6, 6, 0]}
                      name="Sales"
                      maxBarSize={36}
                      isAnimationActive={false}
                    >
                      <LabelList dataKey="sales" position="right" fill={DARK_CHART_AXIS} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                    <span className="text-4xl mb-3" aria-hidden>{navIcon('dashboard', 'w-10 h-10')}</span>
                    <p className="text-sm font-medium text-hos-text-secondary">No sales data yet</p>
                    <p className="mt-1 text-xs text-hos-text-muted">Top products will appear after sales are recorded.</p>
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
                        icon={navIcon('fileText', 'w-4 h-4')}
                        iconBg="bg-hos-gold/20"
                        title={formatActivityTitle(activity)}
                        subtitle={formatActivityDescription(activity)}
                        timestamp={activity.createdAt ? formatDateTime(activity.createdAt) : 'Recently'}
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
                    icon={navIcon('clipboard', 'w-12 h-12')}
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
                            style={{ backgroundColor: ORDER_STATUS_COLORS[item.status] || COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm font-medium text-hos-text-secondary">{item.status}</span>
                        </div>
                        <span className="text-lg font-semibold text-hos-text-secondary tabular-nums">{item._count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={navIcon('cart', 'w-12 h-12')}
                    title="No orders"
                    description="Order data will appear here"
                  />
                )}
              </SectionCard>
            </div>
          </div>
        )}
          </RouteGuard>
  );
}
