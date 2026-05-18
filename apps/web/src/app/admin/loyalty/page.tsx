'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
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
    purple: 'bg-purple-50 text-purple-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    rose: 'bg-rose-50 text-rose-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Loyalty Programme Management</h1>
          <p className="text-gray-600 mt-1">Manage tiers, earn rules, rewards, campaigns, and members</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {cards.map((c) => (
                <Link key={c.label} href={c.href} className="block bg-white border rounded-lg p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{c.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{Number(c.value).toLocaleString()}</p>
                    </div>
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${colorMap[c.color]}`}>
                      {c.icon}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <Link href="/admin/loyalty/tiers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-xl">🏆</span>
                    <div>
                      <p className="font-medium text-gray-900">Manage Tiers</p>
                      <p className="text-sm text-gray-500">Edit tier thresholds and multipliers</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty/earn-rules" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-xl">⚡</span>
                    <div>
                      <p className="font-medium text-gray-900">Earn Rules</p>
                      <p className="text-sm text-gray-500">Configure how customers earn points</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty/redemption-options" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-xl">🎁</span>
                    <div>
                      <p className="font-medium text-gray-900">Redemption Options</p>
                      <p className="text-sm text-gray-500">Manage the rewards catalogue</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty/campaigns" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-xl">🎯</span>
                    <div>
                      <p className="font-medium text-gray-900">Bonus Campaigns</p>
                      <p className="text-sm text-gray-500">Create double-points events</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty/members" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-xl">👥</span>
                    <div>
                      <p className="font-medium text-gray-900">Member Lookup</p>
                      <p className="text-sm text-gray-500">Search members, adjust points</p>
                    </div>
                  </Link>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Analytics</h2>
                <div className="space-y-2">
                  <Link href="/admin/loyalty-analytics" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-xl">💡</span>
                    <div>
                      <p className="font-medium text-gray-900">Programme Health</p>
                      <p className="text-sm text-gray-500">Overall loyalty KPIs and trends</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty-analytics/tiers" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-xl">📊</span>
                    <div>
                      <p className="font-medium text-gray-900">Tier Analysis</p>
                      <p className="text-sm text-gray-500">Member distribution across tiers</p>
                    </div>
                  </Link>
                  <Link href="/admin/loyalty-analytics/clv" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-xl">👤</span>
                    <div>
                      <p className="font-medium text-gray-900">Customer Lifetime Value</p>
                      <p className="text-sm text-gray-500">CLV distribution and top members</p>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
