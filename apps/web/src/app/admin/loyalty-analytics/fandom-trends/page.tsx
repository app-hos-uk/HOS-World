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
            <table className="admin-table rounded">
              <thead><tr>
                <th>Fandom</th>
                <th className="text-right">Members</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Avg spend</th>
                <th className="text-right">Growth</th>
              </tr></thead>
              <tbody>
                {data.map((f: any) => (
                  <tr key={f.fandom}>
                    <td className="font-medium">{f.fandom}</td>
                    <td className="text-right">{f.members}</td>
                    <td className="text-right">${Number(f.revenue).toFixed(2)}</td>
                    <td className="text-right">{f.orders}</td>
                    <td className="text-right">${Number(f.avgSpend).toFixed(2)}</td>
                    <td className="text-right">{f.growth > 0 ? '+' : ''}{f.growth}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
          </RouteGuard>
  );
}
