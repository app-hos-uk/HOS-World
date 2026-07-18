'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
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
              <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Link href="/admin/loyalty-analytics" className="text-sm text-violet-400">← Health</Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Tier analysis</h1>
          {loading ? <p className="text-hos-text-muted">Loading…</p> : error ? <p className="text-red-400 text-sm">{error}</p> : (
            <div className="overflow-x-auto">
              <table className="admin-table rounded min-w-full">
                <thead><tr>
                  <th className="whitespace-nowrap">Tier</th>
                  <th className="text-right whitespace-nowrap">Members</th>
                  <th className="text-right whitespace-nowrap">Avg spend</th>
                  <th className="text-right whitespace-nowrap">Avg CLV</th>
                  <th className="text-right whitespace-nowrap">Freq/mo</th>
                  <th className="text-right whitespace-nowrap">Churn</th>
                  <th className="text-right whitespace-nowrap">Revenue</th>
                </tr></thead>
                <tbody>
                  {data.map((t: any) => (
                    <tr key={t.tier}>
                      <td className="font-medium whitespace-nowrap">{t.tier}</td>
                      <td className="text-right tabular-nums">{t.memberCount}</td>
                      <td className="text-right tabular-nums">${Number(t.avgSpend).toFixed(2)}</td>
                      <td className="text-right tabular-nums">${Number(t.avgClv).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{Number(t.avgPurchaseFreq).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{(Number(t.churnRate) * 100).toFixed(1)}%</td>
                      <td className="text-right tabular-nums">${Number(t.revenueContribution).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
