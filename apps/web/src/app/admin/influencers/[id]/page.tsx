'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { AdminLayout } from '@/components/AdminLayout';
import { RouteGuard } from '@/components/RouteGuard';

const api = apiClient as any;

interface Influencer {
  id: string;
  displayName: string;
  slug: string;
  referralCode: string;
  status: string;
  tier: string;
  bio?: string;
  totalClicks: number;
  totalConversions: number;
  totalSalesAmount: number;
  totalCommission: number;
  commissionRate?: number;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  storefront?: {
    id: string;
    isPublished: boolean;
  };
  _count?: {
    referrals: number;
    commissions: number;
    productLinks: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export default function InfluencerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const influencerId = params?.id as string;

  useEffect(() => {
    if (influencerId) {
      fetchInfluencer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerId]);

  const fetchInfluencer = async () => {
    if (!influencerId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // Use the generic get method which returns the full API response
      const response = await api.get<{ data: Influencer; message?: string }>(`/admin/influencers/${influencerId}`);
      if (response?.data) {
        setInfluencer(response.data);
      } else if (response && typeof response === 'object' && 'id' in response) {
        // Handle case where response is the influencer directly (fallback)
        setInfluencer(response as Influencer);
      } else {
        toast.error('Influencer not found');
        setTimeout(() => {
          router.push('/admin/influencers');
        }, 2000);
      }
    } catch (err: any) {
      console.error('Error fetching influencer:', err);
      const errorMessage = err.message || err.toString() || 'Failed to load influencer details';
      toast.error(errorMessage);
      // Redirect to list page if influencer not found (404 or not found error)
      const isNotFound = 
        errorMessage.includes('404') || 
        errorMessage.includes('not found') || 
        errorMessage.includes('Not Found') ||
        errorMessage.toLowerCase().includes('not found');
      
      if (isNotFound) {
        setTimeout(() => {
          router.push('/admin/influencers');
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!influencer) return;
    try {
      setActionLoading(true);
      await api.put<{ data: Influencer; message?: string }>(`/admin/influencers/${influencer.id}`, { status: newStatus });
      toast.success(`Influencer status updated to ${newStatus}`);
      fetchInfluencer();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTierChange = async (newTier: string) => {
    if (!influencer) return;
    try {
      setActionLoading(true);
      await api.put<{ data: Influencer; message?: string }>(`/admin/influencers/${influencer.id}`, { tier: newTier });
      toast.success(`Influencer tier updated to ${newTier}`);
      fetchInfluencer();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tier');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount || 0);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-800',
      SUSPENDED: 'bg-red-100 text-red-800',
      INACTIVE: 'bg-gray-100 text-gray-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const getTierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      PLATINUM: 'bg-gray-800 text-white',
      GOLD: 'bg-yellow-100 text-yellow-800',
      SILVER: 'bg-gray-200 text-gray-800',
      BRONZE: 'bg-orange-100 text-orange-800',
    };
    return styles[tier] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN', 'MARKETING']} showAccessDenied={true}>
        <AdminLayout>
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  if (!influencer) {
    return (
      <RouteGuard allowedRoles={['ADMIN', 'MARKETING']} showAccessDenied={true}>
        <AdminLayout>
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Influencer Not Found</h2>
            <p className="text-gray-600 mb-6">The influencer you are looking for does not exist or has been removed.</p>
            <Link
              href="/admin/influencers"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Back to Influencers
            </Link>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  const conversionRate =
    influencer.totalClicks > 0
      ? ((influencer.totalConversions / influencer.totalClicks) * 100).toFixed(1)
      : '0';

  return (
    <RouteGuard allowedRoles={['ADMIN', 'MARKETING']} showAccessDenied={true}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/admin/influencers')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{influencer.displayName}</h1>
                <p className="text-gray-500">{influencer.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(influencer.status)}`}>
                {influencer.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTierBadge(influencer.tier)}`}>
                {influencer.tier}
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-500">Total Clicks</p>
              <p className="text-2xl font-bold text-gray-900">{influencer.totalClicks}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-500">Conversions</p>
              <p className="text-2xl font-bold text-green-600">{influencer.totalConversions}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-500">Conversion Rate</p>
              <p className="text-2xl font-bold text-blue-600">{conversionRate}%</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(influencer.totalSalesAmount)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-500">Commission Earned</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(influencer.totalCommission)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-500">Commission Rate</p>
              <p className="text-2xl font-bold text-amber-600">{influencer.commissionRate || 10}%</p>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">
                    {influencer.user.firstName} {influencer.user.lastName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium">{influencer.user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Slug</span>
                  <span className="font-medium">/{influencer.slug}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Referral Code</span>
                  <code className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                    {influencer.referralCode}
                  </code>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Joined</span>
                  <span className="font-medium">{new Date(influencer.createdAt).toLocaleDateString()}</span>
                </div>
                {influencer.bio && (
                  <div className="pt-2 border-t">
                    <p className="text-gray-500 text-sm mb-1">Bio</p>
                    <p className="text-gray-700">{influencer.bio}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Actions</h3>
              <div className="space-y-4">
                {/* Status Management */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex gap-2">
                    {['ACTIVE', 'SUSPENDED', 'INACTIVE'].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={actionLoading || influencer.status === status}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          influencer.status === status
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tier Management */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tier</label>
                  <div className="flex gap-2">
                    {['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map((tier) => (
                      <button
                        key={tier}
                        onClick={() => handleTierChange(tier)}
                        disabled={actionLoading || influencer.tier === tier}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          influencer.tier === tier
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } disabled:opacity-50`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Links */}
                <div className="pt-4 border-t space-y-2">
                  <Link
                    href={`/admin/influencers/commissions?influencerId=${influencer.id}`}
                    className="block w-full px-4 py-2 text-center bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
                  >
                    View Commissions
                  </Link>
                  <Link
                    href={`/admin/influencers/payouts?influencerId=${influencer.id}`}
                    className="block w-full px-4 py-2 text-center bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                  >
                    View Payouts
                  </Link>
                  <Link
                    href={`/i/${influencer.slug}`}
                    className="block w-full px-4 py-2 text-center bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
                  >
                    View Public Storefront
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
