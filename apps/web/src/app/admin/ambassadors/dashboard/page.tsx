'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function AdminAmbassadorDashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetAmbassadorDashboard()
      .then((r) => setData((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <Link href="/admin/ambassadors" className="text-sm text-violet-400 mb-4 inline-block">
            ← All ambassadors
          </Link>
          <h1 className="text-2xl font-semibold text-white mb-6">Ambassador program</h1>
          {error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : loading ? (
            <p className="text-hos-text-muted">Loading…</p>
          ) : data ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted">Total ambassadors</p>
                <p className="text-2xl font-semibold">{String(data.totalAmbassadors)}</p>
              </div>
              <div className="border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted">Pending UGC</p>
                <p className="text-2xl font-semibold">{String(data.pendingUgc)}</p>
              </div>
              <div className="border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted">Ambassador points (sum)</p>
                <p className="text-2xl font-semibold">{String(data.totalAmbassadorPoints)}</p>
              </div>
              <div className="col-span-full border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted mb-2">By tier</p>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(data.byTier, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-hos-text-muted">No data available.</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
