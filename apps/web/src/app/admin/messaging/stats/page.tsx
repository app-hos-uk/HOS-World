'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function AdminMessagingStatsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetMessagingStats()
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  const rows = data?.breakdown || [];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Messaging stats (30 days)</h1>
            <Link href="/admin/messaging" className="text-indigo-600 text-sm hover:underline">
              Message logs
            </Link>
          </div>
          {error ? (
            <p className="text-red-600 text-sm">{error}</p>
          ) : loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Since {data?.since ? new Date(data.since).toLocaleString() : '—'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((r: any, i: number) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-4 bg-white shadow-sm">
                    <p className="text-xs text-gray-500 uppercase">{r.channel}</p>
                    <p className="text-lg font-semibold">{r.status}</p>
                    <p className="text-2xl text-indigo-600">{r._count?._all ?? '—'}</p>
                  </div>
                ))}
              </div>
              {rows.length === 0 && <p className="text-gray-500">No data in window.</p>}
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
