'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

export default function FandomTrendsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetFandomTrends(30)
      .then((r) => setData(Array.isArray(r.data) ? r.data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load fandom trends'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Link href="/admin/loyalty-analytics" className="text-sm text-violet-400">← Health</Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Fandom trends (30d)</h1>
          {loading ? <p className="text-hos-text-muted">Loading…</p> : error ? <p className="text-red-400 text-sm">{error}</p> : (
            <div className="overflow-x-auto">
              <table className="admin-table rounded min-w-full">
                <thead><tr>
                  <th className="whitespace-nowrap">Fandom</th>
                  <th className="text-right whitespace-nowrap">Members</th>
                  <th className="text-right whitespace-nowrap">Revenue</th>
                  <th className="text-right whitespace-nowrap">Orders</th>
                  <th className="text-right whitespace-nowrap">Avg spend</th>
                  <th className="text-right whitespace-nowrap">Growth</th>
                </tr></thead>
                <tbody>
                  {data.map((f: any) => (
                    <tr key={f.fandom}>
                      <td className="font-medium whitespace-nowrap">{f.fandom}</td>
                      <td className="text-right tabular-nums">{f.members}</td>
                      <td className="text-right tabular-nums">${Number(f.revenue).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{f.orders}</td>
                      <td className="text-right tabular-nums">${Number(f.avgSpend).toFixed(2)}</td>
                      <td className="text-right tabular-nums">{f.growth > 0 ? '+' : ''}{f.growth}%</td>
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
