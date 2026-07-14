'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminLoyaltyDashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyDashboard();
      if (res?.data) setData(res.data as Record<string, unknown>);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load loyalty dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: 'Total Members', value: data?.totalMembers ?? data?.memberCount ?? 0, icon: '👥', color: 'purple', href: '/admin/loyalty/members' },
    { label: 'Active Tiers', value: data?.tierCount ?? data?.activeTiers ?? 0, icon: '🏆', color: 'amber', href: '/admin/loyalty/tiers' },
    { label: 'Earn Rules', value: data?.earnRuleCount ?? data?.earnRules ?? 0, icon: '⚡', color: 'blue', href: '/admin/loyalty/earn-rules' },
    { label: 'Redemption Options', value: data?.redemptionOptionCount ?? data?.redemptionOptions ?? 0, icon: '🎁', color: 'green', href: '/admin/loyalty/redemption-options' },
    { label: 'Bonus Campaigns', value: data?.campaignCount ?? data?.campaigns ?? 0, icon: '🎯', color: 'rose', href: '/admin/loyalty/campaigns' },
    { label: 'Points in Circulation', value: data?.totalPointsInCirculation ?? data?.pointsCirculating ?? 0, icon: '💎', color: 'indigo', href: '/admin/loyalty/transactions' },
  ];

  const colorMap: Record<string, string> = {
    purple: 'bg-hos-gold/10 text-hos-gold-hover',
    amber: 'bg-amber-500/10 text-amber-400',
    blue: 'bg-hos-gold/10 text-hos-gold',
    green: 'bg-green-500/10 text-green-400',
    rose: 'bg-rose-500/10 text-rose-400',
    indigo: 'bg-hos-gold/10 text-hos-gold',
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
              <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">Loyalty Program Management</h1>
          <p className="text-hos-text-secondary mt-1">Manage tiers, earn rules, rewards, campaigns, and members</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {cards.map((c) => (
                <Link key={c.label} href={c.href} className="block bg-hos-bg-secondary border rounded-lg p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-hos-text-muted">{c.label}</p>
                      <p className="text-2xl font-bold text-hos-text-secondary mt-1">{Number(c.value).toLocaleString()}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${colorMap[c.color]}`}>
                      {c.icon}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-hos-bg-secondary border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <Link href="/admin/loyalty/tiers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                    <span className="text-xl">🏆</span>
                    <div>
                      <p className="font-medium text-hos-text-secondary">Manage Tiers</p>
                      <p className="text-sm text-hos-text-muted">Edit tier thresholds and multipliers</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty/earn-rules" className="flex items-center gap-3 p-3 rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                    <span className="text-xl">⚡</span>
                    <div>
                      <p className="font-medium text-hos-text-secondary">Earn Rules</p>
                      <p className="text-sm text-hos-text-muted">Configure how customers earn points</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty/redemption-options" className="flex items-center gap-3 p-3 rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                    <span className="text-xl">🎁</span>
                    <div>
                      <p className="font-medium text-hos-text-secondary">Redemption Options</p>
                      <p className="text-sm text-hos-text-muted">Manage the rewards catalogue</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty/campaigns" className="flex items-center gap-3 p-3 rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                    <span className="text-xl">🎯</span>
                    <div>
                      <p className="font-medium text-hos-text-secondary">Bonus Campaigns</p>
                      <p className="text-sm text-hos-text-muted">Create double-points events</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty/members" className="flex items-center gap-3 p-3 rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                    <span className="text-xl">👥</span>
                    <div>
                      <p className="font-medium text-hos-text-secondary">Member Lookup</p>
                      <p className="text-sm text-hos-text-muted">Search members, adjust points</p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="bg-hos-bg-secondary border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Analytics</h2>
                <div className="space-y-2">
                  <Link href="/admin/loyalty-analytics" className="flex items-center gap-3 p-3 rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                    <span className="text-xl">💡</span>
                    <div>
                      <p className="font-medium text-hos-text-secondary">Program Health</p>
                      <p className="text-sm text-hos-text-muted">Overall loyalty KPIs and trends</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty-analytics/tiers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                    <span className="text-xl">📊</span>
                    <div>
                      <p className="font-medium text-hos-text-secondary">Tier Analysis</p>
                      <p className="text-sm text-hos-text-muted">Member distribution across tiers</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty-analytics/clv" className="flex items-center gap-3 p-3 rounded-lg hover:bg-hos-bg-tertiary transition-colors">
                    <span className="text-xl">👤</span>
                    <div>
                      <p className="font-medium text-hos-text-secondary">Customer Lifetime Value</p>
                      <p className="text-sm text-hos-text-muted">CLV distribution and top members</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
          </RouteGuard>
  );
}
