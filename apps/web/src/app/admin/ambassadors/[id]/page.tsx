'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminAmbassadorDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient
      .adminGetAmbassador(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));
  }, [id, toast]);

  const suspend = async () => {
    try {
      await apiClient.adminSuspendAmbassador(id);
      toast.success('Suspended');
      const r = await apiClient.adminGetAmbassador(id);
      setRow((r.data as Record<string, unknown>) || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const reactivate = async () => {
    try {
      await apiClient.adminReactivateAmbassador(id);
      toast.success('Reactivated');
      const r = await apiClient.adminGetAmbassador(id);
      setRow((r.data as Record<string, unknown>) || null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <Link href="/admin/ambassadors" className="text-sm text-violet-400 mb-4 inline-block">
            ← Back
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h1 className="text-2xl font-semibold text-white">
                    {String(row.displayName || 'Ambassador')}
                  </h1>
                  <p className="text-sm text-hos-text-muted">
                    {String(row.tier)} · {String(row.status)}
                  </p>
                </div>
                <div className="space-x-2">
                  {row.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="text-sm px-3 py-1 rounded border border-amber-600 text-amber-300"
                      onClick={suspend}
                    >
                      Suspend
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-sm px-3 py-1 rounded border border-emerald-600 text-emerald-300"
                      onClick={reactivate}
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-hos-bg-secondary text-sm mb-4">
                <p className="font-medium mb-2">Recent UGC</p>
                <ul className="space-y-1 text-hos-text-secondary">
                  {((row.recentUgc as Record<string, unknown>[]) || []).map((u) => (
                    <li key={String(u.id)}>
                      {String(u.type)} — {String(u.status)}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-hos-text-muted">Loading…</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
