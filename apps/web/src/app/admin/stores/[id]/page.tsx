'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CountrySelect } from '@/components/CountrySelect';
import { COUNTRIES } from '@/lib/countries';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type EditForm = {
  name: string;
  code: string;
  address: string;
  city: string;
  postcode: string;
  countryCode: string;
};

type ReadinessCheck = { key: string; label: string; ok: boolean };

const INPUT_CLS =
  'w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

const LEGACY_ALIASES: Record<string, string> = { UK: 'GB', USA: 'US' };

function resolveCountryCode(row: Record<string, unknown>): string {
  const cc = String(row.countryCode ?? '');
  const country = String(row.country ?? '');
  return cc
    || COUNTRIES.find((c) => c.name.toLowerCase() === country.toLowerCase())?.code
    || LEGACY_ALIASES[country.toUpperCase()]
    || COUNTRIES.find((c) => c.code === country.toUpperCase())?.code
    || 'US';
}

function toEditForm(row: Record<string, unknown>): EditForm {
  return {
    name: String(row.name ?? ''),
    code: String(row.code ?? ''),
    address: String(row.address ?? ''),
    city: String(row.city ?? ''),
    postcode: String(row.postcode ?? ''),
    countryCode: resolveCountryCode(row),
  };
}

export default function AdminStoreDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();

  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({ name: '', code: '', address: '', city: '', postcode: '', countryCode: '' });
  const [saving, setSaving] = useState(false);
  const [sellers, setSellers] = useState<{ id: string; storeName: string }[]>([]);
  const [sellerId, setSellerId] = useState('');
  const [readiness, setReadiness] = useState<ReadinessCheck[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setRow(null);
    setReadiness([]);
    apiClient.adminGetStore(id)
      .then((r) => {
        const data = (r.data as Record<string, unknown>) || null;
        setRow(data);
        if (data) {
          setForm(toEditForm(data));
          setSellerId(String(data.sellerId ?? ''));
        }
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));

    apiClient.adminGetStoreReadiness(id)
      .then((r) => {
        const data = r.data as { checks?: ReadinessCheck[] } | undefined;
        setReadiness(data?.checks ?? []);
      })
      .catch(() => setReadiness([]));
  }, [id, toast]);

  useEffect(() => {
    load();
    apiClient.getAdminSellers({ page: 1, limit: 200 })
      .then((r) => {
        const list = ((r.data as Record<string, unknown>)?.sellers ?? r.data) as Record<string, unknown>[];
        if (Array.isArray(list)) {
          setSellers(list.map((s) => ({
            id: String(s.id),
            storeName: String(s.storeName || s.businessName || s.id),
          })));
        }
      })
      .catch(() => {});
  }, [load]);

  const activate = async () => {
    try {
      await apiClient.adminActivateStore(id);
      toast.success('Store activated');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const deactivate = () => {
    setConfirmDialog({
      title: 'Deactivate this store?',
      description: 'It will no longer accept orders.',
      tone: 'danger',
      confirmLabel: 'Deactivate',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.adminDeactivateStore(id);
          toast.success('Store deactivated');
          load();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed');
        }
      },
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Store name is required'); return; }
    setSaving(true);
    try {
      const countryName = COUNTRIES.find((c) => c.code === form.countryCode)?.name;
      await apiClient.adminUpdateStore(id, {
        name: form.name.trim(),
        code: form.code.trim(),
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        postcode: form.postcode.trim() || undefined,
        country: countryName || form.countryCode || undefined,
        countryCode: form.countryCode || undefined,
        defaultRegionCode: form.countryCode || undefined,
        sellerId: sellerId || null,
      });
      toast.success('Store updated');
      setEditing(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => { if (row) setForm(toEditForm(row)); setEditing(true); };
  const cancelEdit = () => { if (row) setForm(toEditForm(row)); setEditing(false); };
  const isActive = row?.isActive === true || row?.isActive === 'true';

  const passedCount = readiness.filter((c) => c.ok).length;
  const allPassed = readiness.length > 0 && passedCount === readiness.length;

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link href="/admin/stores" className="text-sm text-hos-gold hover:text-hos-gold">&larr; Stores</Link>

        {row ? (
          <>
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-semibold text-hos-text-secondary">{String(row.name)}</h1>
                <p className="text-sm text-hos-text-muted">
                  {String(row.code)} &middot; {String(row.country || row.countryCode)} &middot;{' '}
                  {isActive
                    ? <span className="text-emerald-400">active</span>
                    : <span className="text-red-400">inactive</span>}
                  {row.sellerId
                    ? <span className="ml-2">&middot; Seller: {sellers.find((s) => s.id === row.sellerId)?.storeName || String(row.sellerId)}</span>
                    : <span className="ml-2 text-amber-400">&middot; No seller</span>}
                </p>
              </div>
              <div className="flex gap-2">
                {!editing && (
                  <button type="button" className="text-sm rounded-md bg-hos-gold px-3 py-2 text-[#1a1406] font-medium hover:bg-hos-gold-hover" onClick={startEdit}>
                    Edit store
                  </button>
                )}
                {isActive ? (
                  <button type="button" className="text-sm rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-500" onClick={() => void deactivate()}>
                    Deactivate
                  </button>
                ) : (
                  <button type="button" className="text-sm rounded-md bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-500" onClick={() => void activate()}>
                    Activate
                  </button>
                )}
              </div>
            </div>

            {/* Edit form */}
            {editing && (
              <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 text-hos-text-secondary">Edit store details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Seller</label>
                    <select className={INPUT_CLS} value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
                      <option value="">No seller assigned</option>
                      {sellers.map((s) => <option key={s.id} value={s.id}>{s.storeName}</option>)}
                    </select>
                    <p className="text-xs text-hos-text-muted mt-1">Required for POS connections.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Name *</label>
                    <input className={INPUT_CLS} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Code</label>
                    <input className={INPUT_CLS} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Address</label>
                    <input className={INPUT_CLS} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">City</label>
                    <input className={INPUT_CLS} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Postcode</label>
                    <input className={INPUT_CLS} value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Country</label>
                    <CountrySelect id="store-country" name="countryCode" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} className={INPUT_CLS} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void handleSave()} disabled={saving} className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm font-medium">
                    {saving ? 'Saving\u2026' : 'Save changes'}
                  </button>
                  <button type="button" onClick={cancelEdit} className="px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium text-hos-text-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Readiness dashboard — auto-derived, no manual ticking */}
            {readiness.length > 0 && (
              <div>
                <h2 className="text-lg font-medium mb-2 text-hos-text-secondary">
                  Readiness
                  <span className={`ml-2 text-sm font-normal ${allPassed ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {passedCount}/{readiness.length} checks passed
                  </span>
                </h2>
                <ul className="space-y-1.5 text-sm">
                  {readiness.map((c) => (
                    <li key={c.key} className="flex items-center gap-2 border border-hos-border rounded p-2 bg-hos-bg-secondary">
                      <span className={`text-lg ${c.ok ? 'text-emerald-400' : 'text-hos-text-muted'}`}>
                        {c.ok ? '●' : '○'}
                      </span>
                      <span className={c.ok ? 'text-hos-text-secondary' : 'text-hos-text-muted'}>
                        {c.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {!allPassed && !isActive && (
                  <p className="mt-2 text-xs text-hos-text-muted">
                    These checks are advisory. You can still activate the store.
                  </p>
                )}
              </div>
            )}

            {/* Quick links */}
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href={`/admin/pos/connections`} className="text-hos-gold hover:text-hos-gold-hover underline">
                POS connections
              </Link>
              <Link href={`/admin/sellers`} className="text-hos-gold hover:text-hos-gold-hover underline">
                Manage sellers
              </Link>
              <Link href={`/admin/loyalty/settings`} className="text-hos-gold hover:text-hos-gold-hover underline">
                Loyalty settings
              </Link>
            </div>
          </>
        ) : (
          <p className="text-hos-text-muted">Loading&hellip;</p>
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
