'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminAmbassadorUgcPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListAmbassadorUgc({ status: status || undefined, limit: 50 })
      .then((r) => {
        const d = r.data as { items?: Record<string, unknown>[] };
        setRows(d?.items ?? []);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => setLoading(false));
  }, [toast, status]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, next: string) => {
    try {
      await apiClient.adminReviewAmbassadorUgc(id, { status: next });
      toast.success('Updated');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <Link href="/admin/ambassadors" className="text-sm text-violet-700 mb-4 inline-block">
            ← Ambassadors
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">UGC review</h1>
          <div className="flex gap-2 mb-4">
            {['PENDING', 'APPROVED', 'REJECTED', 'FEATURED'].map((s) => (
              <button
                key={s}
                type="button"
                className={`text-xs px-2 py-1 rounded ${
                  status === s ? 'bg-gray-900 text-white' : 'bg-gray-100'
                }`}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => {
                const id = String(r.id);
                const amb = r.ambassador as Record<string, unknown> | undefined;
                return (
                  <li key={id} className="border rounded-lg p-4 bg-white text-sm flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {String(r.type)} — {String(r.title || 'Untitled')}
                      </p>
                      <p className="text-gray-500 text-xs">
                        From {String(amb?.displayName || amb?.referralCode || '—')} · {String(r.status)}
                      </p>
                    </div>
                    {r.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-emerald-600 text-white"
                          onClick={() => review(id, 'APPROVED')}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-violet-600 text-white"
                          onClick={() => review(id, 'FEATURED')}
                        >
                          Feature
                        </button>
                        <button
                          type="button"
                          className="text-xs px-2 py-1 rounded bg-gray-200"
                          onClick={() => review(id, 'REJECTED')}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
