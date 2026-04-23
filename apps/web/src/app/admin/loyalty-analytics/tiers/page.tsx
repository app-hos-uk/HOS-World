'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function TierAnalysisPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetTierAnalysis()
      .then((r) => setData(Array.isArray(r.data) ? r.data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load tier analysis'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Link href="/admin/loyalty-analytics" className="text-sm text-violet-700">← Health</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Tier analysis</h1>
          {loading ? <p className="text-gray-500">Loading…</p> : error ? <p className="text-red-600 text-sm">{error}</p> : (
            <table className="min-w-full text-sm border rounded bg-white">
              <thead className="bg-gray-50"><tr>
                <th className="text-left px-3 py-2">Tier</th>
                <th className="px-3 py-2">Members</th>
                <th className="px-3 py-2">Avg spend</th>
                <th className="px-3 py-2">Avg CLV</th>
                <th className="px-3 py-2">Freq/mo</th>
                <th className="px-3 py-2">Churn</th>
                <th className="px-3 py-2">Revenue</th>
              </tr></thead>
              <tbody>
                {data.map((t: any) => (
                  <tr key={t.tier} className="border-t">
                    <td className="px-3 py-2 font-medium">{t.tier}</td>
                    <td className="px-3 py-2">{t.memberCount}</td>
                    <td className="px-3 py-2">£{Number(t.avgSpend).toFixed(2)}</td>
                    <td className="px-3 py-2">£{Number(t.avgClv).toFixed(2)}</td>
                    <td className="px-3 py-2">{Number(t.avgPurchaseFreq).toFixed(2)}</td>
                    <td className="px-3 py-2">{(Number(t.churnRate) * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2">£{Number(t.revenueContribution).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
