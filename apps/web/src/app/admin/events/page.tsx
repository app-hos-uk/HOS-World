'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
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

  const remove = async (id: string) => {
    if (!confirm('Delete this draft event? This cannot be undone.')) return;
    try {
      await apiClient.adminDeleteEvent(id);
      toast.success('Deleted');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  const cancel = async (id: string) => {
    if (!confirm('Cancel this event? RSVPs will be cancelled.')) return;
    try {
      await apiClient.adminCancelEvent(id);
      toast.success('Cancelled');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  const canCancel = (status: string) =>
    status === 'PUBLISHED' || status === 'SOLD_OUT' || status === 'ACTIVE';

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-hos-text-secondary">Events</h1>
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
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t border-hos-border">
                      <td className="px-4 py-2 font-medium">{e.title}</td>
                      <td className="px-4 py-2">{e.status}</td>
                      <td className="px-4 py-2">{new Date(e.startsAt).toLocaleString()}</td>
                      <td className="px-4 py-2">{e.store?.name ?? '—'}</td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end items-center gap-2">
                          <Link
                            href={`/admin/events/${e.id}`}
                            className="inline-flex min-w-[4.5rem] justify-center text-hos-gold hover:underline"
                          >
                            View
                          </Link>
                          <Link
                            href={`/admin/events/${e.id}/edit`}
                            className="inline-flex min-w-[4.5rem] justify-center text-hos-gold hover:underline"
                          >
                            Edit
                          </Link>
                          {e.status === 'DRAFT' && (
                            <>
                              <button
                                type="button"
                                onClick={() => publish(e.id)}
                                className="inline-flex min-w-[4.5rem] justify-center text-green-400 hover:underline"
                              >
                                Publish
                              </button>
                              <button
                                type="button"
                                onClick={() => remove(e.id)}
                                className="inline-flex min-w-[4.5rem] justify-center text-red-400 hover:underline"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {canCancel(e.status) && (
                            <button
                              type="button"
                              onClick={() => cancel(e.id)}
                              className="inline-flex min-w-[4.5rem] justify-center text-amber-400 hover:underline"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
