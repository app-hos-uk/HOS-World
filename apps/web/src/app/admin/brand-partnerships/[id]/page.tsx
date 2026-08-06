'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminBrandPartnershipDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    contactEmail: '',
    logoUrl: '',
    description: '',
    status: 'DRAFT',
    contractStart: '',
    contractEnd: '',
    totalBudget: 0,
    currency: 'GBP',
  });

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetBrandPartnership(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));
    apiClient
      .adminGetBrandPartnershipReport(id)
      .then((r) => setReport((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Failed to load report'),
      );
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = () => {
    if (row) {
      setForm({
        name: String(row.name ?? ''),
        contactName: String(row.contactName ?? ''),
        contactEmail: String(row.contactEmail ?? ''),
        logoUrl: String(row.logoUrl ?? ''),
        description: String(row.description ?? ''),
        status: String(row.status ?? 'DRAFT'),
        contractStart: row.contractStart ? String(row.contractStart).slice(0, 10) : '',
        contractEnd: row.contractEnd ? String(row.contractEnd).slice(0, 10) : '',
        totalBudget: Number(row.totalBudget ?? 0),
        currency: String(row.currency ?? 'GBP'),
      });
    }
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.adminUpdateBrandPartnership(id, {
        ...form,
        totalBudget: Number(form.totalBudget),
        contractStart: form.contractStart || undefined,
        contractEnd: form.contractEnd || undefined,
      });
      toast.success('Partnership updated');
      setEditing(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const campaigns = (row?.campaigns as Record<string, unknown>[]) ?? [];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-5xl mx-auto space-y-6">
          <Link href="/admin/brand-partnerships" className="text-sm text-violet-400">
            ← All partners
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-semibold text-hos-text-secondary">{String(row.name)}</h1>
                  <p className="text-sm text-hos-text-muted">
                    {String(row.status)} · {String(row.slug)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={openEdit}
                    className="rounded-md border border-hos-border px-3 py-2 text-hos-text-secondary text-sm"
                  >
                    Edit
                  </button>
                  <Link
                    href={`/admin/brand-partnerships/${id}/campaigns/new`}
                    className="rounded-md bg-violet-700 px-3 py-2 text-white text-sm"
                  >
                    New campaign
                  </Link>
                </div>
              </div>

              {editing && (
                <div className="border border-hos-border rounded-lg p-4 bg-hos-bg-secondary space-y-4">
                  <h2 className="text-lg font-medium text-hos-text-secondary">Edit Partnership</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Name</span>
                      <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Contact Name</span>
                      <input type="text" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Contact Email</span>
                      <input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Logo URL</span>
                      <input type="text" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="text-xs text-hos-text-muted">Description</span>
                      <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Status</span>
                      <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary">
                        {['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Currency</span>
                      <input type="text" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Contract Start</span>
                      <input type="date" value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Contract End</span>
                      <input type="date" value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-hos-text-muted">Total Budget</span>
                      <input type="number" value={form.totalBudget} onChange={(e) => setForm({ ...form, totalBudget: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary" />
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

              <div className="border rounded-lg p-4 bg-hos-bg-secondary text-sm">
                <p className="font-medium mb-2">Budget</p>
                <p>
                  Spent {String(row.spentBudget)} / {String(row.totalBudget)} {String(row.currency)}
                </p>
              </div>
              {report && (
                <div className="border rounded-lg p-4 bg-hos-bg-secondary text-sm">
                  <p className="font-medium mb-3">Report Snapshot</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-hos-gold/10 rounded-lg p-3">
                      <p className="text-xs text-hos-text-muted">Total Campaigns</p>
                      <p className="text-xl font-semibold text-hos-gold-hover">
                        {Number(report.totalCampaigns ?? report.campaignCount ?? 0)}
                      </p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3">
                      <p className="text-xs text-hos-text-muted">Total Revenue</p>
                      <p className="text-xl font-semibold text-green-400">
                        ${Number(report.totalRevenue ?? report.revenue ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-hos-gold/10 rounded-lg p-3">
                      <p className="text-xs text-hos-text-muted">Total Orders</p>
                      <p className="text-xl font-semibold text-hos-gold">
                        {Number(report.totalOrders ?? report.orders ?? 0)}
                      </p>
                    </div>
                    <div className="bg-amber-500/10 rounded-lg p-3">
                      <p className="text-xs text-hos-text-muted">Conversion Rate</p>
                      <p className="text-xl font-semibold text-amber-400">
                        {Number(report.conversionRate ?? 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {(report.impressions != null || report.clicks != null) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      {report.impressions != null && (
                        <div className="bg-hos-bg-secondary rounded-lg p-3">
                          <p className="text-xs text-hos-text-muted">Impressions</p>
                          <p className="text-lg font-semibold text-hos-text-secondary">
                            {Number(report.impressions).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {report.clicks != null && (
                        <div className="bg-hos-bg-secondary rounded-lg p-3">
                          <p className="text-xs text-hos-text-muted">Clicks</p>
                          <p className="text-lg font-semibold text-hos-text-secondary">
                            {Number(report.clicks).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {report.ctr != null && (
                        <div className="bg-hos-bg-secondary rounded-lg p-3">
                          <p className="text-xs text-hos-text-muted">CTR</p>
                          <p className="text-lg font-semibold text-hos-text-secondary">
                            {Number(report.ctr).toFixed(2)}%
                          </p>
                        </div>
                      )}
                      {report.avgOrderValue != null && (
                        <div className="bg-hos-bg-secondary rounded-lg p-3">
                          <p className="text-xs text-hos-text-muted">Avg Order Value</p>
                          <p className="text-lg font-semibold text-hos-text-secondary">
                            ${Number(report.avgOrderValue).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div>
                <h2 className="text-lg font-medium mb-2">Campaigns</h2>
                <ul className="space-y-2">
                  {campaigns.map((c) => (
                    <li key={String(c.id)} className="border rounded p-2 bg-hos-bg-secondary flex justify-between">
                      <span>{String(c.name)}</span>
                      <span className="text-hos-text-muted text-xs">{String(c.status)}</span>
                      <Link
                        href={`/admin/brand-partnerships/campaigns/${String(c.id)}`}
                        className="text-violet-400 text-sm"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-hos-text-muted">Loading…</p>
          )}
        </div>
          </RouteGuard>
  );
}
