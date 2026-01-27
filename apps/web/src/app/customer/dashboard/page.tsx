'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalSpent: number;
  wishlistItems: number;
  cartItems: number;
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  total: number;
  createdAt: string;
  items?: any[];
}

type TabType = 'overview' | 'orders' | 'analytics' | 'activity';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [profileStats, setProfileStats] = useState<any>(null);
  const [recentWishlist, setRecentWishlist] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch orders
      const ordersResponse = await apiClient.getOrders().catch(() => ({ data: [] }));
      const orders: Order[] = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];
      setAllOrders(orders);
      
      // Calculate stats
      const totalOrders = orders.length;
      const pendingOrders = orders.filter((o) => 
        ['PENDING', 'PROCESSING', 'SHIPPED'].includes(o.status?.toUpperCase())
      ).length;
      const completedOrders = orders.filter((o) => 
        ['DELIVERED', 'COMPLETED'].includes(o.status?.toUpperCase())
      ).length;
      const totalSpent = orders
        .filter((o) => ['DELIVERED', 'COMPLETED'].includes(o.status?.toUpperCase()))
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      // Fetch wishlist
      const wishlistResponse = await apiClient.getWishlist().catch(() => ({ data: [] }));
      const wishlistData = wishlistResponse?.data;
      const wishlistArray = Array.isArray(wishlistData) 
        ? wishlistData 
        : (wishlistData?.products || []);
      const wishlistItems = wishlistArray.length;
      setRecentWishlist(wishlistArray.slice(0, 4));

      // Fetch cart
      const cartResponse = await apiClient.getCart().catch(() => ({ data: { items: [] } }));
      const cartItems = cartResponse?.data?.items?.length || 0;

      // Fetch gamification stats
      const gamificationResponse = await apiClient.getGamificationStats().catch(() => null);
      if (gamificationResponse?.data) {
        setProfileStats(gamificationResponse.data);
      }

      // Build recent activity from orders and wishlist
      const activity: any[] = [];
      
      // Add recent orders to activity
      orders.slice(0, 5).forEach((order) => {
        activity.push({
          id: `order-${order.id}`,
          type: 'order',
          title: `Order #${order.orderNumber || order.id.slice(0, 8)}`,
          description: `${order.status} - ${formatPrice(order.total, 'GBP')}`,
          date: order.createdAt,
          icon: '📦',
          link: `/orders/${order.id}`,
        });
      });

      // Add recent wishlist items to activity
      wishlistArray.slice(0, 3).forEach((item: any) => {
        const product = item.product || item;
        activity.push({
          id: `wishlist-${item.id || product.id}`,
          type: 'wishlist',
          title: 'Added to Wishlist',
          description: product.name,
          date: item.addedAt || item.createdAt,
          icon: '❤️',
          link: `/products/${product.id}`,
        });
      });

      // Sort activity by date (most recent first)
      activity.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentActivity(activity.slice(0, 10));

      setStats({
        totalOrders,
        pendingOrders,
        completedOrders,
        totalSpent,
        wishlistItems,
        cartItems,
      });

      setRecentOrders(orders.slice(0, 5));
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Calculate spending analytics
  const spendingAnalytics = useMemo(() => {
    if (!allOrders.length) return { monthlySpending: [], categoryBreakdown: [], yearlyTotal: 0 };

    const completedOrders = allOrders.filter((o) => 
      ['DELIVERED', 'COMPLETED', 'PAID'].includes(o.status?.toUpperCase())
    );

    // Monthly spending for the last 6 months
    const monthlyData: Record<string, number> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyData[key] = 0;
    }

    completedOrders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      const monthsAgo = (now.getFullYear() - orderDate.getFullYear()) * 12 + (now.getMonth() - orderDate.getMonth());
      if (monthsAgo >= 0 && monthsAgo < 6) {
        const key = orderDate.toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthlyData[key] !== undefined) {
          monthlyData[key] += Number(order.total) || 0;
        }
      }
    });

    const monthlySpending = Object.entries(monthlyData).map(([month, amount]) => ({
      month,
      amount: Math.round(amount * 100) / 100,
    }));

    // Category/status breakdown
    const statusCounts: Record<string, number> = {};
    allOrders.forEach((order) => {
      const status = order.status?.toUpperCase() || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const colors = {
      COMPLETED: '#10B981',
      DELIVERED: '#10B981',
      PENDING: '#F59E0B',
      PROCESSING: '#3B82F6',
      SHIPPED: '#8B5CF6',
      CANCELLED: '#EF4444',
    };

    const categoryBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      color: colors[status as keyof typeof colors] || '#6B7280',
    }));

    const yearlyTotal = completedOrders
      .filter((o) => new Date(o.createdAt).getFullYear() === now.getFullYear())
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    return { monthlySpending, categoryBreakdown, yearlyTotal };
  }, [allOrders]);

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'SHIPPED':
        return 'bg-purple-100 text-purple-800';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER']}>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-gray-600">Loading dashboard...</p>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ''}! ✨
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Manage your orders, track shipments, and explore your shopping journey
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-2">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'orders', label: 'Orders', icon: '📦' },
              { id: 'analytics', label: 'Analytics', icon: '📈' },
              { id: 'activity', label: 'Activity', icon: '🕐' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="text-3xl mb-2">📦</div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.totalOrders || 0}</p>
                  <p className="text-xs text-gray-500">Total Orders</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="text-3xl mb-2">⏳</div>
                  <p className="text-2xl font-bold text-amber-600">{stats?.pendingOrders || 0}</p>
                  <p className="text-xs text-gray-500">In Progress</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-2xl font-bold text-green-600">{stats?.completedOrders || 0}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="text-3xl mb-2">💰</div>
                  <p className="text-2xl font-bold text-purple-600">{formatPrice(stats?.totalSpent || 0)}</p>
                  <p className="text-xs text-gray-500">Total Spent</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="text-3xl mb-2">❤️</div>
                  <p className="text-2xl font-bold text-pink-600">{stats?.wishlistItems || 0}</p>
                  <p className="text-xs text-gray-500">Wishlist</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="text-3xl mb-2">🛒</div>
                  <p className="text-2xl font-bold text-blue-600">{stats?.cartItems || 0}</p>
                  <p className="text-xs text-gray-500">In Cart</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Profile Summary */}
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Your Profile</h2>
                    <Link href="/profile" className="text-purple-200 hover:text-white text-sm">
                      View →
                    </Link>
                  </div>
                  {profileStats ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl">
                          {profileStats.character?.avatar ? (
                            <img
                              src={profileStats.character.avatar}
                              alt={profileStats.character.name}
                              className="w-14 h-14 rounded-full object-cover"
                            />
                          ) : (
                            user?.firstName?.[0] || '👤'
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-lg">
                            {profileStats.character?.name || user?.firstName || 'Adventurer'}
                          </p>
                          <p className="text-purple-200">Level {profileStats.level || 1}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{(profileStats.points || 0).toLocaleString()}</p>
                          <p className="text-xs text-purple-200">Points</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{profileStats.badgeCount || 0}</p>
                          <p className="text-xs text-purple-200">Badges</p>
                        </div>
                      </div>
                      {profileStats.progress && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Next Level</span>
                            <span>{profileStats.progress.percentage}%</span>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-2">
                            <div
                              className="bg-white h-2 rounded-full"
                              style={{ width: `${profileStats.progress.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-purple-200 mb-3">Start your adventure!</p>
                      <Link
                        href="/profile"
                        className="inline-block px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium"
                      >
                        Set Up Profile
                      </Link>
                    </div>
                  )}
                </div>

                {/* Wishlist Preview */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Wishlist</h2>
                    <Link href="/wishlist" className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                      View All →
                    </Link>
                  </div>
                  {recentWishlist.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">💜</div>
                      <p className="text-gray-500 text-sm mb-3">No items yet</p>
                      <Link
                        href="/products"
                        className="inline-block px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
                      >
                        Explore Products
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {recentWishlist.slice(0, 4).map((item: any) => {
                        const product = item.product || item;
                        const imageUrl = product.images?.[0]?.url || product.images?.[0];
                        return (
                          <Link
                            key={item.id || product.id}
                            href={`/products/${product.id}`}
                            className="group"
                          >
                            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
                              {imageUrl ? (
                                <img
                                  src={imageUrl}
                                  alt={product.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                  No image
                                </div>
                              )}
                            </div>
                            <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-xs text-purple-600">{formatPrice(product.price)}</p>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                  <Link
                    href="/orders"
                    className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-2xl">📋</div>
                    <div>
                      <p className="font-semibold text-gray-900">View All Orders</p>
                      <p className="text-sm text-gray-500">Track and manage your orders</p>
                    </div>
                  </Link>
                  <Link
                    href="/cart"
                    className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center text-2xl">🛒</div>
                    <div>
                      <p className="font-semibold text-gray-900">Shopping Cart</p>
                      <p className="text-sm text-gray-500">{stats?.cartItems || 0} items ready to checkout</p>
                    </div>
                  </Link>
                  <Link
                    href="/products"
                    className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-purple-200 transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center text-2xl">🔮</div>
                    <div>
                      <p className="font-semibold text-gray-900">Browse Products</p>
                      <p className="text-sm text-gray-500">Discover magical items</p>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
                  <Link href="/orders" className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                    View All →
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {recentOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">📦</div>
                      <p className="text-gray-500 mb-4">No orders yet</p>
                      <Link
                        href="/products"
                        className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Start Shopping
                      </Link>
                    </div>
                  ) : (
                    recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">
                            📦
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Order #{order.orderNumber || order.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-gray-500">{formatDate(order.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          <p className="text-sm font-semibold text-gray-900 mt-1">{formatPrice(order.total)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Orders Tab */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Order Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalOrders || 0}</p>
                  <p className="text-sm text-gray-500">Total Orders</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-yellow-200 text-center">
                  <p className="text-3xl font-bold text-yellow-600">{stats?.pendingOrders || 0}</p>
                  <p className="text-sm text-gray-500">Pending</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-green-200 text-center">
                  <p className="text-3xl font-bold text-green-600">{stats?.completedOrders || 0}</p>
                  <p className="text-sm text-gray-500">Completed</p>
                </div>
                <div className="bg-white rounded-xl p-6 shadow-sm border border-purple-200 text-center">
                  <p className="text-3xl font-bold text-purple-600">{formatPrice(stats?.totalSpent || 0)}</p>
                  <p className="text-sm text-gray-500">Total Spent</p>
                </div>
              </div>

              {/* Orders List */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">All Orders</h2>
                  <Link href="/orders" className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                    View Full Page →
                  </Link>
                </div>
                <div className="divide-y divide-gray-100">
                  {allOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">📦</div>
                      <p className="text-gray-500 mb-4">No orders yet</p>
                      <Link
                        href="/products"
                        className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Start Shopping
                      </Link>
                    </div>
                  ) : (
                    allOrders.slice(0, 10).map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-lg">
                            📦
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Order #{order.orderNumber || order.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(order.createdAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          <p className="text-sm font-semibold text-gray-900 mt-1">{formatPrice(order.total)}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-6 text-white">
                  <p className="text-purple-200 text-sm mb-1">This Year's Spending</p>
                  <p className="text-3xl font-bold">{formatPrice(spendingAnalytics.yearlyTotal)}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white">
                  <p className="text-green-200 text-sm mb-1">Average Order Value</p>
                  <p className="text-3xl font-bold">
                    {formatPrice(allOrders.length ? stats?.totalSpent! / stats?.completedOrders! || 0 : 0)}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white">
                  <p className="text-amber-200 text-sm mb-1">Total Orders</p>
                  <p className="text-3xl font-bold">{stats?.totalOrders || 0}</p>
                </div>
              </div>

              {/* Spending Chart */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending Over Time (Last 6 Months)</h3>
                {spendingAnalytics.monthlySpending.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spendingAnalytics.monthlySpending}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `£${value}`} />
                        <Tooltip
                          formatter={(value: number) => [`£${value.toFixed(2)}`, 'Spent']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                        />
                        <Bar dataKey="amount" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">📊</div>
                    <p>No spending data yet</p>
                  </div>
                )}
              </div>

              {/* Order Status Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status Breakdown</h3>
                  {spendingAnalytics.categoryBreakdown.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={spendingAnalytics.categoryBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {spendingAnalytics.categoryBreakdown.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p>No order data yet</p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Shopping Insights</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Favorite Category</span>
                      <span className="font-semibold text-gray-900">🧙 Wizarding Items</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Most Active Month</span>
                      <span className="font-semibold text-gray-900">
                        {spendingAnalytics.monthlySpending.length > 0
                          ? spendingAnalytics.monthlySpending.reduce((a, b) => (a.amount > b.amount ? a : b)).month
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Completion Rate</span>
                      <span className="font-semibold text-green-600">
                        {stats?.totalOrders
                          ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                <p className="text-sm text-gray-500">Your recent orders and wishlist updates</p>
              </div>
              <div className="divide-y divide-gray-100">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">🕐</div>
                    <p className="text-gray-500 mb-4">No recent activity</p>
                    <Link
                      href="/products"
                      className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Start Exploring
                    </Link>
                  </div>
                ) : (
                  recentActivity.map((activity) => (
                    <Link
                      key={activity.id}
                      href={activity.link}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                        {activity.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{activity.title}</p>
                        <p className="text-sm text-gray-500 truncate">{activity.description}</p>
                      </div>
                      <div className="text-sm text-gray-400">{formatDate(activity.date)}</div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
