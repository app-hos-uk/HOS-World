'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Analytics {
  totalClicks: number;
  totalConversions: number;
  conversionRate: string | number;
  totalSalesAmount: number;
  totalCommission: number;
  pendingCommission: number;
  approvedCommission: number;
  paidCommission: number;
  tier: string;
  referralCode: string;
  clicksByDay: Array<{ date: string; count: number }>;
  conversionsByDay: Array<{ date: string; count: number }>;
}

// Tier thresholds for progression
const TIER_CONFIG = {
  BRONZE: { minSales: 0, maxSales: 500, commission: 5, next: 'SILVER' },
  SILVER: { minSales: 500, maxSales: 2000, commission: 7, next: 'GOLD' },
  GOLD: { minSales: 2000, maxSales: 10000, commission: 10, next: 'PLATINUM' },
  PLATINUM: { minSales: 10000, maxSales: Infinity, commission: 15, next: null },
} as const;

// Achievement definitions
const ACHIEVEMENTS = [
  { id: 'first_click', name: 'First Click', description: 'Got your first referral click', icon: '🎯', threshold: 1, metric: 'clicks' },
  { id: 'click_100', name: 'Traffic Driver', description: 'Reached 100 clicks', icon: '🚀', threshold: 100, metric: 'clicks' },
  { id: 'click_1000', name: 'Viral Sensation', description: 'Reached 1,000 clicks', icon: '⚡', threshold: 1000, metric: 'clicks' },
  { id: 'first_sale', name: 'First Sale', description: 'Made your first sale', icon: '🎉', threshold: 1, metric: 'conversions' },
  { id: 'sales_10', name: 'Rising Star', description: 'Completed 10 sales', icon: '⭐', threshold: 10, metric: 'conversions' },
  { id: 'sales_50', name: 'Top Performer', description: 'Completed 50 sales', icon: '🏆', threshold: 50, metric: 'conversions' },
  { id: 'sales_100', name: 'Sales Champion', description: 'Completed 100 sales', icon: '👑', threshold: 100, metric: 'conversions' },
  { id: 'earnings_100', name: 'First Payout', description: 'Earned £100 in commissions', icon: '💷', threshold: 100, metric: 'earnings' },
  { id: 'earnings_1000', name: 'Money Maker', description: 'Earned £1,000 in commissions', icon: '💰', threshold: 1000, metric: 'earnings' },
  { id: 'earnings_5000', name: 'High Earner', description: 'Earned £5,000 in commissions', icon: '🤑', threshold: 5000, metric: 'earnings' },
] as const;

interface Influencer {
  id: string;
  displayName: string;
  slug: string;
  bio?: string;
  profileImage?: string;
  referralCode: string;
  tier: string;
  status: string;
}

export default function InfluencerDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Influencer | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [profileRes, analyticsRes] = await Promise.all([
        apiClient.getMyInfluencerProfile(),
        apiClient.getMyInfluencerAnalytics(),
      ]);
      setProfile(profileRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (analytics?.referralCode) {
      const link = `${window.location.origin}?ref=${analytics.referralCode}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success('Referral link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareToTwitter = async () => {
    if (!analytics?.referralCode) return;
    try {
      const link = `${window.location.origin}?ref=${analytics.referralCode}`;
      const text = encodeURIComponent('Check out the House of Spells Marketplace!');
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${text}`, '_blank');

      const token = localStorage.getItem('auth_token');
      await fetch('/api/social-sharing/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          type: 'REFERRAL',
          itemId: analytics.referralCode,
          platform: 'twitter',
        }),
      });
    } catch (err) {
      console.error('Error recording twitter share:', err);
    }
  };

  const shareToFacebook = async () => {
    if (!analytics?.referralCode) return;
    try {
      const link = `${window.location.origin}?ref=${analytics.referralCode}`;
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, '_blank');

      const token = localStorage.getItem('auth_token');
      await fetch('/api/social-sharing/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          type: 'REFERRAL',
          itemId: analytics.referralCode,
          platform: 'facebook',
        }),
      });
    } catch (err) {
      console.error('Error recording facebook share:', err);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  // Combine clicks and conversions data for chart
  const chartData = useMemo(() => {
    if (!analytics?.clicksByDay && !analytics?.conversionsByDay) return [];
    
    const clicks = analytics.clicksByDay || [];
    const conversions = analytics.conversionsByDay || [];
    
    // Create a map of all dates
    const dateMap = new Map<string, { date: string; clicks: number; conversions: number }>();
    
    clicks.forEach(({ date, count }) => {
      const existing = dateMap.get(date) || { date, clicks: 0, conversions: 0 };
      existing.clicks = count;
      dateMap.set(date, existing);
    });
    
    conversions.forEach(({ date, count }) => {
      const existing = dateMap.get(date) || { date, clicks: 0, conversions: 0 };
      existing.conversions = count;
      dateMap.set(date, existing);
    });
    
    // Sort by date and format for display
    return Array.from(dateMap.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(item => ({
        ...item,
        displayDate: new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      }));
  }, [analytics?.clicksByDay, analytics?.conversionsByDay]);

  // Calculate tier progress
  const tierProgress = useMemo(() => {
    const currentTier = (profile?.tier || 'BRONZE') as keyof typeof TIER_CONFIG;
    const config = TIER_CONFIG[currentTier] || TIER_CONFIG.BRONZE;
    const totalSales = analytics?.totalSalesAmount || 0;
    
    if (!config.next) {
      // PLATINUM tier: no next tier, so target equals current sales (no progression needed)
      return { percentage: 100, current: totalSales, target: totalSales, nextTier: null };
    }
    
    const progress = ((totalSales - config.minSales) / (config.maxSales - config.minSales)) * 100;
    return {
      percentage: Math.min(Math.max(progress, 0), 100),
      current: totalSales,
      target: config.maxSales,
      nextTier: config.next,
      remaining: Math.max(config.maxSales - totalSales, 0),
    };
  }, [profile?.tier, analytics?.totalSalesAmount]);

  // Calculate earned achievements
  const earnedAchievements = useMemo(() => {
    if (!analytics) return [];
    
    return ACHIEVEMENTS.filter(achievement => {
      switch (achievement.metric) {
        case 'clicks':
          return analytics.totalClicks >= achievement.threshold;
        case 'conversions':
          return analytics.totalConversions >= achievement.threshold;
        case 'earnings':
          return analytics.totalCommission >= achievement.threshold;
        default:
          return false;
      }
    });
  }, [analytics]);

  // Calculate week-over-week growth
  // Use UTC-based date-only strings; both periods are exactly 7 days for a fair comparison
  const weeklyGrowth = useMemo(() => {
    if (!chartData.length) return { clicks: 0, conversions: 0 };
    
    const now = new Date();
    const todayUTC = now.toISOString().split('T')[0];
    // This week: last 7 days (today - 6 through today inclusive)
    const startOfThisWeekUTC = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6
    )).toISOString().split('T')[0];
    // Last week: previous 7 days (today - 13 through today - 7 inclusive)
    const startOfLastWeekUTC = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13
    )).toISOString().split('T')[0];
    const endOfLastWeekUTC = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7
    )).toISOString().split('T')[0];
    
    let thisWeekClicks = 0, lastWeekClicks = 0;
    let thisWeekConversions = 0, lastWeekConversions = 0;
    
    chartData.forEach(item => {
      const itemDate = item.date.split('T')[0];
      if (itemDate >= startOfThisWeekUTC && itemDate <= todayUTC) {
        thisWeekClicks += item.clicks;
        thisWeekConversions += item.conversions;
      } else if (itemDate >= startOfLastWeekUTC && itemDate <= endOfLastWeekUTC) {
        lastWeekClicks += item.clicks;
        lastWeekConversions += item.conversions;
      }
    });
    
    const clickGrowth = lastWeekClicks > 0 ? ((thisWeekClicks - lastWeekClicks) / lastWeekClicks) * 100 : 0;
    const conversionGrowth = lastWeekConversions > 0 ? ((thisWeekConversions - lastWeekConversions) / lastWeekConversions) * 100 : 0;
    
    return { clicks: Math.round(clickGrowth), conversions: Math.round(conversionGrowth) };
  }, [chartData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back, {profile?.displayName}!
            </h1>
            <p className="text-gray-600 mt-1">
              Track your performance and manage your referral links
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              profile?.tier === 'PLATINUM' ? 'bg-gray-800 text-white' :
              profile?.tier === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
              profile?.tier === 'SILVER' ? 'bg-gray-200 text-gray-800' :
              'bg-orange-100 text-orange-800'
            }`}>
              {profile?.tier} Tier
            </span>
          </div>
        </div>

        {/* Referral Link Card */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-2">Your Referral Link</h2>
              <p className="text-purple-100 text-sm mb-4">
                Share this link to earn commissions on every purchase
              </p>
              <div className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-2">
                <code className="text-sm">
                  {typeof window !== 'undefined' && `${window.location.origin}?ref=${analytics?.referralCode}`}
                </code>
                <div className="flex items-center gap-2">
                  <button
                    onClick={shareToTwitter}
                    className="px-2 py-1 bg-white text-blue-500 rounded-md text-sm font-medium hover:bg-white/90"
                  >
                    Twitter
                  </button>
                  <button
                    onClick={shareToFacebook}
                    className="px-2 py-1 bg-white text-blue-700 rounded-md text-sm font-medium hover:bg-white/90"
                  >
                    Facebook
                  </button>
                  <button
                    onClick={copyReferralLink}
                    className="px-3 py-1 bg-white text-purple-600 rounded-md text-sm font-medium hover:bg-purple-50 transition-colors"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 rounded-xl p-4 text-center">
                <p className="text-4xl font-bold">{analytics?.referralCode}</p>
                <p className="text-purple-200 text-sm mt-1">Your Code</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Clicks</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {analytics?.totalClicks?.toLocaleString() || 0}
                </p>
                {weeklyGrowth.clicks !== 0 && (
                  <p className={`text-sm mt-1 flex items-center gap-1 ${weeklyGrowth.clicks > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {weeklyGrowth.clicks > 0 ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    )}
                    {Math.abs(weeklyGrowth.clicks)}% vs last week
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Conversions</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {analytics?.totalConversions?.toLocaleString() || 0}
                </p>
                <p className="text-green-600 text-sm mt-1">
                  {analytics?.conversionRate}% rate
                </p>
                {weeklyGrowth.conversions !== 0 && (
                  <p className={`text-sm mt-1 flex items-center gap-1 ${weeklyGrowth.conversions > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {weeklyGrowth.conversions > 0 ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    )}
                    {Math.abs(weeklyGrowth.conversions)}% vs last week
                  </p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Sales</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(analytics?.totalSalesAmount || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Earnings</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(analytics?.totalCommission || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Progress Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Tier Progress</h3>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                profile?.tier === 'PLATINUM' ? 'bg-gray-800 text-white' :
                profile?.tier === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
                profile?.tier === 'SILVER' ? 'bg-gray-200 text-gray-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {profile?.tier || 'BRONZE'}
              </span>
              {tierProgress.nextTier && (
                <>
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    tierProgress.nextTier === 'PLATINUM' ? 'bg-gray-800 text-white' :
                    tierProgress.nextTier === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
                    tierProgress.nextTier === 'SILVER' ? 'bg-gray-200 text-gray-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {tierProgress.nextTier}
                  </span>
                </>
              )}
            </div>
          </div>
          
          {tierProgress.nextTier ? (
            <>
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500 ease-out"
                  style={{ width: `${tierProgress.percentage}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-white drop-shadow">
                    {tierProgress.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Current: {formatCurrency(tierProgress.current)}</span>
                <span className="font-medium text-purple-600">
                  {formatCurrency(tierProgress.remaining || 0)} to go!
                </span>
                <span>Target: {formatCurrency(tierProgress.target)}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <span className="text-2xl">🎉</span>
              <p className="text-gray-600 mt-2">Congratulations! You've reached the highest tier!</p>
            </div>
          )}
        </div>

        {/* Performance Chart */}
        {chartData.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Performance Trends</h3>
              <div className="flex items-center gap-4 text-sm">
                {weeklyGrowth.clicks !== 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Clicks:</span>
                    <span className={weeklyGrowth.clicks > 0 ? 'text-green-600' : 'text-red-600'}>
                      {weeklyGrowth.clicks > 0 ? '↑' : '↓'} {Math.abs(weeklyGrowth.clicks)}%
                    </span>
                  </div>
                )}
                {weeklyGrowth.conversions !== 0 && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Conversions:</span>
                    <span className={weeklyGrowth.conversions > 0 ? 'text-green-600' : 'text-red-600'}>
                      {weeklyGrowth.conversions > 0 ? '↑' : '↓'} {Math.abs(weeklyGrowth.conversions)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="displayDate" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="clicks"
                    name="Clicks"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClicks)"
                  />
                  <Area
                    type="monotone"
                    dataKey="conversions"
                    name="Conversions"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorConversions)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Achievements Section */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Achievements</h3>
            <span className="text-sm text-gray-500">
              {earnedAchievements.length} / {ACHIEVEMENTS.length} unlocked
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {ACHIEVEMENTS.map(achievement => {
              const isEarned = earnedAchievements.some(a => a.id === achievement.id);
              return (
                <div
                  key={achievement.id}
                  className={`relative p-4 rounded-xl text-center transition-all ${
                    isEarned
                      ? 'bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200'
                      : 'bg-gray-50 border border-gray-200 opacity-50'
                  }`}
                >
                  <div className={`text-3xl mb-2 ${isEarned ? '' : 'grayscale'}`}>
                    {achievement.icon}
                  </div>
                  <p className={`font-medium text-sm ${isEarned ? 'text-gray-900' : 'text-gray-500'}`}>
                    {achievement.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{achievement.description}</p>
                  {isEarned && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Commission Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Commission Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Pending</span>
                <span className="font-semibold text-yellow-600">
                  {formatCurrency(analytics?.pendingCommission || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Approved</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(analytics?.approvedCommission || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Paid</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(analytics?.paidCommission || 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href="/influencer/product-links"
                className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-8 h-8 text-purple-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Product Links</span>
              </Link>
              <Link
                href="/influencer/storefront"
                className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-8 h-8 text-purple-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-sm font-medium text-gray-700">My Storefront</span>
              </Link>
              <Link
                href="/influencer/earnings"
                className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-8 h-8 text-purple-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Earnings</span>
              </Link>
              <Link
                href="/influencer/profile"
                className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-8 h-8 text-purple-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-sm font-medium text-gray-700">Profile</span>
              </Link>
            </div>
          </div>
        </div>

        {/* View Storefront Link */}
        {profile?.slug && (
          <div className="text-center">
            <Link
              href={`/i/${profile.slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium"
            >
              <span>View my public storefront</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
