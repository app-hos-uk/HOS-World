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
            <table className="admin-table border rounded bg-hos-bg-secondary">
              <thead className="bg-hos-bg-secondary"><tr>
                <th>Tier</th>
                <th>Members</th>
                <th>Avg spend</th>
                <th>Avg CLV</th>
                <th>Freq/mo</th>
                <th>Churn</th>
                <th>Revenue</th>
              </tr></thead>
              <tbody>
                {data.map((t: any) => (
                  <tr key={t.tier} className="border-t">
                    <td className="font-medium">{t.tier}</td>
                    <td>{t.memberCount}</td>
                    <td>${Number(t.avgSpend).toFixed(2)}</td>
                    <td>${Number(t.avgClv).toFixed(2)}</td>
                    <td>{Number(t.avgPurchaseFreq).toFixed(2)}</td>
                    <td>{(Number(t.churnRate) * 100).toFixed(1)}%</td>
                    <td>${Number(t.revenueContribution).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
          </RouteGuard>
  );
}
