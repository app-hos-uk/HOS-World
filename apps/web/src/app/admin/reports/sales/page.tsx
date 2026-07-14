'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
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
import { format, subMonths } from 'date-fns';

export default function AdminSalesReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subMonths(new Date(), 6),
    endDate: new Date(),
  });
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [compareWithPrevious, setCompareWithPrevious] = useState(false);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, period, compareWithPrevious]);

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getSalesTrends({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        period,
        compareWithPrevious,
      });
      if (response?.data) {
        setData(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching sales trends:', err);
      setError(err.message || 'Failed to load sales trends');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      const blob = await apiClient.exportAnalytics('sales', format, {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-report-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    }
  };

  if (loading && !data) {
    return (
      <RouteGuard allowedRoles={['ADMIN', 'SELLER', 'B2C_SELLER']}>
                  <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading sales report...</div>
          </div>
              </RouteGuard>
    );
  }

  const chartData = data?.trends?.map((trend: any) => ({
    period: trend.period,
    revenue: Number(trend.revenue || 0),
    orders: trend.orders || 0,
    averageOrderValue: Number(trend.averageOrderValue || 0),
    growth: trend.growth ? Number(trend.growth.toFixed(2)) : null,
  })) || [];

  return (
    <RouteGuard allowedRoles={['ADMIN', 'SELLER', 'B2C_SELLER']}>
              <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-hos-text-secondary">Sales Reports</h1>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-md hover:bg-hos-bg-tertiary"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-md hover:bg-hos-bg-tertiary"
              >
                Export Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-md hover:bg-hos-bg-tertiary"
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              onCompareChange={setCompareWithPrevious}
              compareEnabled={compareWithPrevious}
            />
            <div className="mt-4 flex items-center gap-4">
              <label className="text-sm font-medium text-hos-text-secondary">Period:</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
                className="px-3 py-1.5 border border-hos-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Revenue</h3>
              <p className="text-3xl font-bold text-hos-text-secondary mt-2">
                ${Number(data?.totalRevenue || 0).toFixed(2)}
              </p>
              {data?.growthRate && (
                <p
                  className={`text-sm mt-1 ${data.growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {data.growthRate >= 0 ? '+' : ''}
                  {data.growthRate.toFixed(2)}% vs previous period
                </p>
              )}
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Orders</h3>
              <p className="text-3xl font-bold text-hos-text-secondary mt-2">{data?.totalOrders || 0}</p>
              {data?.periodComparison && (
                <p className="text-sm text-hos-text-muted mt-1">
                  Previous: {data.periodComparison.previous.orders}
                </p>
              )}
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Average Order Value</h3>
              <p className="text-3xl font-bold text-hos-text-secondary mt-2">
                $
                {data?.totalOrders > 0
                  ? (data.totalRevenue / data.totalOrders).toFixed(2)
                  : '0.00'}
              </p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Growth Rate</h3>
              <p
                className={`text-3xl font-bold mt-2 ${data?.growthRate >= 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {data?.growthRate ? `${data.growthRate >= 0 ? '+' : ''}${data.growthRate.toFixed(2)}%` : '0%'}
              </p>
            </div>
          </div>

          {data?.periodComparison && (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Period Comparison</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-hos-text-muted">Current Period</h3>
                  <p className="text-2xl font-bold text-hos-text-secondary mt-1">
                    ${Number(data.periodComparison.current.revenue).toFixed(2)}
                  </p>
                  <p className="text-sm text-hos-text-muted mt-1">
                    {data.periodComparison.current.orders} orders
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-hos-text-muted">Previous Period</h3>
                  <p className="text-2xl font-bold text-hos-text-secondary mt-1">
                    ${Number(data.periodComparison.previous.revenue).toFixed(2)}
                  </p>
                  <p className="text-sm text-hos-text-muted mt-1">
                    {data.periodComparison.previous.orders} orders
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-hos-text-muted">Growth</h3>
                  <p
                    className={`text-2xl font-bold mt-1 ${data.periodComparison.growth.revenue >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {data.periodComparison.growth.revenue >= 0 ? '+' : ''}
                    {data.periodComparison.growth.revenue.toFixed(2)}%
                  </p>
                  <p className="text-sm text-hos-text-muted mt-1">
                    Orders: {data.periodComparison.growth.orders >= 0 ? '+' : ''}
                    {data.periodComparison.growth.orders.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Revenue Trends</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis
                      yAxisId="revenue"
                      label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                    />
                    {compareWithPrevious && (
                      <YAxis
                        yAxisId="growth"
                        orientation="right"
                        label={{ value: 'Growth (%)', angle: 90, position: 'insideRight' }}
                        tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                      />
                    )}
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'Growth %') {
                          return `${Number(value).toFixed(2)}%`;
                        }
                        return `$${Number(value).toFixed(2)}`;
                      }}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Revenue"
                      yAxisId="revenue"
                    />
                    {compareWithPrevious && (
                      <Line
                        type="monotone"
                        dataKey="growth"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Growth %"
                        yAxisId="growth"
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Orders Volume</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip labelFormatter={(label) => `Period: ${label}`} />
                    <Legend />
                    <Bar dataKey="orders" fill="#3b82f6" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Average Order Value</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                      labelFormatter={(label) => `Period: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="averageOrderValue"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="Average Order Value"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
