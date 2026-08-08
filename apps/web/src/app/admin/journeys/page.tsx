'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminJourneysPage() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
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
      .adminListJourneys()
      .then((r) => setRows((r.data as any[]) || []))
      .catch((e: any) => setErr(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = (id: string, activate: boolean) => {
    const action = activate ? 'Activate' : 'Deactivate';
    setConfirmDialog({
      title: `${action} this journey?`,
      tone: activate ? 'default' : 'danger',
      confirmLabel: action,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.adminUpdateJourney(id, { isActive: activate });
          toast.success(`Journey ${activate ? 'activated' : 'deactivated'}`);
          load();
        } catch (e: any) {
          toast.error(e?.message || 'Failed');
        }
      },
    });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmDialog({
      title: `Delete journey "${name}"?`,
      description: 'This cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.adminDeleteJourney(id);
          toast.success('Journey deleted');
          load();
        } catch (e: any) {
          toast.error(e?.message || 'Failed to delete journey');
        }
      },
    });
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-hos-text-secondary">Marketing journeys</h1>
            <Link
              href="/admin/journeys/new"
              className="rounded-md bg-hos-gold px-4 py-2 text-white text-sm hover:bg-hos-gold/100"
            >
              New journey
            </Link>
          </div>
          {err && <p className="text-red-400 mb-4">{err}</p>}
          {loading ? (
            <p className="text-hos-text-muted">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-hos-bg-secondary text-left">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Slug</th>
                    <th className="px-4 py-2">Trigger</th>
                    <th className="px-4 py-2">Active</th>
                    <th className="px-4 py-2">Enrollments</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => (
                    <tr key={j.id} className="border-t border-hos-border">
                      <td className="px-4 py-2 font-medium">{j.name}</td>
                      <td className="px-4 py-2 text-hos-text-secondary">{j.slug}</td>
                      <td className="px-4 py-2">{j.triggerEvent}</td>
                      <td className="px-4 py-2">{j.isActive ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-2">{j._count?.enrollments ?? '—'}</td>
                      <td className="px-4 py-2">
                        {/* Fixed-width slots keep every row's actions in the same columns,
                            even when Delete is only available for inactive journeys. */}
                        <div className="ml-auto grid w-fit grid-cols-[4.5rem_5.5rem_4.5rem] items-center gap-2 text-center">
                          <Link
                            href={`/admin/journeys/${j.id}`}
                            className="text-hos-gold hover:underline"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            className={`hover:underline ${
                              j.isActive ? 'text-amber-400' : 'text-green-400'
                            }`}
                            onClick={() => toggleActive(j.id, !j.isActive)}
                          >
                            {j.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          {j.isActive ? (
                            <span aria-hidden="true" />
                          ) : (
                            <button
                              type="button"
                              className="text-red-400 hover:underline"
                              onClick={() => handleDelete(j.id, j.name)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="p-6 text-hos-text-muted">No journeys yet. Run db:seed-journeys or create one.</p>}
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
