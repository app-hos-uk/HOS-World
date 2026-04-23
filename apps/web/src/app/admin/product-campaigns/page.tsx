'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminProductCampaignsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListProductCampaigns({ status: status || undefined })
      .then((r) => {
        const d = r.data as Record<string, unknown>[] | undefined;
        setRows(Array.isArray(d) ? d : []);
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
        <div className="p-6 max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Product campaigns</h1>
            <Link
              href="/admin/product-campaigns/new"
              className="text-sm rounded-md bg-violet-700 px-3 py-2 text-white"
            >
              New campaign
            </Link>
          </div>
          <div className="flex gap-2 mb-4">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
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
                const cid = String(r.id);
                return (
                  <li key={cid} className="border rounded-lg p-3 bg-white">
                    <Link href={`/admin/product-campaigns/${cid}`} className="text-violet-700 font-medium">
                      {String(r.name)}
                    </Link>
                    <p className="text-gray-500 text-xs">
                      {String(r.status)} · {String(r.type)}
                    </p>
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
