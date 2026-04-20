'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminBrandPartnershipsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListBrandPartnerships({
        status: status || undefined,
        search: search || undefined,
        limit: 100,
      })
      .then((r) => {
        const d = r.data as { items?: Record<string, unknown>[] };
        setRows(d?.items ?? []);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [toast, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const archive = async (id: string) => {
    try {
      await apiClient.adminArchiveBrandPartnership(id);
      toast.success('Archived');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Brand partnerships</h1>
            <div className="flex gap-2">
              <Link
                href="/admin/brand-partnerships/new"
                className="rounded-md bg-violet-700 px-3 py-2 text-white text-sm"
              >
                New partner
              </Link>
              <Link href="/admin/brand-partnerships/dashboard" className="text-sm text-violet-700 py-2">
                Dashboard →
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="ARCHIVED">ARCHIVED</option>
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
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Budget</th>
                    <th className="text-left p-2">Contract</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const id = String(row.id);
                    const spent = row.spentBudget != null ? String(row.spentBudget) : '0';
                    const total = row.totalBudget != null ? String(row.totalBudget) : '0';
                    return (
                      <tr key={id} className="border-t">
                        <td className="p-2">
                          <Link href={`/admin/brand-partnerships/${id}`} className="text-violet-700">
                            {String(row.name)}
                          </Link>
                        </td>
                        <td className="p-2">{String(row.status)}</td>
                        <td className="p-2">
                          {spent} / {total} {String(row.currency ?? 'GBP')}
                        </td>
                        <td className="p-2 text-xs text-gray-600">
                          {row.contractStart ? new Date(String(row.contractStart)).toLocaleDateString() : '—'}{' '}
                          – {row.contractEnd ? new Date(String(row.contractEnd)).toLocaleDateString() : '—'}
                        </td>
                        <td className="p-2 space-x-2">
                          <Link href={`/admin/brand-partnerships/${id}`} className="text-violet-600">
                            View
                          </Link>
                          {row.status !== 'ARCHIVED' && (
                            <button type="button" className="text-amber-700" onClick={() => archive(id)}>
                              Archive
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
