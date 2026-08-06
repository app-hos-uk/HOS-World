'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminBrandCampaignDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'POINTS_MULTIPLIER',
    startsAt: '',
    endsAt: '',
    multiplier: 0,
    bonusPoints: 0,
    maxPointsPerUser: 0,
    totalPointsBudget: 0,
    notifyOnStart: false,
  });

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetBrandCampaign(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));
    apiClient
      .adminGetBrandCampaignReport(id)
      .then((r) => setReport((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Failed to load report'),
      );
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
        multiplier: Number(row.multiplier ?? 0),
        bonusPoints: Number(row.bonusPoints ?? 0),
        maxPointsPerUser: Number(row.maxPointsPerUser ?? 0),
        totalPointsBudget: Number(row.totalPointsBudget ?? 0),
        notifyOnStart: Boolean(row.notifyOnStart),
      });
    }
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.adminUpdateBrandCampaign(id, {
        ...form,
        multiplier: Number(form.multiplier),
        bonusPoints: Number(form.bonusPoints),
        maxPointsPerUser: Number(form.maxPointsPerUser),
        totalPointsBudget: Number(form.totalPointsBudget),
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

  const p = row?.partnership as Record<string, unknown> | undefined;

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Link href="/admin/brand-partnerships/campaigns" className="text-sm text-violet-400">
            ← Campaigns
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-semibold text-hos-text-secondary">{String(row.name)}</h1>
                  <p className="text-sm text-hos-text-muted">
                    {String(row.type)} · {String(row.status)}
                    {p?.name ? ` · ${String(p.name)}` : ''}
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
                  {row.status === 'DRAFT' || row.status === 'SCHEDULED' ? (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-emerald-600 text-white"
                      onClick={() => act(() => apiClient.adminActivateBrandCampaign(id), 'Activated')}
                    >
                      Activate
                    </button>
                  ) : null}
                  {row.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-amber-600 text-white"
                      onClick={() => act(() => apiClient.adminPauseBrandCampaign(id), 'Paused')}
                    >
                      Pause
                    </button>
                  ) : null}
                  {row.status !== 'COMPLETED' && row.status !== 'CANCELLED' ? (
                    <>
                      <button
                        type="button"
                        className="text-sm px-2 py-1 rounded bg-hos-surface text-hos-text-secondary"
                        onClick={() => act(() => apiClient.adminCompleteBrandCampaign(id), 'Completed')}
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        className="text-sm px-2 py-1 rounded border border-gray-400"
                        onClick={() => act(() => apiClient.adminCancelBrandCampaign(id), 'Cancelled')}
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
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
                      <span className="text-xs text-hos-text-muted">Multiplier</span>
                      <input type="number" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Bonus Points</span>
                      <input type="number" value={form.bonusPoints} onChange={(e) => setForm({ ...form, bonusPoints: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Max Points Per User</span>
                      <input type="number" value={form.maxPointsPerUser} onChange={(e) => setForm({ ...form, maxPointsPerUser: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Total Points Budget</span>
                      <input type="number" value={form.totalPointsBudget} onChange={(e) => setForm({ ...form, totalPointsBudget: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="flex items-center gap-2 pt-5">
                      <input type="checkbox" checked={form.notifyOnStart} onChange={(e) => setForm({ ...form, notifyOnStart: e.target.checked })} className="rounded border-hos-border" />
                      <span className="text-sm text-hos-text-secondary">Notify on Start</span>
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

              <div className="border rounded-lg p-4 bg-hos-bg-secondary text-xs overflow-auto">
                <pre>{JSON.stringify(row, null, 2)}</pre>
              </div>
              {report && (
                <div className="border rounded-lg p-4 bg-hos-bg-secondary text-sm">
                  <p className="font-medium mb-2">Report</p>
                  <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(report, null, 2)}</pre>
                </div>
              )}
            </>
          ) : (
            <p className="text-hos-text-muted">Loading…</p>
          )}
        </div>
          </RouteGuard>
  );
}
