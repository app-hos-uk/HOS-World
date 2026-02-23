'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, subMonths, subWeeks, subDays, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';

type Period = 'daily' | 'weekly' | 'monthly';

interface PlatformMetrics {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  activeSellers: number;
  users: any[];
  orders: any[];
}

function groupByPeriod(items: any[], dateField: string, period: Period, startDate: Date, endDate: Date) {
  const formatStr = period === 'daily' ? 'yyyy-MM-dd' : period === 'weekly' ? "yyyy-'W'ww" : 'yyyy-MM';
  const buckets: Record<string, any[]> = {};

  let intervals: Date[];
  if (period === 'daily') {
    intervals = eachDayOfInterval({ start: startDate, end: endDate });
  } else if (period === 'weekly') {
    intervals = eachWeekOfInterval({ start: startDate, end: endDate });
  } else {
    intervals = eachMonthOfInterval({ start: startDate, end: endDate });
  }

  intervals.forEach((d) => {
    buckets[format(d, formatStr)] = [];
  });

  items.forEach((item) => {
    const d = new Date(item[dateField]);
    if (d >= startDate && d <= endDate) {
      const key = format(d, formatStr);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(item);
    }
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, entries]) => ({ label, entries, count: entries.length }));
}

export default function AdminPlatformMetricsPage() {
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('monthly');
  const [startDate, setStartDate] = useState(() => format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, productsRes, ordersRes] = await Promise.all([
        apiClient.getUsers().catch(() => ({ data: { data: [] } })),
        apiClient.getProducts({ limit: 1000 }).catch(() => ({ data: { data: [] } })),
        apiClient.getOrders().catch(() => ({ data: { data: [] } })),
      ]);

      const extract = (res: any) => {
        const raw = res?.data;
        const arr = Array.isArray(raw) ? raw : raw?.data;
        return Array.isArray(arr) ? arr : [];
      };

      const users = extract(usersRes);
      const products = extract(productsRes);
      const orders = extract(ordersRes);

      setMetrics({
        totalUsers: users.length,
        totalProducts: products.length,
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0),
        activeSellers: users.filter((u: any) => ['SELLER', 'B2C_SELLER', 'WHOLESALER'].includes(u.role)).length,
        users,
        orders,
      });
    } catch (err: any) {
      console.error('Error fetching platform metrics:', err);
      setError(err.message || 'Failed to load platform metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const handleExportCSV = () => {
    if (!metrics) return;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const userGroups = groupByPeriod(metrics.users, 'createdAt', period, start, end);
    const orderGroups = groupByPeriod(metrics.orders, 'createdAt', period, start, end);

    const rows = [['Period', 'User Signups', 'Orders', 'Revenue']];
    const maxLen = Math.max(userGroups.length, orderGroups.length);
    for (let i = 0; i < maxLen; i++) {
      const label = userGroups[i]?.label || orderGroups[i]?.label || '';
      const signups = userGroups[i]?.count || 0;
      const orderCount = orderGroups[i]?.count || 0;
      const revenue = orderGroups[i]?.entries.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0;
      rows.push([label, String(signups), String(orderCount), revenue.toFixed(2)]);
    }

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-metrics-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const start = new Date(startDate);
  const end = new Date(endDate);

  const userGrowthData = metrics ? groupByPeriod(metrics.users, 'createdAt', period, start, end) : [];
  const orderVolumeData = metrics ? groupByPeriod(metrics.orders, 'createdAt', period, start, end) : [];
  const revenueData = metrics
    ? orderVolumeData.map((g) => ({
        ...g,
        revenue: g.entries.reduce((s: number, o: any) => s + (o.total || 0), 0),
      }))
    : [];

  const chartData = userGrowthData.map((ug, i) => ({
    period: ug.label,
    signups: ug.count,
    orders: orderVolumeData[i]?.count || 0,
    revenue: revenueData[i]?.revenue || 0,
  }));

  if (loading && !metrics) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Platform Metrics</h1>
            <button
              onClick={handleExportCSV}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Export CSV
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchMetrics} className="mt-2 text-sm text-red-600 underline hover:text-red-800">
                Retry
              </button>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.totalUsers || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Products</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.totalProducts || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Orders</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.totalOrders || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">
                £{Number(metrics?.totalRevenue || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Active Sellers</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{metrics?.activeSellers || 0}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as Period)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <button
                onClick={() => {
                  setStartDate(format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
                  setEndDate(format(new Date(), 'yyyy-MM-dd'));
                  setPeriod('monthly');
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Combined Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Growth Overview</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `£${v}`} />
                  <Tooltip
                    formatter={(value: any, name: string) =>
                      name === 'Revenue' ? `£${Number(value).toFixed(2)}` : value
                    }
                  />
                  <Legend />
                  <Bar dataKey="signups" fill="#8b5cf6" name="User Signups" yAxisId="left" />
                  <Bar dataKey="orders" fill="#3b82f6" name="Orders" yAxisId="left" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Revenue Trend Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(v) => `£${Number(v).toFixed(0)}`} />
                  <Tooltip formatter={(value: any) => `£${Number(value).toFixed(2)}`} labelFormatter={(l) => `Period: ${l}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* User Growth Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Signups</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userGrowthData.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No data for selected range</td>
                    </tr>
                  ) : (
                    userGrowthData.map((row, i) => {
                      const cumulative = userGrowthData.slice(0, i + 1).reduce((s, r) => s + r.count, 0);
                      return (
                        <tr key={row.label} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.label}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{row.count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{cumulative}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Order Volume Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Volume</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orderVolumeData.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">No data for selected range</td>
                    </tr>
                  ) : (
                    orderVolumeData.map((row, i) => {
                      const cumulative = orderVolumeData.slice(0, i + 1).reduce((s, r) => s + r.count, 0);
                      return (
                        <tr key={row.label} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.label}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{row.count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{cumulative}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue Table */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Order Value</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {revenueData.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">No data for selected range</td>
                    </tr>
                  ) : (
                    revenueData.map((row) => {
                      const avg = row.count > 0 ? row.revenue / row.count : 0;
                      return (
                        <tr key={row.label} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.label}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">{row.count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium text-right">£{row.revenue.toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">£{avg.toFixed(2)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
