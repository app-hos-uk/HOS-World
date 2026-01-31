'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import {
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
import { format, subMonths } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminCustomerAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subMonths(new Date(), 6),
    endDate: new Date(),
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCustomerMetrics({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });
      if (response?.data) {
        // Ensure data is an object, not an array
        const metricsData = typeof response.data === 'object' && !Array.isArray(response.data)
          ? response.data
          : {};
        setData(metricsData);
      } else {
        setData({});
      }
    } catch (err: any) {
      console.error('Error fetching customer metrics:', err);
      setError(err.message || 'Failed to load customer metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      const blob = await apiClient.exportAnalytics('customers', format, {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-report-${Date.now()}.${format}`;
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
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading customer analytics...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  const pieData = data
    ? [
        { name: 'New Customers', value: data.newCustomers || 0 },
        { name: 'Returning Customers', value: data.returningCustomers || 0 },
      ]
    : [];

  const metricsData = data
    ? [
        { name: 'Total Customers', value: data.totalCustomers || 0 },
        { name: 'New Customers', value: data.newCustomers || 0 },
        { name: 'Returning Customers', value: data.returningCustomers || 0 },
      ]
    : [];

  return (
    <RouteGuard allowedRoles={['ADMIN', 'SELLER', 'B2C_SELLER']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Customer Analytics</h1>
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Export Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Customers</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{data?.totalCustomers || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">New Customers</h3>
              <p className="text-3xl font-bold text-green-600 mt-2">{data?.newCustomers || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Returning Customers</h3>
              <p className="text-3xl font-bold text-blue-600 mt-2">{data?.returningCustomers || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500">Retention Rate</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {data?.retentionRate ? `${data.retentionRate.toFixed(1)}%` : '0%'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Average Lifetime Value</h3>
              <p className="text-4xl font-bold text-gray-900">
                £{data?.averageLTV ? data.averageLTV.toFixed(2) : '0.00'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Average total value of purchases per customer
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Average Order Frequency</h3>
              <p className="text-4xl font-bold text-gray-900">
                {data?.averageOrderFrequency ? data.averageOrderFrequency.toFixed(2) : '0.00'}
              </p>
              <p className="text-sm text-gray-500 mt-2">Orders per customer on average</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Churn Rate</h3>
              <p className="text-4xl font-bold text-red-600">
                {data?.churnRate ? `${data.churnRate.toFixed(1)}%` : '0%'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Customers with no orders in the last 30 days
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Retention Rate</h3>
              <p className="text-4xl font-bold text-green-600">
                {data?.retentionRate ? `${data.retentionRate.toFixed(1)}%` : '0%'}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Percentage of customers with 2+ orders
              </p>
            </div>
          </div>

          {pieData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Customer Distribution
                </h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer Metrics</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metricsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#3b82f6" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
