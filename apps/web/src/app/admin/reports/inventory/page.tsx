'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { DateRangePicker, DateRange } from '@/components/DateRangePicker';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { subMonths } from 'date-fns';

export default function AdminInventoryAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: subMonths(new Date(), 6),
    endDate: new Date(),
  });
  const [warehouseId, setWarehouseId] = useState<string>('');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, warehouseId]);

  const fetchData = async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getInventoryMetrics({
        warehouseId: warehouseId || undefined,
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });
      if (response?.data) {
        setData(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching inventory metrics:', err);
      setError(err.message || 'Failed to load inventory metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      const blob = await apiClient.exportAnalytics('inventory', format, {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-report-${Date.now()}.${format}`;
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
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading inventory analytics...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  const metricsData = data
    ? [
        { name: 'Total Value', value: Number(data.totalValue || 0) },
        { name: 'Total Quantity', value: data.totalQuantity || 0 },
        { name: 'Low Stock Items', value: data.lowStockItems || 0 },
      ]
    : [];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Inventory Analytics</h1>
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
            <div className="mt-4">
              <label className="text-sm font-medium text-hos-text-secondary">Filter by Warehouse:</label>
              <input
                type="text"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                placeholder="Warehouse ID (leave empty for all)"
                className="mt-1 px-3 py-1.5 border border-hos-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-hos-gold/50 w-full max-w-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Inventory Value</h3>
              <p className="text-3xl font-bold text-white mt-2">
                ${data?.totalValue ? Number(data.totalValue).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Total Quantity</h3>
              <p className="text-3xl font-bold text-white mt-2">{data?.totalQuantity || 0}</p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Warehouses</h3>
              <p className="text-3xl font-bold text-white mt-2">{data?.warehouseCount || 0}</p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted">Low Stock Items</h3>
              <p className="text-3xl font-bold text-red-600 mt-2">{data?.lowStockItems || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted mb-2">Turnover Rate</h3>
              <p className="text-4xl font-bold text-white">
                {data?.turnoverRate ? data.turnoverRate.toFixed(2) : '0.00'}
              </p>
              <p className="text-sm text-hos-text-muted mt-2">
                Annual inventory turnover rate (times per year)
              </p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-hos-text-muted mb-2">Average Days in Stock</h3>
              <p className="text-4xl font-bold text-white">
                {data?.averageDaysInStock ? data.averageDaysInStock.toFixed(1) : '0.0'} days
              </p>
              <p className="text-sm text-hos-text-muted mt-2">Average time items stay in inventory</p>
            </div>
          </div>

          {metricsData.length > 0 && (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Inventory Metrics</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metricsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#3b82f6" name="Value" />
                </BarChart>
              </ResponsiveContainer>
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
