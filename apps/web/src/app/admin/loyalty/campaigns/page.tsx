'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import {
  isDateInputInPast,
  normalizeWhitespace,
  nowDateTimeLocalValue,
  validateNameLike,
  validateOptionalDescriptiveText,
} from '@/lib/formFieldValidation';
import { useDateTime } from '@/hooks/useDateTime';

export default function AdminLoyaltyCampaignsPage() {
  const { formatDate } = useDateTime();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stores, setStores] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'MULTIPLIER',
    multiplier: 2,
    startsAt: '',
    endsAt: '',
    isActive: true,
    storeIds: [] as string[],
    threshold: 0,
    earnRate: 0,
    pointsPerDollar: 0,
  });
  const [defaults, setDefaults] = useState({ threshold: 85, earnRate: 0.2, pointsPerDollar: 100 });
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; description?: string; startsAt?: string; endsAt?: string }>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyCampaigns();
      if (res?.data) setCampaigns(res.data as any[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setStoresLoading(true);
    apiClient
      .adminListStores()
      .then((r) => {
        const d = r.data as Array<{ id: string; name: string; code?: string }> | undefined;
        setStores(Array.isArray(d) ? d : []);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load stores');
      })
      .finally(() => setStoresLoading(false));

    apiClient
      .adminGetLoyaltySettings()
      .then((r) => {
        const payload = r.data as { settings?: { campaignMinPurchaseThreshold?: number; campaignBonusEarnRate?: number; campaignBonusPointsPerDollar?: number } };
        if (payload?.settings) {
          setDefaults({
            threshold: Number(payload.settings.campaignMinPurchaseThreshold || 0),
            earnRate: Number(payload.settings.campaignBonusEarnRate || 0),
            pointsPerDollar: Number(payload.settings.campaignBonusPointsPerDollar || 0),
          });
        }
      })
      .catch(() => {});
  }, [toast]);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      type: 'MULTIPLIER',
      multiplier: 2,
      startsAt: '',
      endsAt: '',
      isActive: true,
      storeIds: [],
      threshold: defaults.threshold,
      earnRate: defaults.earnRate,
      pointsPerDollar: defaults.pointsPerDollar,
    });
    setFieldErrors({});
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (c: any) => {
    setEditing(c);
    const cond = (c.conditions && typeof c.conditions === 'object' ? c.conditions : {}) as {
      threshold?: number;
      earnRate?: number;
      pointsPerDollar?: number;
    };
    setForm({
      name: c.name || '',
      description: c.description || '',
      type: c.type || 'MULTIPLIER',
      multiplier: c.multiplier || 2,
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : '',
      endsAt: c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 16) : '',
      isActive: c.isActive ?? true,
      storeIds: Array.isArray(c.storeIds) ? c.storeIds : [],
      threshold: Number(cond.threshold ?? defaults.threshold),
      earnRate: Number(cond.earnRate ?? defaults.earnRate),
      pointsPerDollar: Number(cond.pointsPerDollar ?? defaults.pointsPerDollar),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const name = normalizeWhitespace(form.name);
    const description = normalizeWhitespace(form.description);
    const nameErr = validateNameLike(name, 'Campaign name');
    const descriptionErr = validateOptionalDescriptiveText(description, 'Description');
    let startsAtErr: string | null = null;
    let endsAtErr: string | null = null;
    if (!form.startsAt) startsAtErr = 'Start date is required';
    else if (!editing && isDateInputInPast(form.startsAt)) startsAtErr = 'Start date cannot be in the past';
    if (!form.endsAt) endsAtErr = 'End date is required';
    else if (!editing && isDateInputInPast(form.endsAt)) endsAtErr = 'End date cannot be in the past';
    else if (form.startsAt && form.endsAt && form.endsAt < form.startsAt) {
      endsAtErr = 'End date must be after start date';
    }
    setFieldErrors({
      name: nameErr || undefined,
      description: descriptionErr || undefined,
      startsAt: startsAtErr || undefined,
      endsAt: endsAtErr || undefined,
    });
    if (nameErr || descriptionErr || startsAtErr || endsAtErr) {
      toast.error(nameErr || descriptionErr || startsAtErr || endsAtErr || 'Please fix the form fields');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        description: description || undefined,
        type: form.type || 'MULTIPLIER',
        multiplier: form.multiplier,
        isActive: form.isActive,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        storeIds: form.storeIds,
      };
      if (form.type === 'PERCENTAGE_OF_QUALIFYING') {
        payload.conditions = {
          threshold: form.threshold,
          earnRate: form.earnRate,
          pointsPerDollar: form.pointsPerDollar,
          minPurchaseToRedeem: form.threshold,
        };
      }
      if (editing) {
        await apiClient.adminUpdateLoyaltyCampaign(editing.id, payload);
        toast.success('Campaign updated');
      } else {
        await apiClient.adminCreateLoyaltyCampaign(payload);
        toast.success('Campaign created');
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      title: 'Delete this campaign?',
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.adminDeleteLoyaltyCampaign(id);
          toast.success('Campaign deleted');
          await load();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete');
        }
      },
    });
  };

  const getStatus = (c: any) => {
    const now = new Date();
    if (!c.isActive) return { label: 'Inactive', cls: 'bg-hos-bg-tertiary text-hos-text-secondary' };
    if (c.endsAt && new Date(c.endsAt) < now) return { label: 'Ended', cls: 'bg-red-500/15 text-red-400' };
    if (c.startsAt && new Date(c.startsAt) > now) return { label: 'Scheduled', cls: 'bg-hos-gold/20 text-hos-gold' };
    return { label: 'Active', cls: 'bg-green-500/15 text-green-400' };
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
              <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Bonus Campaigns</h1>
            <p className="text-hos-text-secondary mt-1">Create double-points and multiplier campaigns</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm font-medium">
            + New Campaign
          </button>
        </div>

        {showForm && (
          <div className="bg-hos-bg-secondary border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Campaign' : 'New Campaign'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Name</label>
                <input className={`w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none ${fieldErrors.name ? 'border-red-500' : 'border-hos-border'}`} placeholder="e.g. Double Points Weekend" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined })); }} aria-invalid={!!fieldErrors.name} />
                {fieldErrors.name && <p className="mt-1 text-sm text-red-400" role="alert">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Multiplier</label>
                <input type="number" step="0.5" className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: parseFloat(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Type</label>
                <select className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="MULTIPLIER">Multiplier</option>
                  <option value="BONUS_POINTS">Bonus Points</option>
                  <option value="PERCENTAGE_OF_QUALIFYING">% of spend above threshold</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Starts At</label>
                <input type="datetime-local" min={editing ? undefined : nowDateTimeLocalValue()} className={`w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none ${fieldErrors.startsAt ? 'border-red-500' : 'border-hos-border'}`} value={form.startsAt} onChange={(e) => { setForm({ ...form, startsAt: e.target.value }); if (fieldErrors.startsAt) setFieldErrors((p) => ({ ...p, startsAt: undefined })); }} aria-invalid={!!fieldErrors.startsAt} />
                {fieldErrors.startsAt && <p className="mt-1 text-sm text-red-400" role="alert">{fieldErrors.startsAt}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Ends At</label>
                <input type="datetime-local" min={editing ? undefined : nowDateTimeLocalValue()} className={`w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none ${fieldErrors.endsAt ? 'border-red-500' : 'border-hos-border'}`} value={form.endsAt} onChange={(e) => { setForm({ ...form, endsAt: e.target.value }); if (fieldErrors.endsAt) setFieldErrors((p) => ({ ...p, endsAt: undefined })); }} aria-invalid={!!fieldErrors.endsAt} />
                {fieldErrors.endsAt && <p className="mt-1 text-sm text-red-400" role="alert">{fieldErrors.endsAt}</p>}
              </div>
              {form.type === 'PERCENTAGE_OF_QUALIFYING' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Purchase threshold</label>
                    <input type="number" min={0} step="0.01" className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })} />
                    <p className="mt-1 text-xs text-hos-text-muted">Welcome Reward and bonus both require at least this merchandise total.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Bonus rate (0.20 = 20%)</label>
                    <input type="number" min={0} step="0.01" className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border" value={form.earnRate} onChange={(e) => setForm({ ...form, earnRate: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Points per currency unit of bonus</label>
                    <input type="number" min={1} className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border" value={form.pointsPerDollar} onChange={(e) => setForm({ ...form, pointsPerDollar: Number(e.target.value) })} />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Description</label>
                <input className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Applicable Stores</label>
                <p className="text-xs text-hos-text-muted mb-2">
                  Optional. Leave empty to apply globally (all stores). Select specific stores to limit this campaign.
                </p>
                {storesLoading ? (
                  <p className="text-sm text-hos-text-muted">Loading stores…</p>
                ) : stores.length === 0 ? (
                  <p className="text-sm text-hos-text-muted">No stores found. Campaign will apply globally.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-hos-border rounded-lg p-3 space-y-2 bg-hos-bg-secondary">
                    {stores.map((s) => {
                      const checked = form.storeIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-sm text-hos-text-secondary">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={checked}
                            onChange={() => {
                              setForm({
                                ...form,
                                storeIds: checked
                                  ? form.storeIds.filter((id) => id !== s.id)
                                  : [...form.storeIds, s.id],
                              });
                            }}
                          />
                          <span>{s.name}</span>
                          {s.code ? <span className="text-hos-text-muted text-xs">({s.code})</span> : null}
                        </label>
                      );
                    })}
                  </div>
                )}
                {form.storeIds.length === 0 ? (
                  <p className="mt-1 text-xs text-hos-gold">Applies to all stores</p>
                ) : (
                  <p className="mt-1 text-xs text-hos-text-muted">{form.storeIds.length} store{form.storeIds.length === 1 ? '' : 's'} selected</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="campActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <label htmlFor="campActive" className="text-sm font-medium text-hos-text-secondary">Active</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm font-medium">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => {
              const status = getStatus(c);
              return (
                <div key={c.id} className="bg-hos-bg-secondary border rounded-lg p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-hos-text-secondary">{c.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.cls}`}>{status.label}</span>
                      </div>
                      <p className="text-sm text-hos-text-secondary mb-2">{c.description || 'No description'}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-hos-text-muted">
                        <span>
                          {c.type === 'PERCENTAGE_OF_QUALIFYING'
                            ? `${Number(c.conditions?.earnRate ?? defaults.earnRate) * 100}% above $${c.conditions?.threshold ?? defaults.threshold}`
                            : <><strong>{c.multiplier}x</strong> multiplier</>}
                        </span>
                        {c.startsAt && <span>From: {formatDate(c.startsAt)}</span>}
                        {c.endsAt && <span>Until: {formatDate(c.endsAt)}</span>}
                        <span>
                          Stores:{' '}
                          {Array.isArray(c.storeIds) && c.storeIds.length > 0
                            ? stores
                                .filter((s) => c.storeIds.includes(s.id))
                                .map((s) => s.name)
                                .join(', ') || `${c.storeIds.length} selected`
                            : 'All stores'}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(c)} className="text-sm text-hos-gold hover:text-hos-gold-hover font-medium">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-sm text-red-400 hover:text-red-300 font-medium">Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {campaigns.length === 0 && (
              <div className="bg-hos-bg-secondary border rounded-lg p-8 text-center text-hos-text-muted">
                No bonus campaigns yet. Create one to boost engagement.
              </div>
            )}
          </div>
        )}
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
