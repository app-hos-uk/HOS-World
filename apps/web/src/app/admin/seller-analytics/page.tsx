'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import {
  BarChart,
  Bar,
  LineChart,
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
      const sellersResponse = await apiClient.getAdminSellers();
      const sellers = Array.isArray(sellersResponse?.data) ? sellersResponse.data : [];

      // Calculate analytics from seller data
      const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
      const allSellers = sellers.filter((s: any) => sellerRoles.includes(s.role));
      
      // Filter sellers created within the time range for metrics
      const sellersInRange = allSellers.filter((s: any) => {
        const createdAt = new Date(s.createdAt);
        return createdAt >= startDate;
      });
      
      const activeSellers = allSellers.filter((s: any) => s.isVerified);
      const pendingSellers = allSellers.filter((s: any) => !s.isVerified);
      
      // New sellers in range
      const newSellersInRange = sellersInRange.length;

      // Group by type (all sellers)
      const sellersByType = [
        { type: 'B2C Seller', count: allSellers.filter((s: any) => s.role === 'B2C_SELLER').length },
        { type: 'Wholesaler', count: allSellers.filter((s: any) => s.role === 'WHOLESALER').length },
        { type: 'Seller', count: allSellers.filter((s: any) => s.role === 'SELLER').length },
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
        const periodDate = new Date(now.getTime() - i * intervalDays * 24 * 60 * 60 * 1000);
        let label: string;
        if (timeRange === '7d') {
          label = periodDate.toLocaleDateString('en-US', { weekday: 'short' });
        } else if (timeRange === '1y') {
          label = months[periodDate.getMonth()];
        } else {
          label = `${periodDate.getMonth() + 1}/${periodDate.getDate()}`;
        }
        const count = allSellers.filter((s: any) => {
          const createdAt = new Date(s.createdAt);
          return createdAt <= periodDate;
        }).length;
        sellerGrowth.push({ month: label, count });
      }

      // Top sellers (by product count if available)
      const topSellers = allSellers
        .map((s: any) => ({
          name: s.storeName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email,
          revenue: s._count?.orders ? s._count.orders * 50 : 0, // Estimate
          orders: s._count?.orders || 0,
          products: s._count?.products || 0,
        }))
        .sort((a: any, b: any) => b.products - a.products)
        .slice(0, 5);

      setAnalytics({
        totalSellers: allSellers.length,
        activeSellers: activeSellers.length,
        pendingSellers: pendingSellers.length,
        totalRevenue: topSellers.reduce((sum: number, s: any) => sum + s.revenue, 0),
        sellers: allSellers,
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
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Seller Analytics</h1>
              <p className="text-gray-600 mt-1">Performance metrics and insights for all sellers</p>
            </div>
            <div className="flex gap-2">
              {(['7d', '30d', '90d', '1y'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    timeRange === range
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
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
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">Total Sellers</h3>
                    <span className="text-2xl">👥</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    {analytics.totalSellers}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">Active Sellers</h3>
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {analytics.activeSellers}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">Pending Verification</h3>
                    <span className="text-2xl">⏳</span>
                  </div>
                  <p className="text-3xl font-bold text-yellow-600 mt-2">
                    {analytics.pendingSellers}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-500">Est. Total Revenue</h3>
                    <span className="text-2xl">💰</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 mt-2">
                    £{analytics.totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Seller Growth Chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Seller Growth</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.sellerGrowth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="count" 
                          stroke="#8b5cf6" 
                          strokeWidth={2}
                          dot={{ fill: '#8b5cf6', strokeWidth: 2 }}
                          name="Total Sellers"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Sellers by Type */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Sellers by Type</h2>
                  <div className="h-64">
                    {analytics.sellersByType.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.sellersByType}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="count"
                            label={({ type, percent }) => `${type} ${(percent * 100).toFixed(0)}%`}
                          >
                            {analytics.sellersByType.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        No seller data available
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top Sellers */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Sellers by Products</h2>
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
                  <div className="text-center py-8 text-gray-500">
                    No seller performance data available
                  </div>
                )}
              </div>

              {/* Sellers Table */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">All Sellers</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Seller
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Products
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {analytics.sellers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            No sellers found
                          </td>
                        </tr>
                      ) : (
                        analytics.sellers.slice(0, 10).map((seller) => (
                          <tr key={seller.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                                  <span className="text-purple-600 font-medium">
                                    {(seller.storeName || seller.email || '?')[0].toUpperCase()}
                                  </span>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {seller.storeName || `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || 'N/A'}
                                  </div>
                                  <div className="text-sm text-gray-500">{seller.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                seller.role === 'WHOLESALER' 
                                  ? 'bg-blue-100 text-blue-800' 
                                  : seller.role === 'B2C_SELLER'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {seller.role.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                seller.isVerified 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {seller.isVerified ? 'Verified' : 'Pending'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {seller._count?.products || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
      </AdminLayout>
    </RouteGuard>
  );
}
