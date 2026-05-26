'use client';

import { useState, useEffect, useCallback } from 'react';
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
  totalClicks: number;
  totalConversions: number;
  totalSalesAmount: number;
  totalCommission: number;
  user: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  _count: {
    referrals: number;
    commissions: number;
  };
  createdAt: string;
}

export default function AdminInfluencersPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    tier: '',
    search: '',
  });

  const fetchInfluencers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getInfluencers({
        status: filters.status || undefined,
        tier: filters.tier || undefined,
        search: filters.search || undefined,
        limit: 100,
      });
      setInfluencers(response.data || []);
    } catch (err: any) {
      console.error('Error fetching influencers:', err);
      toast.error('Failed to load influencers');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    fetchInfluencers();
  }, [fetchInfluencers]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-green-500/15 text-green-300',
      SUSPENDED: 'bg-red-500/15 text-red-300',
      INACTIVE: 'bg-hos-bg-tertiary text-hos-text-secondary',
    };
    return styles[status] || 'bg-hos-bg-tertiary text-hos-text-secondary';
  };

  const getTierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      PLATINUM: 'bg-hos-surface text-hos-text-secondary',
      GOLD: 'bg-yellow-500/15 text-yellow-300',
      SILVER: 'bg-hos-bg-tertiary text-hos-text-secondary',
      BRONZE: 'bg-orange-500/15 text-orange-300',
    };
    return styles[tier] || 'bg-hos-bg-tertiary text-hos-text-secondary';
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Influencers</h1>
            <p className="text-hos-text-secondary mt-1">
              Manage influencer accounts and their performance
            </p>
          </div>
          <Link
            href="/admin/influencers/invitations"
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Influencer
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-hos-bg-secondary rounded-lg shadow-sm p-4">
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search by name, email, or code..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="flex-1 min-w-64 px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-4 py-2 border border-hos-border rounded-lg"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="INACTIVE">Inactive</option>
            </select>
            <select
              value={filters.tier}
              onChange={(e) => setFilters({ ...filters, tier: e.target.value })}
              className="px-4 py-2 border border-hos-border rounded-lg"
            >
              <option value="">All Tiers</option>
              <option value="PLATINUM">Platinum</option>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
              <option value="BRONZE">Bronze</option>
            </select>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-hos-bg-secondary rounded-lg p-4 shadow-sm">
            <p className="text-sm text-hos-text-muted">Total Influencers</p>
            <p className="text-2xl font-bold text-hos-text-secondary">{influencers.length}</p>
          </div>
          <div className="bg-hos-bg-secondary rounded-lg p-4 shadow-sm">
            <p className="text-sm text-hos-text-muted">Active</p>
            <p className="text-2xl font-bold text-green-400">
              {influencers.filter(i => i.status === 'ACTIVE').length}
            </p>
          </div>
          <div className="bg-hos-bg-secondary rounded-lg p-4 shadow-sm">
            <p className="text-sm text-hos-text-muted">Total Sales</p>
            <p className="text-2xl font-bold text-hos-text-secondary">
              {formatCurrency(influencers.reduce((sum, i) => sum + i.totalSalesAmount, 0))}
            </p>
          </div>
          <div className="bg-hos-bg-secondary rounded-lg p-4 shadow-sm">
            <p className="text-sm text-hos-text-muted">Total Commissions</p>
            <p className="text-2xl font-bold text-hos-gold">
              {formatCurrency(influencers.reduce((sum, i) => sum + i.totalCommission, 0))}
            </p>
          </div>
        </div>

        {/* Influencers Table */}
        <div className="bg-hos-bg-secondary rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold mx-auto"></div>
            </div>
          ) : influencers.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-hos-text-muted mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-hos-text-muted">No influencers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Influencer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Tier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Performance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Earnings</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border">
                  {influencers.map((influencer) => (
                    <tr key={influencer.id} className="hover:bg-hos-bg-tertiary">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-hos-text-secondary">{influencer.displayName}</p>
                          <p className="text-sm text-hos-text-muted">{influencer.user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="px-2 py-1 bg-hos-bg-tertiary rounded text-sm">
                          {influencer.referralCode}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTierBadge(influencer.tier)}`}>
                          {influencer.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(influencer.status)}`}>
                          {influencer.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        <div>
                          {influencer.totalClicks} clicks · {influencer.totalConversions} sales
                        </div>
                        <div className="text-hos-text-muted">
                          {influencer.totalClicks > 0
                            ? ((influencer.totalConversions / influencer.totalClicks) * 100).toFixed(1)
                            : 0}% conversion
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-hos-text-secondary">
                          {formatCurrency(influencer.totalCommission)}
                        </div>
                        <div className="text-sm text-hos-text-muted">
                          {formatCurrency(influencer.totalSalesAmount)} sales
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/admin/influencers/${influencer.id}`}
                          className="text-hos-gold hover:text-hos-gold-hover font-medium"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </AdminLayout>
    </RouteGuard>
  );
}
