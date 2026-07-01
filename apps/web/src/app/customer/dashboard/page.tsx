'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RecentlyViewed } from '@/components/RecentlyViewed';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalSpent: number;
  wishlistItems: number;
  cartItems: number;
}

// Local Order type that matches what we receive from JSON API (dates as strings)
interface DashboardOrder {
  id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  total: number;
  createdAt: string | Date;
  items?: any[];
}

type TabType = 'overview' | 'orders' | 'analytics' | 'activity';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([]);
  const [allOrders, setAllOrders] = useState<DashboardOrder[]>([]);
  const [profileStats, setProfileStats] = useState<any>(null);
  const [recentWishlist, setRecentWishlist] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loyaltyMembership, setLoyaltyMembership] = useState<any>(null);
  const [loyaltyProgress, setLoyaltyProgress] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login?redirect=/customer/dashboard');
      return;
    }
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchDashboardData();
    };
    const interval = setInterval(() => fetchDashboardData(), 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      if (!hasLoadedOnceRef.current) setLoading(true);
      setError(null);

      const [
        ordersResponse,
        wishlistResponse,
        cartResponse,
        gamificationResponse,
        loyaltyRes,
        loyaltyProgressRes,
        recommendationsRes,
      ] = await Promise.all([
        apiClient.getOrders().catch(() => ({ data: [] })),
        apiClient.getWishlist({ limit: 8 }).catch(() => ({ data: [] })),
        apiClient.getCart().catch(() => ({ data: { items: [] } })),
        apiClient.getGamificationStats().catch(() => null),
        apiClient.getLoyaltyMembership().catch(() => null),
        apiClient.getLoyaltyTierProgress().catch(() => null),
        apiClient.getAIRecommendations().catch(() => null),
      ]);

      const orders: DashboardOrder[] = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];
      setAllOrders(orders);
      
      // Calculate stats
      const totalOrders = orders.length;
      const pendingOrders = orders.filter((o) => {
        const status = o.status?.toUpperCase();
        const paid = o.paymentStatus?.toUpperCase() === 'PAID';
        return paid && ['PENDING', 'PROCESSING', 'SHIPPED'].includes(status);
      }).length;
      const completedOrders = orders.filter((o) => 
        ['DELIVERED', 'COMPLETED', 'PAID'].includes(o.status?.toUpperCase())
      ).length;
      const totalSpent = orders
        .filter((o) => ['DELIVERED', 'COMPLETED', 'PAID'].includes(o.status?.toUpperCase()))
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

      // Fetch wishlist — request a separate count call for the true total
      const wishlistData = wishlistResponse?.data as any;
      const wishlistArray: any[] = Array.isArray(wishlistData)
        ? wishlistData
        : (wishlistData?.products || []);
      let paginationTotal: number | undefined;
      if (wishlistData && typeof wishlistData === 'object' && wishlistData.pagination?.total != null) {
        paginationTotal = Number(wishlistData.pagination.total);
      } else if (wishlistData && typeof wishlistData === 'object' && wishlistData.total != null) {
        paginationTotal = Number(wishlistData.total);
      }
      const wishlistItemsCount = paginationTotal ?? wishlistArray.length;
      setRecentWishlist(wishlistArray.slice(0, 4));

      const cartItems = cartResponse?.data?.items?.length || 0;

      if (gamificationResponse?.data) {
        setProfileStats(gamificationResponse.data);
      }

      setLoyaltyMembership(loyaltyRes?.data ?? null);
      setLoyaltyProgress(loyaltyProgressRes?.data ?? null);

      const recs = recommendationsRes?.data;
      setRecommendedProducts(Array.isArray(recs) ? recs.slice(0, 8) : []);

      // Build recent activity from orders and wishlist
      const activity: any[] = [];
      
      // Add recent orders to activity
      orders.slice(0, 5).forEach((order) => {
        activity.push({
          id: `order-${order.id}`,
          type: 'order',
          title: `Order #${order.orderNumber || order.id.slice(0, 8)}`,
          description: `${order.status} - ${formatPrice(order.total, 'USD')}`,
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
        wishlistItems: wishlistItemsCount,
        cartItems,
      });

      setRecentOrders(orders.slice(0, 5));
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      hasLoadedOnceRef.current = true;
      setHasLoadedOnce(true);
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
        return 'bg-yellow-500/15 text-yellow-300';
      case 'PROCESSING':
        return 'bg-hos-gold/20 text-hos-gold';
      case 'SHIPPED':
        return 'bg-hos-gold/20 text-hos-gold';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'bg-green-500/15 text-green-300';
      case 'CANCELLED':
        return 'bg-red-500/15 text-red-300';
      default:
        return 'bg-hos-bg-tertiary text-hos-text-secondary';
    }
  };

  const formatDate = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  if (loading && !hasLoadedOnce) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER']}>
        <div className="min-h-screen bg-hos-bg-secondary">
          <Header />
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-hos-text-secondary">Loading dashboard...</p>
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
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-hos-text-secondary mb-2">
              {stats?.totalOrders === 0 ? 'Welcome' : 'Welcome back'}{user?.firstName ? `, ${user.firstName}` : ''}! ✨
            </h1>
            <p className="text-hos-text-secondary text-sm sm:text-base">
              {stats?.totalOrders === 0
                ? 'Start your magical shopping journey with us'
                : 'Manage your orders, track shipments, and explore your shopping journey'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2 mb-6 border-b border-hos-border pb-2">
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
                    ? 'bg-hos-gold text-[#1a1406] shadow-md'
                    : 'bg-hos-bg-secondary text-hos-text-secondary hover:bg-hos-bg-tertiary border border-hos-border'
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
                <div className="bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border">
                  <div className="text-3xl mb-2">📦</div>
                  <p className="text-2xl font-bold text-hos-text-secondary">{stats?.totalOrders || 0}</p>
                  <p className="text-xs text-hos-text-muted">Total Orders</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border">
                  <div className="text-3xl mb-2">⏳</div>
                  <p className="text-2xl font-bold text-amber-400">{stats?.pendingOrders || 0}</p>
                  <p className="text-xs text-hos-text-muted">In Progress</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-2xl font-bold text-green-400">{stats?.completedOrders || 0}</p>
                  <p className="text-xs text-hos-text-muted">Completed</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border">
                  <div className="text-3xl mb-2">💰</div>
                  <p className="text-2xl font-bold text-hos-gold">{formatPrice(stats?.totalSpent || 0)}</p>
                  <p className="text-xs text-hos-text-muted">Total Spent</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border">
                  <div className="text-3xl mb-2">❤️</div>
                  <p className="text-2xl font-bold text-pink-400">{stats?.wishlistItems || 0}</p>
                  <p className="text-xs text-hos-text-muted">Wishlist</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border">
                  <div className="text-3xl mb-2">🛒</div>
                  <p className="text-2xl font-bold text-hos-gold">{stats?.cartItems || 0}</p>
                  <p className="text-xs text-hos-text-muted">In Cart</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Profile Summary */}
                <div className="bg-gradient-to-br from-hos-bg-secondary to-hos-gold/30 rounded-xl p-6 text-hos-text-secondary shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Your Profile</h2>
                    <Link href="/profile" className="text-hos-gold/30 hover:text-hos-gold text-sm">
                      View →
                    </Link>
                  </div>
                  {profileStats ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-hos-bg-secondary/20 flex items-center justify-center text-2xl">
                          {profileStats.character?.avatar ? (
                            <Image
                              src={profileStats.character.avatar}
                              alt={profileStats.character.name}
                              width={56}
                              height={56}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            user?.firstName?.[0] || '👤'
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-lg">
                            {profileStats.character?.name || user?.firstName || 'Adventurer'}
                          </p>
                          <p className="text-hos-gold/30">Level {profileStats.level || 1}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{(profileStats.points || 0).toLocaleString()}</p>
                          <p className="text-xs text-hos-gold/30">Points</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{profileStats.badgeCount || 0}</p>
                          <p className="text-xs text-hos-gold/30">Badges</p>
                        </div>
                      </div>
                      {profileStats.progress && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Next Level</span>
                            <span>{profileStats.progress.percentage}%</span>
                          </div>
                          <div className="w-full bg-hos-bg-secondary/20 rounded-full h-2">
                            <div
                              className="bg-hos-bg-secondary h-2 rounded-full"
                              style={{ width: `${profileStats.progress.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-hos-gold/30 mb-3">Start your adventure!</p>
                      <Link
                        href="/profile"
                        className="inline-block px-4 py-2 bg-hos-bg-secondary/20 hover:bg-hos-bg-secondary/30 rounded-lg text-sm font-medium"
                      >
                        Set Up Profile
                      </Link>
                    </div>
                  )}
                </div>

                {/* Loyalty Program Card */}
                <div className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">The Enchanted Circle</h2>
                    <Link href="/loyalty" className="text-amber-200 hover:text-hos-gold text-sm">
                      View →
                    </Link>
                  </div>
                  {loyaltyMembership ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-hos-bg-secondary/20 flex items-center justify-center text-2xl">
                          ✨
                        </div>
                        <div>
                          <p className="font-bold text-lg">{loyaltyMembership.tier?.name || 'Member'}</p>
                          <p className="text-amber-200 text-sm">Loyalty Tier</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                        <div className="text-center">
                          <p className="text-2xl font-bold">{(loyaltyMembership.currentBalance || 0).toLocaleString()}</p>
                          <p className="text-xs text-amber-200">Points Balance</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold">{(loyaltyMembership.totalPointsEarned || 0).toLocaleString()}</p>
                          <p className="text-xs text-amber-200">Lifetime Earned</p>
                        </div>
                      </div>
                      {loyaltyProgress?.nextTier && (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Progress to {loyaltyProgress.nextTier.name}</span>
                            <span>{loyaltyProgress.progressPercent ?? 0}%</span>
                          </div>
                          <div className="w-full bg-hos-bg-secondary/20 rounded-full h-2">
                            <div
                              className="bg-hos-bg-secondary h-2 rounded-full transition-all"
                              style={{ width: `${loyaltyProgress.progressPercent ?? 0}%` }}
                            />
                          </div>
                          <p className="text-xs text-amber-200 mt-1">{loyaltyProgress.pointsToNext ?? 0} points to go</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-amber-200 mb-3">Join our loyalty program to earn rewards!</p>
                      <Link
                        href="/loyalty"
                        className="inline-block px-4 py-2 bg-hos-bg-secondary/20 hover:bg-hos-bg-secondary/30 rounded-lg text-sm font-medium"
                      >
                        Join Now
                      </Link>
                    </div>
                  )}
                </div>

                {/* Wishlist Preview */}
                <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm border border-hos-border lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-hos-text-secondary">Wishlist</h2>
                    <Link href="/wishlist" className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium">
                      View All →
                    </Link>
                  </div>
                  {recentWishlist.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-2">💜</div>
                      <p className="text-hos-text-muted text-sm mb-3">No items yet</p>
                      <Link
                        href="/products"
                        className="inline-block px-4 py-2 bg-hos-gold/20 text-hos-gold-hover rounded-lg text-sm font-medium hover:bg-hos-gold/20"
                      >
                        Explore Products
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {recentWishlist.slice(0, 4).map((item: any) => {
                        const product = item.product || item;
                        const imageUrl = product.images?.[0]?.url || product.images?.[0];
                        return (
                          <Link
                            key={item.id || product.id}
                            href={`/products/${product.id}`}
                            className="group"
                          >
                            <div className="relative h-32 w-full max-h-32 rounded-lg overflow-hidden bg-hos-bg-tertiary mb-2">
                              {imageUrl ? (
                                <Image
                                  src={imageUrl}
                                  alt={product.name}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform"
                                  sizes="(max-width: 768px) 50vw, 25vw"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-hos-text-muted text-xs">
                                  No image
                                </div>
                              )}
                            </div>
                            <p className="text-xs font-medium text-hos-text-secondary truncate">{product.name}</p>
                            <p className="text-xs text-hos-gold">{formatPrice(product.price)}</p>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {recommendedProducts.length > 0 && (
                <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm border border-hos-border mb-6">
                  <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Recommended For You</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {recommendedProducts.map((product: any) => {
                      const imageUrl = product.images?.[0]?.url || product.images?.[0];
                      return (
                        <Link
                          key={product.id}
                          href={`/products/${product.slug || product.id}`}
                          className="group"
                        >
                          <div className="relative h-32 rounded-lg overflow-hidden bg-hos-bg-tertiary mb-2">
                            {imageUrl ? (
                              <Image src={imageUrl} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform" sizes="150px" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-hos-text-muted text-xs">No image</div>
                            )}
                          </div>
                          <p className="text-xs font-medium text-hos-text-secondary truncate">{product.name}</p>
                          <p className="text-xs text-hos-gold">{formatPrice(product.price, product.currency || 'USD')}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <RecentlyViewed />
              </div>

              {/* Quick Actions — horizontal tiles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                  <Link
                    href="/orders"
                    className="flex flex-col items-center text-center gap-2 bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border hover:shadow-md hover:border-hos-border-accent transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg bg-hos-gold/20 flex items-center justify-center text-2xl">📋</div>
                    <div>
                      <p className="font-semibold text-hos-text-secondary text-sm">View All Orders</p>
                      <p className="text-xs text-hos-text-muted mt-0.5">Track orders</p>
                    </div>
                  </Link>
                  <Link
                    href="/cart"
                    className="flex flex-col items-center text-center gap-2 bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border hover:shadow-md hover:border-hos-border-accent transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center text-2xl">🛒</div>
                    <div>
                      <p className="font-semibold text-hos-text-secondary text-sm">Shopping Cart</p>
                      <p className="text-xs text-hos-text-muted mt-0.5">{stats?.cartItems || 0} items</p>
                    </div>
                  </Link>
                  <Link
                    href="/loyalty"
                    className="flex flex-col items-center text-center gap-2 bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border hover:shadow-md hover:border-amber-500/30 transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center text-2xl">✨</div>
                    <div>
                      <p className="font-semibold text-hos-text-secondary text-sm">Loyalty Rewards</p>
                      <p className="text-xs text-hos-text-muted mt-0.5">Earn points</p>
                    </div>
                  </Link>
                  <Link
                    href="/products"
                    className="flex flex-col items-center text-center gap-2 bg-hos-bg-secondary rounded-xl p-4 shadow-sm border border-hos-border hover:shadow-md hover:border-hos-border-accent transition-all"
                  >
                    <div className="w-12 h-12 rounded-lg bg-green-500/15 flex items-center justify-center text-2xl">🔮</div>
                    <div>
                      <p className="font-semibold text-hos-text-secondary text-sm">Browse Products</p>
                      <p className="text-xs text-hos-text-muted mt-0.5">Discover items</p>
                    </div>
                  </Link>
              </div>

              {/* Recent Orders */}
              <div className="bg-hos-bg-secondary rounded-xl shadow-sm border border-hos-border">
                <div className="p-6 border-b border-hos-border flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-hos-text-secondary">Recent Orders</h2>
                  <Link href="/orders" className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium">
                    View All →
                  </Link>
                </div>
                <div className="divide-y divide-hos-border">
                  {recentOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">📦</div>
                      <p className="text-hos-text-muted mb-4">No orders yet</p>
                      <Link
                        href="/products"
                        className="inline-block px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
                      >
                        Start Shopping
                      </Link>
                    </div>
                  ) : (
                    recentOrders.map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between p-4 hover:bg-hos-bg-tertiary transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-hos-gold/20 flex items-center justify-center text-lg">
                            📦
                          </div>
                          <div>
                            <p className="font-medium text-hos-text-secondary">
                              Order #{order.orderNumber || order.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-hos-text-muted">{formatDate(order.createdAt)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          <p className="text-sm font-semibold text-hos-text-secondary mt-1">{formatPrice(order.total)}</p>
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
                <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm border border-hos-border text-center">
                  <p className="text-3xl font-bold text-hos-text-secondary">{stats?.totalOrders || 0}</p>
                  <p className="text-sm text-hos-text-muted">Total Orders</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm border border-yellow-500/30 text-center">
                  <p className="text-3xl font-bold text-yellow-400">{stats?.pendingOrders || 0}</p>
                  <p className="text-sm text-hos-text-muted">Pending</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm border border-green-500/30 text-center">
                  <p className="text-3xl font-bold text-green-400">{stats?.completedOrders || 0}</p>
                  <p className="text-sm text-hos-text-muted">Completed</p>
                </div>
                <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm border border-hos-border-accent text-center">
                  <p className="text-3xl font-bold text-hos-gold">{formatPrice(stats?.totalSpent || 0)}</p>
                  <p className="text-sm text-hos-text-muted">Total Spent</p>
                </div>
              </div>

              {/* Orders List */}
              <div className="bg-hos-bg-secondary rounded-xl shadow-sm border border-hos-border">
                <div className="p-6 border-b border-hos-border flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-hos-text-secondary">All Orders</h2>
                  <Link href="/orders" className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium">
                    View Full Page →
                  </Link>
                </div>
                <div className="divide-y divide-hos-border">
                  {allOrders.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">📦</div>
                      <p className="text-hos-text-muted mb-4">No orders yet</p>
                      <Link
                        href="/products"
                        className="inline-block px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
                      >
                        Start Shopping
                      </Link>
                    </div>
                  ) : (
                    allOrders.slice(0, 10).map((order) => (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="flex items-center justify-between p-4 hover:bg-hos-bg-tertiary transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-hos-gold/20 flex items-center justify-center text-lg">
                            📦
                          </div>
                          <div>
                            <p className="font-medium text-hos-text-secondary">
                              Order #{order.orderNumber || order.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-hos-text-muted">
                              {new Date(order.createdAt).toLocaleDateString('en-US', {
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
                          <p className="text-sm font-semibold text-hos-text-secondary mt-1">{formatPrice(order.total)}</p>
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
                <div className="bg-gradient-to-br from-hos-bg-secondary to-hos-gold/30 rounded-xl p-6 text-white">
                  <p className="text-hos-gold/30 text-sm mb-1">This Year&apos;s Spending</p>
                  <p className="text-3xl font-bold">{formatPrice(spendingAnalytics.yearlyTotal)}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-6 text-white">
                  <p className="text-green-200 text-sm mb-1">Average Order Value</p>
                  <p className="text-3xl font-bold">
                    {formatPrice(
                      allOrders.length && stats?.completedOrders && stats.completedOrders > 0
                        ? stats.totalSpent! / stats.completedOrders
                        : 0
                    )}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white">
                  <p className="text-amber-200 text-sm mb-1">Total Orders</p>
                  <p className="text-3xl font-bold">{stats?.totalOrders || 0}</p>
                </div>
              </div>

              {/* Spending Chart */}
              <div className="bg-hos-bg-secondary rounded-xl p-6 shadow-sm border border-hos-border">
                <h3 className="text-lg font-semibold text-hos-text-secondary mb-4">Spending Over Time (Last 6 Months)</h3>
                {spendingAnalytics.monthlySpending.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spendingAnalytics.monthlySpending}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatPrice(value)} />
                        <Tooltip
                          formatter={(value: number) => [formatPrice(value), 'Spent']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                        />
                        <Bar dataKey="amount" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-hos-text-muted">
                    <div className="text-4xl mb-2">📊</div>
                    <p>No spending data yet</p>
                  </div>
                )}
              </div>

              {/* Order Status Breakdown — legend + fixed chart box avoids slice-label overflow misalignment */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
                <div className="flex min-h-[320px] flex-col rounded-xl border border-hos-border bg-hos-bg-secondary p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-hos-text-secondary">Order Status Breakdown</h3>
                  {spendingAnalytics.categoryBreakdown.length > 0 ? (
                    <div className="flex min-h-0 flex-1 flex-col justify-center">
                      <div className="mx-auto h-[260px] w-full max-w-md">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <Pie
                              data={spendingAnalytics.categoryBreakdown}
                              cx="50%"
                              cy="45%"
                              innerRadius="42%"
                              outerRadius="72%"
                              paddingAngle={spendingAnalytics.categoryBreakdown.length > 1 ? 2 : 0}
                              dataKey="value"
                              nameKey="name"
                              labelLine={false}
                            >
                              {spendingAnalytics.categoryBreakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend
                              verticalAlign="bottom"
                              align="center"
                              layout="horizontal"
                              wrapperStyle={{ paddingTop: 8 }}
                              formatter={(value, entry) => {
                                const v = (entry?.payload as { value?: number })?.value;
                                return (
                                  <span className="text-xs text-hos-text-secondary">
                                    {value}
                                    {typeof v === 'number' ? ` (${v})` : ''}
                                  </span>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center py-12 text-hos-text-muted">
                      <p>No order data yet</p>
                    </div>
                  )}
                </div>

                <div className="flex min-h-[320px] flex-col rounded-xl border border-hos-border bg-hos-bg-secondary p-6 shadow-sm">
                  <h3 className="mb-4 text-lg font-semibold text-hos-text-secondary">Shopping Insights</h3>
                  <div className="flex flex-1 flex-col justify-center space-y-4">
                    <div className="flex items-center justify-between p-3 bg-hos-bg-secondary rounded-lg">
                      <span className="text-hos-text-secondary">Favorite Category</span>
                      <span className="font-semibold text-hos-text-secondary">🧙 Wizarding Items</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-hos-bg-secondary rounded-lg">
                      <span className="text-hos-text-secondary">Most Active Month</span>
                      <span className="font-semibold text-hos-text-secondary">
                        {spendingAnalytics.monthlySpending.length > 0
                          ? spendingAnalytics.monthlySpending.reduce((a, b) => (a.amount > b.amount ? a : b)).month
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-hos-bg-secondary rounded-lg">
                      <span className="text-hos-text-secondary">Completion Rate</span>
                      <span className="font-semibold text-green-400">
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
            <div className="bg-hos-bg-secondary rounded-xl shadow-sm border border-hos-border">
              <div className="p-6 border-b border-hos-border">
                <h2 className="text-lg font-semibold text-hos-text-secondary">Recent Activity</h2>
                <p className="text-sm text-hos-text-muted">Your recent orders and wishlist updates</p>
              </div>
              <div className="divide-y divide-hos-border">
                {recentActivity.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">🕐</div>
                    <p className="text-hos-text-muted mb-4">No recent activity</p>
                    <Link
                      href="/products"
                      className="inline-block px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
                    >
                      Start Exploring
                    </Link>
                  </div>
                ) : (
                  recentActivity.map((activity) => (
                    <Link
                      key={activity.id}
                      href={activity.link}
                      className="flex items-center gap-4 p-4 hover:bg-hos-bg-tertiary transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-hos-bg-tertiary flex items-center justify-center text-xl">
                        {activity.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-hos-text-secondary">{activity.title}</p>
                        <p className="text-sm text-hos-text-muted truncate">{activity.description}</p>
                      </div>
                      <div className="text-sm text-hos-text-muted">{formatDate(activity.date)}</div>
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
