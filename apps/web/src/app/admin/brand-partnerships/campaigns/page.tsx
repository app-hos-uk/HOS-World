'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminBrandCampaignsListPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListBrandCampaigns({ status: status || undefined, limit: 100 })
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

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <Link href="/admin/brand-partnerships" className="text-sm text-violet-400 mb-4 inline-block">
            ← Partners
          </Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary mb-4">Brand campaigns</h1>
          <div className="flex gap-2 mb-4">
            <select
              className="border rounded px-2 py-1 text-sm bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="SCHEDULED">SCHEDULED</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
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
                const p = r.partnership as Record<string, unknown> | undefined;
                return (
                  <li key={id} className="border rounded-lg p-3 bg-hos-bg-secondary flex justify-between gap-2">
                    <div>
                      <Link href={`/admin/brand-partnerships/campaigns/${id}`} className="text-violet-400 font-medium">
                        {String(r.name)}
                      </Link>
                      <p className="text-hos-text-muted text-xs">
                        {String(r.type)} · {String(r.status)}
                        {p?.name ? ` · ${String(p.name)}` : ''}
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
