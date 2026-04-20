'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function FandomTrendsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .adminGetFandomTrends(30)
      .then((r) => setData(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Link href="/admin/loyalty-analytics" className="text-sm text-violet-700">← Health</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Fandom trends (30d)</h1>
          {loading ? <p className="text-gray-500">Loading…</p> : (
            <table className="min-w-full text-sm border rounded bg-white">
              <thead className="bg-gray-50"><tr>
                <th className="text-left px-3 py-2">Fandom</th>
                <th className="px-3 py-2">Members</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Orders</th>
                <th className="px-3 py-2">Avg spend</th>
                <th className="px-3 py-2">Growth</th>
              </tr></thead>
              <tbody>
                {data.map((f: any) => (
                  <tr key={f.fandom} className="border-t">
                    <td className="px-3 py-2 font-medium">{f.fandom}</td>
                    <td className="px-3 py-2">{f.members}</td>
                    <td className="px-3 py-2">£{Number(f.revenue).toFixed(2)}</td>
                    <td className="px-3 py-2">{f.orders}</td>
                    <td className="px-3 py-2">£{Number(f.avgSpend).toFixed(2)}</td>
                    <td className="px-3 py-2">{f.growth > 0 ? '+' : ''}{f.growth}%</td>
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
