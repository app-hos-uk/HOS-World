'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function LoyaltyAnalyticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetLoyaltyHealth()
      .then((r) => setData((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const d = data as any;
  const card = (label: string, val: unknown) => (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-xl font-semibold">{String(val ?? '—')}</p>
    </div>
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <h1 className="text-2xl font-semibold text-gray-900">Programme health</h1>
          {error ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : d ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {card('Total members', d.totalMembers)}
                {card('Active (30d)', d.activeLast30d)}
                {card('Active (90d)', d.activeLast90d)}
                {card('Avg CLV', d.avgClv != null ? `£${Number(d.avgClv).toFixed(2)}` : '—')}
                {card('Churn rate', d.churnRate != null ? `${(Number(d.churnRate) * 100).toFixed(1)}%` : '—')}
                {card('Points liability', d.pointsLiability?.total)}
                {card('Liability cost', d.pointsLiability?.estimatedCost != null ? `£${d.pointsLiability.estimatedCost}` : '—')}
                {card('Revenue lift', d.revenueImpact?.liftPercent != null ? `${d.revenueImpact.liftPercent}%` : '—')}
              </div>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="border rounded-lg p-4 bg-white">
                  <p className="text-gray-500 mb-2">Points velocity (30d)</p>
                  <p>Issued: {d.pointsVelocity?.issuedLast30d ?? 0}</p>
                  <p>Redeemed: {d.pointsVelocity?.redeemedLast30d ?? 0}</p>
                  <p>Net: {d.pointsVelocity?.netChange ?? 0}</p>
                </div>
                <div className="border rounded-lg p-4 bg-white">
                  <p className="text-gray-500 mb-2">Revenue impact (30d)</p>
                  <p>Member: £{d.revenueImpact?.memberRevenue ?? 0}</p>
                  <p>Non-member: £{d.revenueImpact?.nonMemberRevenue ?? 0}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href="/admin/loyalty-analytics/clv" className="text-violet-700">CLV report →</Link>
                <Link href="/admin/loyalty-analytics/attribution" className="text-violet-700">Campaign ROI →</Link>
                <Link href="/admin/loyalty-analytics/fandom-trends" className="text-violet-700">Fandom trends →</Link>
                <Link href="/admin/loyalty-analytics/tiers" className="text-violet-700">Tier analysis →</Link>
                <Link href="/admin/loyalty-analytics/channels" className="text-violet-700">Channels →</Link>
              </div>
            </>
          ) : (
            <p className="text-gray-500">No data available.</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
