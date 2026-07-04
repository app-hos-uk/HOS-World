'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getSellerMenuItems } from '@/lib/sellerMenu';

interface ProductPerformanceRow {
  productId: string;
  name: string;
  sku: string;
  revenue: number;
  orders: number;
  quantity: number;
  averagePrice: number;
  views: number;
  conversionRate?: number;
}

type SortKey = keyof Pick<ProductPerformanceRow, 'name' | 'sku' | 'views' | 'orders' | 'revenue' | 'conversionRate' | 'averagePrice'>;

export default function SellerAnalyticsPage() {
  const { formatPrice } = useCurrency();
  const menuItems = getSellerMenuItems(false);

  const [data, setData] = useState<ProductPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(thirtyDaysAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getProductPerformance({
          startDate,
          endDate,
          limit: 100,
        });
        if (!cancelled && response?.data) {
          setData(Array.isArray(response.data) ? response.data : []);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load analytics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [data, sortKey, sortDir]);

  const summary = useMemo(() => {
    const totalViews = data.reduce((sum, p) => sum + (p.views || 0), 0);
    const totalRevenue = data.reduce((sum, p) => sum + p.revenue, 0);
    const totalOrders = data.reduce((sum, p) => sum + p.orders, 0);
    const avgConversion = totalViews > 0 ? Math.min(100, (totalOrders / totalViews) * 100) : 0;
    return { totalViews, totalRevenue, totalOrders, avgConversion };
  }, [data]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Product Name', 'SKU', 'Views', 'Orders', 'Revenue', 'Conversion Rate (%)', 'Avg Price'];
    const rows = sortedData.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      p.sku || '',
      p.views,
      p.orders,
      p.revenue.toFixed(2),
      p.conversionRate != null ? p.conversionRate.toFixed(2) : '',
      p.averagePrice.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-analytics-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span className="text-hos-text-muted ml-1">↕</span>;
    return <span className="text-hos-gold ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <RouteGuard allowedRoles={['SELLER', 'B2C_SELLER', 'WHOLESALER']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Product Analytics</h1>
          <p className="text-hos-text-secondary mt-1">Track your product performance and conversion rates</p>
        </div>

        {/* Date Range Picker */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-sm text-hos-text-secondary mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-primary focus:outline-none focus:border-hos-gold"
            />
          </div>
          <div>
            <label className="block text-sm text-hos-text-secondary mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-primary focus:outline-none focus:border-hos-gold"
            />
          </div>
          <button
            onClick={handleExportCSV}
            disabled={data.length === 0}
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export CSV
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-5">
            <p className="text-sm text-hos-text-secondary">Total Views</p>
            <p className="text-2xl font-bold mt-1">{summary.totalViews.toLocaleString()}</p>
          </div>
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-5">
            <p className="text-sm text-hos-text-secondary">Total Revenue</p>
            <p className="text-2xl font-bold mt-1 text-hos-gold">{formatPrice(summary.totalRevenue)}</p>
          </div>
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-5">
            <p className="text-sm text-hos-text-secondary">Total Orders</p>
            <p className="text-2xl font-bold mt-1">{summary.totalOrders.toLocaleString()}</p>
          </div>
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-5">
            <p className="text-sm text-hos-text-secondary">Avg Conversion Rate</p>
            <p className="text-2xl font-bold mt-1">{summary.avgConversion.toFixed(2)}%</p>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-hos-text-secondary">No product performance data for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-hos-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-hos-bg-tertiary">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary cursor-pointer select-none" onClick={() => handleSort('name')}>
                    Product Name<SortIcon column="name" />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary cursor-pointer select-none" onClick={() => handleSort('sku')}>
                    SKU<SortIcon column="sku" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary cursor-pointer select-none" onClick={() => handleSort('views')}>
                    Views<SortIcon column="views" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary cursor-pointer select-none" onClick={() => handleSort('orders')}>
                    Orders<SortIcon column="orders" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary cursor-pointer select-none" onClick={() => handleSort('revenue')}>
                    Revenue<SortIcon column="revenue" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary cursor-pointer select-none" onClick={() => handleSort('conversionRate')}>
                    Conversion<SortIcon column="conversionRate" />
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary cursor-pointer select-none" onClick={() => handleSort('averagePrice')}>
                    Avg Price<SortIcon column="averagePrice" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hos-border">
                {sortedData.map((product) => (
                  <tr key={product.productId} className="hover:bg-hos-bg-tertiary/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-hos-text-primary max-w-[200px] truncate">{product.name}</td>
                    <td className="px-4 py-3 text-hos-text-secondary">{product.sku || '—'}</td>
                    <td className="px-4 py-3 text-right">{product.views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{product.orders.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-hos-gold font-medium">{formatPrice(product.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      {product.conversionRate != null ? `${product.conversionRate.toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">{formatPrice(product.averagePrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}
