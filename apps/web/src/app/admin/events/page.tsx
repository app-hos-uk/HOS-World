'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminEventsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListEvents({ limit: 100 })
      .then((r) => {
        const d = r.data as { items?: any[] };
        setRows(d?.items || []);
      })
      .catch((e: any) => toast.error(e?.message || 'Failed'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async (id: string) => {
    try {
      await apiClient.adminPublishEvent(id);
      toast.success('Published');
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
            <h1 className="text-2xl font-semibold text-white">Events</h1>
            <Link
              href="/admin/events/new"
              className="rounded-md bg-hos-gold px-4 py-2 text-white text-sm hover:bg-hos-gold/100"
            >
              New event
            </Link>
          </div>
          {loading ? (
            <p className="text-hos-text-muted">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-hos-bg-secondary text-left">
                  <tr>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Starts</th>
                    <th className="px-4 py-2">Store</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t border-hos-border">
                      <td className="px-4 py-2 font-medium">{e.title}</td>
                      <td className="px-4 py-2">{e.status}</td>
                      <td className="px-4 py-2">{new Date(e.startsAt).toLocaleString()}</td>
                      <td className="px-4 py-2">{e.store?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <Link href={`/admin/events/${e.id}`} className="text-hos-gold hover:underline">
                          View
                        </Link>
                        {e.status === 'DRAFT' && (
                          <button
                            type="button"
                            onClick={() => publish(e.id)}
                            className="text-green-600 hover:underline"
                          >
                            Publish
                          </button>
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
