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
import { subMonths } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminProductAnalyticsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subMonths(new Date(), 6),
    endDate: new Date(),
  });
  const [limit, setLimit] = useState(20);

  // Ensure limit doesn't exceed 100
  useEffect(() => {
    if (limit > 100) {
      setLimit(100);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, limit]);

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getProductPerformance({
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        limit: Math.min(limit, 100), // Ensure limit doesn't exceed 100
      });
      if (response?.data) {
        // Ensure data is an array
        const productsData = Array.isArray(response.data) ? response.data : [];
        setData(productsData);
      } else {
        setData([]);
      }
    } catch (err: any) {
      console.error('Error fetching product performance:', err);
      setError(err.message || 'Failed to load product performance');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      const blob = await apiClient.exportAnalytics('products', format, {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-report-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Export failed: ' + err.message);
    }
  };

  if (loading && data.length === 0) {
    return (
      <RouteGuard allowedRoles={['ADMIN', 'SELLER', 'B2C_SELLER']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading product analytics...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  const topProducts = data.slice(0, 10);
  const chartData = topProducts.map((product: any) => ({
    name: product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name,
    revenue: Number(product.revenue || 0),
    orders: product.orders || 0,
    quantity: product.quantity || 0,
  }));

  const totalRevenue = data.reduce((sum, p: any) => sum + Number(p.revenue || 0), 0);
  const totalOrders = data.reduce((sum, p: any) => sum + (p.orders || 0), 0);
  const totalQuantity = data.reduce((sum, p: any) => sum + (p.quantity || 0), 0);

  return (
    <RouteGuard allowedRoles={['ADMIN', 'SELLER', 'B2C_SELLER']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Product Performance</h1>
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
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            <div className="mt-4 flex items-center gap-4">
              <label className="text-sm font-medium text-hos-text-secondary">Top Products:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-3 py-1.5 border border-hos-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
              >
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
                <option value={50}>Top 50</option>
                <option value={100}>Top 100</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Products</h3>
              <p className="text-3xl font-bold text-white mt-2">{data.length}</p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Revenue</h3>
              <p className="text-3xl font-bold text-white mt-2">
                ${totalRevenue.toFixed(2)}
              </p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Orders</h3>
              <p className="text-3xl font-bold text-white mt-2">{totalOrders}</p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Quantity</h3>
              <p className="text-3xl font-bold text-white mt-2">{totalQuantity}</p>
            </div>
          </div>

          {chartData.length > 0 && (
            <>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Top Products by Revenue</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Top Products by Orders</h2>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="orders" fill="#10b981" name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Product Performance Table</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Orders
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Avg Price
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                  {data.slice(0, limit).map((product: any) => (
                    <tr key={product.productId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {product.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {product.sku || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        ${Number(product.revenue || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {product.orders || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {product.quantity || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        ${Number(product.averagePrice || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
