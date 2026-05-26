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
        const d = r.data;
        if (Array.isArray(d)) {
          setRows(d as Record<string, unknown>[]);
        } else if (d && typeof d === 'object' && 'items' in d && Array.isArray((d as any).items)) {
          setRows((d as any).items);
        } else {
          setRows([]);
        }
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
          <h1 className="text-2xl font-semibold text-hos-text-secondary mb-4">Click &amp; collect</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              className="border rounded px-2 py-1 text-sm bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              placeholder="Store ID (optional)"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
            />
            <select
              className="border rounded px-2 py-1 text-sm bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border"
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
              className="text-sm px-3 py-1 rounded bg-hos-surface text-hos-text-secondary"
              onClick={() => load()}
            >
              Apply
            </button>
          </div>
          {loading ? (
            <p className="text-hos-text-muted">Loading…</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {rows.map((r) => {
                const id = String(r.id);
                const st = r.store as Record<string, string> | undefined;
                const ord = r.order as Record<string, string> | undefined;
                return (
                  <li key={id} className="border rounded-lg p-3 bg-hos-bg-secondary flex justify-between gap-2">
                    <div>
                      <Link href={`/admin/click-collect/${id}`} className="text-violet-400 font-medium">
                        {ord?.orderNumber ?? id.slice(0, 8)}
                      </Link>
                      <p className="text-hos-text-muted text-xs">
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
