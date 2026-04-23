'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminClickCollectListPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [storeId, setStoreId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListClickCollect({
        status: status || undefined,
        storeId: storeId || undefined,
      })
      .then((r) => {
        const d = r.data as Record<string, unknown>[] | { items?: unknown[] };
        setRows(Array.isArray(d) ? d : ((d as { items?: Record<string, unknown>[] }).items ?? []));
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => setLoading(false));
  }, [toast, status, storeId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Click &amp; collect</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Store ID (optional)"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="PREPARING">PREPARING</option>
              <option value="READY">READY</option>
              <option value="COLLECTED">COLLECTED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
            <button
              type="button"
              className="text-sm px-3 py-1 rounded bg-gray-800 text-white"
              onClick={() => load()}
            >
              Apply
            </button>
          </div>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map((r) => {
                const id = String(r.id);
                const st = r.store as Record<string, string> | undefined;
                const ord = r.order as Record<string, string> | undefined;
                return (
                  <li key={id} className="border rounded-lg p-3 bg-white flex justify-between gap-2">
                    <div>
                      <Link href={`/admin/click-collect/${id}`} className="text-violet-700 font-medium">
                        {ord?.orderNumber ?? id.slice(0, 8)}
                      </Link>
                      <p className="text-gray-500 text-xs">
                        {String(r.status)} · {st?.name ?? st?.code ?? '—'}
                      </p>
                    </div>
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
