'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDateTime } from '@/hooks/useDateTime';

export default function AdminEventsPage() {
  const { formatDateTime } = useDateTime();
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

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

  const remove = (id: string) => {
    setConfirmDialog({
      title: 'Delete this draft event?',
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.adminDeleteEvent(id);
          toast.success('Deleted');
          load();
        } catch (e: any) {
          toast.error(e?.message || 'Failed');
        }
      },
    });
  };

  const cancel = (id: string) => {
    setConfirmDialog({
      title: 'Cancel this event?',
      description: 'RSVPs will be cancelled.',
      tone: 'danger',
      confirmLabel: 'Cancel event',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.adminCancelEvent(id);
          toast.success('Cancelled');
          load();
        } catch (e: any) {
          toast.error(e?.message || 'Failed');
        }
      },
    });
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
                    <th className="w-[24rem] px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t border-hos-border">
                      <td className="px-4 py-2 font-medium">{e.title}</td>
                      <td className="px-4 py-2">{e.status}</td>
                      <td className="px-4 py-2">{formatDateTime(e.startsAt)}</td>
                      <td className="px-4 py-2">{e.store?.name ?? '—'}</td>
                      <td className="w-[24rem] px-4 py-2 align-middle">
                        {/* Fixed slot per action keeps the columns aligned regardless of
                            which actions a given status makes available. */}
                        <div className="ml-auto grid w-fit grid-cols-4 items-center gap-2">
                          <Link
                            href={`/admin/events/${e.id}`}
                            className="inline-flex h-8 w-[5rem] items-center justify-center rounded-md border border-hos-border text-hos-gold hover:bg-hos-gold/10"
                          >
                            View
                          </Link>
                          <Link
                            href={`/admin/events/${e.id}/edit`}
                            className="inline-flex h-8 w-[5rem] items-center justify-center rounded-md border border-hos-border text-hos-gold hover:bg-hos-gold/10"
                          >
                            Edit
                          </Link>
                          {e.status === 'DRAFT' ? (
                            <button
                              type="button"
                              onClick={() => publish(e.id)}
                              className="inline-flex h-8 w-[5rem] items-center justify-center rounded-md border border-hos-border text-green-400 hover:bg-green-500/10"
                            >
                              Publish
                            </button>
                          ) : canCancel(e.status) ? (
                            <button
                              type="button"
                              onClick={() => cancel(e.id)}
                              className="inline-flex h-8 w-[5rem] items-center justify-center rounded-md border border-hos-border text-amber-400 hover:bg-amber-500/10"
                            >
                              Cancel
                            </button>
                          ) : (
                            <span aria-hidden="true" className="inline-block h-8 w-[5rem]" />
                          )}
                          <button
                            type="button"
                            onClick={() => remove(e.id)}
                            disabled={e.status !== 'DRAFT'}
                            title={
                              e.status !== 'DRAFT'
                                ? 'Only draft events can be deleted'
                                : undefined
                            }
                            className="inline-flex h-8 w-[5rem] items-center justify-center rounded-md border border-hos-border text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {confirmDialog && (
          <ConfirmDialog
            open
            title={confirmDialog.title}
            description={confirmDialog.description}
            tone={confirmDialog.tone}
            confirmLabel={confirmDialog.confirmLabel}
            onCancel={() => setConfirmDialog(null)}
            onConfirm={confirmDialog.onConfirm}
          />
        )}
          </RouteGuard>
  );
}
