'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import {
  ComposedChart,
  BarChart,
  Bar,
  Line,
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

interface SellerData {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  storeName?: string;
  storeDescription?: string;
  isVerified?: boolean;
  createdAt: string;
  _count?: {
    products?: number;
    orders?: number;
  };
}

interface AnalyticsData {
  totalSellers: number;
  activeSellers: number;
  pendingSellers: number;
  totalRevenue: number;
  sellers: SellerData[];
  sellersByType: { type: string; count: number }[];
  sellerGrowth: { month: string; count: number }[];
  topSellers: { name: string; revenue: number; orders: number }[];
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export default function AdminSellerAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range based on timeRange selection
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Fetch sellers from admin endpoint
      const sellersResponse = await apiClient.getAdminSellers({ page: 1, limit: 500 });
      const payload = sellersResponse?.data as any;
      const rawSellers = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      // Map seller profile data to the format expected by analytics
      const mappedSellers = rawSellers.map((seller: any) => ({
        id: seller.user?.id || seller.userId || seller.id,
        sellerId: seller.id,
        email: seller.user?.email || '',
        firstName: seller.user?.firstName || '',
        lastName: seller.user?.lastName || '',
        role: seller.user?.role || seller.sellerType || 'SELLER',
        storeName: seller.storeName || '',
        storeDescription: seller.storeDescription || '',
        isVerified: seller.verified !== false,
        createdAt: seller.createdAt || seller.user?.createdAt || new Date().toISOString(),
        totalRevenue: seller.totalRevenue || 0,
        _count: seller._count || {
          products: seller.totalProducts || 0,
          orders: seller.totalOrders || 0,
        },
      }));

      // Calculate analytics from seller data
      const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
      const allSellers = mappedSellers.filter((s: any) => sellerRoles.includes(s.role));
      
      // Filter sellers created within the time range for metrics
      const sellersInRange = allSellers.filter((s: any) => {
        const createdAt = new Date(s.createdAt);
        return createdAt >= startDate;
      });
      
      const activeSellers = allSellers.filter((s: any) => s.isVerified);
      const pendingSellers = allSellers.filter((s: any) => !s.isVerified);
      
      // New sellers in range
      const newSellersInRange = sellersInRange.length;

      // Group by type (sellers in selected range)
      const sellersByType = [
        { type: 'B2C Seller', count: sellersInRange.filter((s: any) => s.role === 'B2C_SELLER').length },
        { type: 'Wholesaler', count: sellersInRange.filter((s: any) => s.role === 'WHOLESALER').length },
        { type: 'Seller', count: sellersInRange.filter((s: any) => s.role === 'SELLER').length },
      ].filter(t => t.count > 0);

      // Generate growth data based on time range
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const sellerGrowth = [];
      
      // Determine number of periods and interval based on time range
      let periods: number;
      let intervalDays: number;
      switch (timeRange) {
        case '7d':
          periods = 7;
          intervalDays = 1;
          break;
        case '30d':
          periods = 6;
          intervalDays = 5;
          break;
        case '90d':
          periods = 6;
          intervalDays = 15;
          break;
        case '1y':
          periods = 12;
          intervalDays = 30;
          break;
        default:
          periods = 6;
          intervalDays = 5;
      }
      
      for (let i = periods - 1; i >= 0; i--) {
        const periodEnd = new Date(now.getTime() - i * intervalDays * 24 * 60 * 60 * 1000);
        const periodStart = new Date(periodEnd.getTime() - intervalDays * 24 * 60 * 60 * 1000);
        let label: string;
        if (timeRange === '7d') {
          label = periodEnd.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (timeRange === '1y') {
          label = months[periodEnd.getMonth()];
        } else {
          label = `${periodEnd.getMonth() + 1}/${periodEnd.getDate()}`;
        }
        // Count new sellers in this period (not cumulative)
        const newCount = allSellers.filter((s: any) => {
          const createdAt = new Date(s.createdAt);
          return createdAt > periodStart && createdAt <= periodEnd;
        }).length;
        // Also track cumulative total for reference
        const cumulativeCount = allSellers.filter((s: any) => {
          const createdAt = new Date(s.createdAt);
          return createdAt <= periodEnd;
        }).length;
        sellerGrowth.push({ month: label, count: cumulativeCount, newSellers: newCount });
      }

      const topSellers = sellersInRange
        .map((s: any) => ({
          name: s.storeName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
          revenue: Number(s.totalRevenue || 0),
          orders: s._count?.orders || 0,
          products: s._count?.products || 0,
        }))
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 5);

      setAnalytics({
        totalSellers: sellersInRange.length,
        activeSellers: sellersInRange.filter((s: any) => s.isVerified).length,
        pendingSellers: sellersInRange.filter((s: any) => !s.isVerified).length,
        totalRevenue: sellersInRange.reduce((sum: number, s: any) => sum + Number(s.totalRevenue || 0), 0),
        sellers: sellersInRange,
        sellersByType,
        sellerGrowth,
        topSellers,
      });
    } catch (err: any) {
      console.error('Error fetching seller analytics:', err);
      setError(err.message || 'Failed to load seller analytics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Seller Analytics</h1>
              <p className="text-hos-text-secondary mt-1">Performance metrics and insights for all sellers</p>
            </div>
            <div className="flex gap-2">
              {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    timeRange === range
                      ? 'bg-hos-gold text-[#1a1406]'
                      : 'bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-tertiary'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button
                onClick={fetchAnalytics}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && analytics && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-hos-text-muted">Total Sellers</h3>
                    <span className="text-2xl">👥</span>
                  </div>
                  <p className="text-3xl font-bold text-hos-text-secondary mt-2">
                    {analytics.totalSellers}
                  </p>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-hos-text-muted">Active Sellers</h3>
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-3xl font-bold text-green-400 mt-2">
                    {analytics.activeSellers}
                  </p>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-hos-text-muted">Pending Verification</h3>
                    <span className="text-2xl">⏳</span>
                  </div>
                  <p className="text-3xl font-bold text-yellow-400 mt-2">
                    {analytics.pendingSellers}
                  </p>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-hos-text-muted">Est. Total Revenue</h3>
                    <span className="text-2xl">💰</span>
                  </div>
                  <p className="text-3xl font-bold text-hos-text-secondary mt-2">
                    ${analytics.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Seller Growth Chart */}
                <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Seller Growth</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={analytics.sellerGrowth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" />
                        <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                        <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid #2a2a2e', borderRadius: '6px', color: '#e8e4dc' }}
                        />
                        <Legend />
                        <Bar 
                          yAxisId="right"
                          dataKey="newSellers" 
                          fill="#10b981"
                          opacity={0.7}
                          radius={[4, 4, 0, 0]}
                          name="New Sellers"
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="count" 
                          stroke="#8b5cf6" 
                          strokeWidth={2}
                          dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                          name="Total Sellers"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sellers by Type */}
                <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Sellers by Type</h2>
                  <div className="h-64 flex flex-col">
                    {analytics.sellersByType.length > 0 ? (
                      <>
                        <div className="flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analytics.sellersByType}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={70}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="count"
                                label={false}
                              >
                                {analytics.sellersByType.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ backgroundColor: '#1a1a1c', border: '1px solid #2a2a2e', borderRadius: '6px', color: '#e8e4dc' }}
                                formatter={(value: number, name: string) => [`${value} sellers`, name]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
                          {analytics.sellersByType.map((entry, index) => (
                            <div key={entry.type} className="flex items-center gap-1.5 text-xs">
                              <span 
                                className="w-2.5 h-2.5 rounded-sm" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-hos-text-secondary">{entry.type}</span>
                              <span className="text-hos-text-muted">({entry.count})</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-hos-text-muted">
                        No seller data available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Sellers */}
              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Top Sellers by Products</h2>
                {analytics.topSellers.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.topSellers} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" stroke="#6b7280" fontSize={12} />
                        <YAxis dataKey="name" type="category" width={150} stroke="#6b7280" fontSize={11} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        />
                        <Legend />
                        <Bar dataKey="products" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Products" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-8 text-hos-text-muted">
                    No seller performance data available
                  </div>
                )}
              </div>

              {/* Sellers Table */}
              <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-hos-border">
                  <h2 className="text-lg font-semibold text-hos-text-secondary">All Sellers</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Seller
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Products
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                      {analytics.sellers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-hos-text-muted">
                            No sellers found
                          </td>
                        </tr>
                      ) : (
                        analytics.sellers.slice(0, 10).map((seller) => (
                          <tr key={seller.id} className="hover:bg-hos-bg-tertiary">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-hos-gold/20 rounded-full flex items-center justify-center">
                                  <span className="text-hos-gold font-medium">
                                    {(seller.storeName || seller.email || '?')[0].toUpperCase()}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-hos-text-secondary">
                                    {seller.storeName || `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || 'N/A'}
                                  </div>
                                  <div className="text-sm text-hos-text-muted">{seller.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                seller.role === 'WHOLESALER' 
                                  ? 'bg-hos-gold/20 text-hos-gold' 
                                  : seller.role === 'B2C_SELLER'
                                  ? 'bg-green-500/15 text-green-300'
                                  : 'bg-hos-bg-tertiary text-hos-text-secondary'
                              }`}>
                                {seller.role.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                seller.isVerified 
                                  ? 'bg-green-500/15 text-green-300' 
                                  : 'bg-yellow-500/15 text-yellow-300'
                              }`}>
                                {seller.isVerified ? 'Verified' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                              {seller._count?.products || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                              {new Date(seller.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
          </RouteGuard>
  );
}
