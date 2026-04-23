'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function ChannelPerformancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetChannelPerformance(30)
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load channel data'))
      .finally(() => setLoading(false));
  }, []);

  const ch = (label: string, c: any) => (
    <div className="border rounded-lg p-4 bg-white shadow-sm text-sm space-y-1">
      <p className="font-medium text-gray-700">{label}</p>
      <p>Orders: {c?.orders ?? 0}</p>
      <p>Revenue: £{Number(c?.revenue ?? 0).toFixed(2)}</p>
      <p>Points earned: {c?.pointsEarned ?? 0}</p>
      <p>Avg order: £{Number(c?.avgOrder ?? 0).toFixed(2)}</p>
    </div>
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Link href="/admin/loyalty-analytics" className="text-sm text-violet-700">← Health</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Channel performance (30d)</h1>
          {loading ? <p className="text-gray-500">Loading…</p> : error ? <p className="text-red-600 text-sm">{error}</p> : data ? (
            <div className="grid md:grid-cols-2 gap-4">
              {ch('Web (online)', data.web)}
              {ch('POS (in-store)', data.pos)}
            </div>
          ) : <p className="text-gray-500">No data available.</p>}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
