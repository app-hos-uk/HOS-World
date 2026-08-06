'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminProductCampaignDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'POINTS_MULTIPLIER',
    startsAt: '',
    endsAt: '',
    bonusPoints: 0,
    minTierLevel: 0,
    maxRedemptions: 0,
    applyToAllProducts: false,
  });

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetProductCampaign(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const openEdit = () => {
    if (row) {
      const toLocal = (v: unknown) => {
        if (!v) return '';
        const d = new Date(String(v));
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setForm({
        name: String(row.name ?? ''),
        description: String(row.description ?? ''),
        type: String(row.type ?? 'POINTS_MULTIPLIER'),
        startsAt: toLocal(row.startsAt),
        endsAt: toLocal(row.endsAt),
        bonusPoints: Number(row.bonusPoints ?? 0),
        minTierLevel: Number(row.minTierLevel ?? 0),
        maxRedemptions: Number(row.maxRedemptions ?? 0),
        applyToAllProducts: Boolean(row.applyToAllProducts),
      });
    }
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.adminUpdateProductCampaign(id, {
        ...form,
        bonusPoints: Number(form.bonusPoints),
        minTierLevel: Number(form.minTierLevel),
        maxRedemptions: Number(form.maxRedemptions),
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      });
      toast.success('Campaign updated');
      setEditing(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const st = row ? String(row.status) : '';

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-3xl mx-auto space-y-4">
          <Link href="/admin/product-campaigns" className="text-sm text-violet-400">
            ← Campaigns
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-semibold text-hos-text-secondary">{String(row.name)}</h1>
                  <p className="text-sm text-hos-text-muted">
                    {String(row.type)} · {st}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={openEdit}
                    className="text-sm px-2 py-1 rounded border border-hos-border text-hos-text-secondary"
                  >
                    Edit
                  </button>
                  {st === 'DRAFT' && (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-emerald-600 text-white"
                      onClick={() => act(() => apiClient.adminActivateProductCampaign(id), 'Activated')}
                    >
                      Activate
                    </button>
                  )}
                  {st === 'ACTIVE' && (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-hos-surface text-hos-text-secondary"
                      onClick={() => act(() => apiClient.adminCompleteProductCampaign(id), 'Completed')}
                    >
                      Complete
                    </button>
                  )}
                  {st !== 'COMPLETED' && st !== 'CANCELLED' && (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded border border-gray-400"
                      onClick={() => act(() => apiClient.adminCancelProductCampaign(id), 'Cancelled')}
                    >
                      Cancel
                    </button>
                  )}
                  {(st === 'DRAFT' || st === 'CANCELLED') && (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded border border-red-500/40 text-red-400"
                      onClick={() => {
                        setConfirmDialog({
                          title: 'Delete this campaign?',
                          description: 'This cannot be undone.',
                          tone: 'danger',
                          confirmLabel: 'Delete',
                          onConfirm: async () => {
                            setConfirmDialog(null);
                            try {
                              await apiClient.adminDeleteProductCampaign(id);
                              toast.success('Deleted');
                              router.push('/admin/product-campaigns');
                            } catch (e: unknown) {
                              toast.error(e instanceof Error ? e.message : 'Failed');
                            }
                          },
                        });
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {editing && (
                <div className="border border-hos-border rounded-lg p-4 bg-hos-bg-secondary space-y-4">
                  <h2 className="text-lg font-medium text-hos-text-secondary">Edit Campaign</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Name</span>
                      <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Type</span>
                      <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary">
                        {['POINTS_MULTIPLIER', 'BONUS_POINTS', 'EXCLUSIVE_ACCESS', 'FEATURED_PLACEMENT'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs text-hos-text-muted">Description</span>
                      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Starts At</span>
                      <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Ends At</span>
                      <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Bonus Points</span>
                      <input type="number" value={form.bonusPoints} onChange={(e) => setForm({ ...form, bonusPoints: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Min Tier Level</span>
                      <input type="number" value={form.minTierLevel} onChange={(e) => setForm({ ...form, minTierLevel: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Max Redemptions</span>
                      <input type="number" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="flex items-center gap-2 pt-5">
                      <input type="checkbox" checked={form.applyToAllProducts} onChange={(e) => setForm({ ...form, applyToAllProducts: e.target.checked })} className="rounded border-hos-border" />
                      <span className="text-sm text-hos-text-secondary">Apply to All Products</span>
                    </label>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" disabled={saving} onClick={handleSave} className="rounded-md bg-hos-gold px-4 py-2 text-sm font-medium text-black disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-hos-border px-4 py-2 text-sm text-hos-text-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <pre className="text-xs overflow-auto border rounded-lg p-4 bg-hos-bg-secondary max-h-96">
                {JSON.stringify(row, null, 2)}
              </pre>
            </>
          ) : (
            <p className="text-hos-text-muted">Loading…</p>
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
