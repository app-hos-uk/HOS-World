'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDateTime } from '@/hooks/useDateTime';
import { TrackedLinkForm } from '../TrackedLinkForm';
import {
  FIELD_CLASS,
  PRIMARY_BTN,
  SECONDARY_BTN,
  StatusBadge,
  asList,
  asRecord,
  extractListPayload,
  num,
  str,
} from '../_shared';

type BrandPartnershipOption = { id: string; name: string };

export default function AdminPartnerReferralDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const { formatDate } = useDateTime();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [links, setLinks] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [brandPartnerships, setBrandPartnerships] = useState<BrandPartnershipOption[]>([]);
  const [loadingBPs, setLoadingBPs] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'EXTERNAL',
    status: 'ACTIVE',
    contactName: '',
    contactEmail: '',
    description: '',
    logoUrl: '',
    brandPartnershipId: '',
    contractStart: '',
    contractEnd: '',
  });

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      apiClient.adminGetPartnerReferral(id),
      apiClient.adminListPartnerReferralLinks(id).catch(() => null),
    ])
      .then(([partnerRes, linksRes]) => {
        const partner = asRecord(partnerRes.data) ?? null;
        setRow(partner);
        const listed = linksRes ? extractListPayload(linksRes).items : [];
        if (listed.length) {
          setLinks(listed);
        } else {
          setLinks(partner ? asList(partner.links) : []);
        }
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!editing || form.type !== 'BRAND_PARTNER') return;
    let cancelled = false;
    setLoadingBPs(true);
    apiClient
      .adminListBrandPartnerships({ limit: 200 })
      .then((r) => {
        if (cancelled) return;
        const items = Array.isArray(r.data) ? r.data : (r.data as Record<string, unknown>)?.items;
        const list = (Array.isArray(items) ? items : []).map((bp: Record<string, unknown>) => ({
          id: String(bp.id ?? ''),
          name: String(bp.name ?? bp.brandName ?? bp.id ?? ''),
        })).filter((bp: BrandPartnershipOption) => bp.id);
        setBrandPartnerships(list);
      })
      .catch(() => { if (!cancelled) setBrandPartnerships([]); })
      .finally(() => setLoadingBPs(false));
    return () => { cancelled = true; };
  }, [editing, form.type]);

  const openEdit = () => {
    if (!row) return;
    setForm({
      name: String(row.name ?? ''),
      type: String(row.type ?? 'EXTERNAL'),
      status: String(row.status ?? 'ACTIVE'),
      contactName: String(row.contactName ?? ''),
      contactEmail: String(row.contactEmail ?? ''),
      description: String(row.description ?? ''),
      logoUrl: String(row.logoUrl ?? ''),
      brandPartnershipId: String(row.brandPartnershipId ?? ''),
      contractStart: row.contractStart ? String(row.contractStart).slice(0, 10) : '',
      contractEnd: row.contractEnd ? String(row.contractEnd).slice(0, 10) : '',
    });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.adminUpdatePartnerReferral(id, {
        ...form,
        brandPartnershipId: form.type === 'BRAND_PARTNER' ? form.brandPartnershipId || undefined : undefined,
        contractStart: form.contractStart ? new Date(form.contractStart).toISOString() : undefined,
        contractEnd: form.contractEnd ? new Date(form.contractEnd).toISOString() : undefined,
      });
      toast.success('Partner updated');
      setEditing(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    setArchiving(true);
    try {
      await apiClient.adminArchivePartnerReferral(id);
      toast.success('Partner archived');
      setArchiveOpen(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to archive');
    } finally {
      setArchiving(false);
    }
  };

  const createLink = async (body: Record<string, unknown>) => {
    setCreatingLink(true);
    try {
      await apiClient.adminCreatePartnerReferralLink(id, body);
      toast.success('Tracked link created');
      setShowLinkForm(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setCreatingLink(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-5xl mx-auto text-stone-100 space-y-6">
        <Link href="/admin/partner-referrals" className="text-sm text-amber-200 font-secondary hover:text-amber-100">
          ← All partners
        </Link>

        {row ? (
          <>
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <h1 className="font-primary text-2xl text-amber-100">{str(row.name)}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2 font-secondary text-sm text-stone-400">
                  <StatusBadge status={String(row.status ?? '')} />
                  <span>{str(row.type)}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={openEdit} className={SECONDARY_BTN}>
                  {editing ? 'Edit open' : 'Edit'}
                </button>
                {row.status !== 'ARCHIVED' && (
                  <button type="button" onClick={() => setArchiveOpen(true)} className={SECONDARY_BTN}>
                    Archive
                  </button>
                )}
              </div>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-lg p-6 font-secondary text-sm space-y-2">
              <p>
                <span className="text-stone-400">Contact:</span>{' '}
                {str(row.contactName, '')}
                {row.contactName && row.contactEmail ? ' · ' : ''}
                {str(row.contactEmail, row.contactName ? '' : '—')}
              </p>
              <p>
                <span className="text-stone-400">Contract:</span>{' '}
                {row.contractStart ? formatDate(String(row.contractStart)) : '—'} –{' '}
                {row.contractEnd ? formatDate(String(row.contractEnd)) : '—'}
              </p>
              {row.description ? <p className="text-stone-300">{String(row.description)}</p> : null}
            </div>

            {editing && (
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-6 space-y-4">
                <h2 className="font-primary text-lg text-amber-100">Edit Partner</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="block text-sm font-secondary">
                    <span className="text-stone-300">Name</span>
                    <input className={FIELD_CLASS} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                    <label className="block text-sm font-secondary">
                      <span className="text-stone-300">Type</span>
                      <select className={FIELD_CLASS} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                        <option value="EXTERNAL">EXTERNAL</option>
                        <option value="BRAND_PARTNER">BRAND_PARTNER</option>
                      </select>
                    </label>
                    {form.type === 'BRAND_PARTNER' && (
                      <label className="block text-sm font-secondary">
                        <span className="text-stone-300">Brand Partnership</span>
                        {loadingBPs ? (
                          <p className="text-xs text-stone-500 mt-1">Loading brand partnerships…</p>
                        ) : brandPartnerships.length === 0 ? (
                          <p className="text-xs text-stone-500 mt-1">No brand partnerships found.</p>
                        ) : (
                          <select
                            className={FIELD_CLASS}
                            value={form.brandPartnershipId}
                            onChange={(e) => setForm({ ...form, brandPartnershipId: e.target.value })}
                          >
                            <option value="">Select a brand partnership…</option>
                            {brandPartnerships.map((bp) => (
                              <option key={bp.id} value={bp.id}>{bp.name}</option>
                            ))}
                          </select>
                        )}
                      </label>
                    )}
                  <label className="block text-sm font-secondary">
                    <span className="text-stone-300">Status</span>
                    <select className={FIELD_CLASS} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {['ACTIVE', 'PAUSED', 'ARCHIVED', 'EXPIRED'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-secondary">
                    <span className="text-stone-300">Logo URL</span>
                    <input className={FIELD_CLASS} value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} />
                  </label>
                  <label className="block text-sm font-secondary">
                    <span className="text-stone-300">Contact name</span>
                    <input className={FIELD_CLASS} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
                  </label>
                  <label className="block text-sm font-secondary">
                    <span className="text-stone-300">Contact email</span>
                    <input type="email" className={FIELD_CLASS} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
                  </label>
                  <label className="block text-sm font-secondary sm:col-span-2">
                    <span className="text-stone-300">Description</span>
                    <textarea className={FIELD_CLASS} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </label>
                  <label className="block text-sm font-secondary">
                    <span className="text-stone-300">Contract start</span>
                    <input type="date" className={FIELD_CLASS} value={form.contractStart} onChange={(e) => setForm({ ...form, contractStart: e.target.value })} />
                  </label>
                  <label className="block text-sm font-secondary">
                    <span className="text-stone-300">Contract end</span>
                    <input type="date" className={FIELD_CLASS} value={form.contractEnd} onChange={(e) => setForm({ ...form, contractEnd: e.target.value })} />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={saving} onClick={() => void handleSave()} className={PRIMARY_BTN}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setEditing(false)} className={SECONDARY_BTN}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center gap-2">
              <h2 className="font-primary text-lg text-amber-100">Tracked links</h2>
              <div className="flex gap-2">
                <Link href={`/admin/partner-referrals/${id}/links/new`} className={SECONDARY_BTN}>
                  Full form
                </Link>
                <button type="button" className={PRIMARY_BTN} onClick={() => setShowLinkForm((v) => !v)}>
                  {showLinkForm ? 'Close form' : 'Create New Link'}
                </button>
              </div>
            </div>

            {showLinkForm && (
              <TrackedLinkForm
                submitting={creatingLink}
                onSubmit={(body) => void createLink(body)}
                onCancel={() => setShowLinkForm(false)}
              />
            )}

            <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-x-auto">
              <table className="min-w-full text-sm font-secondary divide-y divide-stone-800">
                <thead>
                  <tr className="text-stone-400 text-xs uppercase">
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Code</th>
                    <th className="text-left p-3">UTM Source</th>
                    <th className="text-left p-3">Registrations</th>
                    <th className="text-left p-3">Conversions</th>
                    <th className="text-left p-3">Active</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {links.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-stone-500">
                        No tracked links yet.
                      </td>
                    </tr>
                  ) : (
                    links.map((link) => {
                      const linkId = String(link.id);
                      return (
                        <tr key={linkId}>
                          <td className="p-3">{str(link.name)}</td>
                          <td className="p-3 font-mono text-xs">{str(link.code)}</td>
                          <td className="p-3">{str(link.utmSource)}</td>
                          <td className="p-3">{num(link.totalRegistrations ?? link.registrations)}</td>
                          <td className="p-3">{num(link.totalConversions ?? link.conversions)}</td>
                          <td className="p-3">{link.isActive === false ? 'No' : 'Yes'}</td>
                          <td className="p-3">
                            <Link href={`/admin/partner-referrals/links/${linkId}`} className="text-amber-200 hover:text-amber-100">
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="font-secondary text-stone-400">Loading…</p>
        )}
      </div>

      <ConfirmDialog
        open={archiveOpen}
        title="Archive this partner?"
        description="The partner will be marked archived and should no longer be used for new campaigns."
        tone="danger"
        confirmLabel="Archive"
        busy={archiving}
        onConfirm={() => {
          void archive();
        }}
        onCancel={() => setArchiveOpen(false)}
      />
    </RouteGuard>
  );
}
