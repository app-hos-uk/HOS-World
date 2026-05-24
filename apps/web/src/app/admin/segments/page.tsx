'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminSegmentsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('');

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListSegments({ status: status || undefined, limit: 100 })
      .then((r) => {
        const d = r.data as { items?: any[] };
        setRows(d?.items || []);
      })
      .catch((e: any) => toast.error(e?.message || 'Failed'))
      .finally(() => setLoading(false));
  }, [toast, status]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshOne = async (id: string) => {
    try {
      await apiClient.adminRefreshSegment(id);
      toast.success('Refreshed');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  const archiveOne = async (id: string) => {
    if (!confirm('Archive this segment and clear memberships?')) return;
    try {
      await apiClient.adminArchiveSegment(id);
      toast.success('Archived');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-white">Segments</h1>
            <Link
              href="/admin/segments/new"
              className="rounded-md bg-hos-gold px-4 py-2 text-white text-sm hover:bg-hos-gold/100"
            >
              Create segment
            </Link>
          </div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {['', 'ACTIVE', 'PAUSED', 'ARCHIVED'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full px-3 py-1 text-sm ${
                  status === s ? 'bg-hos-gold text-[#1a1406]' : 'bg-hos-bg-tertiary text-hos-text-secondary'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
          {loading ? (
            <p className="text-hos-text-muted">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-hos-bg-secondary text-left">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Members</th>
                    <th className="px-4 py-2">Last evaluated</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-t border-hos-border">
                      <td className="px-4 py-2 font-medium">
                        {s.name}
                        {s.isTemplate && (
                          <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Template
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{s.type}</td>
                      <td className="px-4 py-2">{s.status}</td>
                      <td className="px-4 py-2">{s.memberCount ?? 0}</td>
                      <td className="px-4 py-2">
                        {s.lastEvaluatedAt ? new Date(s.lastEvaluatedAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                        <Link href={`/admin/segments/${s.id}`} className="text-hos-gold hover:underline">
                          View
                        </Link>
                        <Link href={`/admin/segments/${s.id}/edit`} className="text-hos-gold hover:underline">
                          Edit
                        </Link>
                        {s.status !== 'ARCHIVED' && (
                          <>
                            <button
                              type="button"
                              className="text-hos-text-secondary hover:underline"
                              onClick={() => refreshOne(s.id)}
                            >
                              Refresh
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => archiveOne(s.id)}
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
