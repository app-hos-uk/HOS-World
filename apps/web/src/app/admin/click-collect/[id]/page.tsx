'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminClickCollectDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetClickCollect(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: Error) => toast.error(e.message));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const status = row ? String(row.status) : '';

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          <Link href="/admin/click-collect" className="text-sm text-violet-700">
            ← All orders
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">Click &amp; collect</h1>
                  <p className="text-sm text-gray-500">{status}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {status === 'PENDING' && (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-gray-800 text-white"
                      onClick={() => act(() => apiClient.adminMarkCCPreparing(id), 'Preparing')}
                    >
                      Preparing
                    </button>
                  )}
                  {(status === 'PENDING' || status === 'PREPARING') && (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-emerald-600 text-white"
                      onClick={() => act(() => apiClient.adminMarkCCReady(id), 'Ready')}
                    >
                      Ready
                    </button>
                  )}
                  {status === 'READY' && (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-violet-700 text-white"
                      onClick={() => act(() => apiClient.adminMarkCCCollected(id), 'Collected')}
                    >
                      Collected
                    </button>
                  )}
                  {!['COLLECTED', 'CANCELLED', 'EXPIRED'].includes(status) && (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded border border-gray-400"
                      onClick={() => act(() => apiClient.adminCancelCC(id), 'Cancelled')}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <pre className="text-xs overflow-auto border rounded-lg p-4 bg-white max-h-96">
                {JSON.stringify(row, null, 2)}
              </pre>
            </>
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
