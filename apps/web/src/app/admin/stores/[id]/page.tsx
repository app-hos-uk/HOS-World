'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type StepRow = { key: string; label: string; completedAt: string | null };

type EditForm = {
  name: string;
  code: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  defaultRegionCode: string;
};

const INPUT_CLS =
  'w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

function toEditForm(row: Record<string, unknown>): EditForm {
  return {
    name: String(row.name ?? ''),
    code: String(row.code ?? ''),
    address: String(row.address ?? ''),
    city: String(row.city ?? ''),
    postcode: String(row.postcode ?? ''),
    country: String(row.country ?? ''),
    defaultRegionCode: String(row.defaultRegionCode ?? ''),
  };
}

export default function AdminStoreDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({ name: '', code: '', address: '', city: '', postcode: '', country: '', defaultRegionCode: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetStore(id)
      .then((r) => {
        const data = (r.data as Record<string, unknown>) || null;
        setRow(data);
        if (data) setForm(toEditForm(data));
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const checklist = row?.onboardingChecklist as Record<string, unknown> | undefined;
  const steps = (checklist?.steps as StepRow[]) ?? [];

  const completeStep = async (key: string) => {
    try {
      await apiClient.adminCompleteOnboardingStep(id, key);
      toast.success('Step saved');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const finishOnboarding = async () => {
    try {
      await apiClient.adminCompleteOnboarding(id);
      toast.success('Onboarding completed');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

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
    if (!form.name.trim()) {
      toast.error('Store name is required');
      return;
    }
    setSaving(true);
    try {
      await apiClient.adminUpdateStore(id, {
        name: form.name.trim(),
        code: form.code.trim(),
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        postcode: form.postcode.trim() || undefined,
        country: form.country.trim() || undefined,
        defaultRegionCode: form.defaultRegionCode.trim() || undefined,
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

  const startEdit = () => {
    if (row) setForm(toEditForm(row));
    setEditing(true);
  };

  const cancelEdit = () => {
    if (row) setForm(toEditForm(row));
    setEditing(false);
  };

  const isActive = row?.isActive === true || row?.isActive === 'true';

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Link href="/admin/stores" className="text-sm text-hos-gold hover:text-hos-gold">
          &larr; Stores
        </Link>
        {row ? (
          <>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-semibold text-hos-text-secondary">{String(row.name)}</h1>
                <p className="text-sm text-hos-text-muted">
                  {String(row.code)} &middot; {String(row.defaultRegionCode)} &middot;{' '}
                  {isActive ? (
                    <span className="text-emerald-400">active</span>
                  ) : (
                    <span className="text-red-400">inactive</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                {!editing && (
                  <button
                    type="button"
                    className="text-sm rounded-md bg-hos-gold px-3 py-2 text-[#1a1406] font-medium hover:bg-hos-gold-hover"
                    onClick={startEdit}
                  >
                    Edit store
                  </button>
                )}
                {isActive ? (
                  <button
                    type="button"
                    className="text-sm rounded-md bg-red-600 px-3 py-2 text-white hover:bg-red-500"
                    onClick={() => void deactivate()}
                  >
                    Deactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    className="text-sm rounded-md bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-500"
                    onClick={() => void activate()}
                  >
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
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Name *</label>
                    <input
                      className={INPUT_CLS}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Code</label>
                    <input
                      className={INPUT_CLS}
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Address</label>
                    <input
                      className={INPUT_CLS}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">City</label>
                    <input
                      className={INPUT_CLS}
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Postcode</label>
                    <input
                      className={INPUT_CLS}
                      value={form.postcode}
                      onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Country</label>
                    <input
                      className={INPUT_CLS}
                      value={form.country}
                      onChange={(e) => setForm({ ...form, country: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Default region code</label>
                    <input
                      className={INPUT_CLS}
                      placeholder="e.g. GB"
                      value={form.defaultRegionCode}
                      onChange={(e) => setForm({ ...form, defaultRegionCode: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm font-medium"
                  >
                    {saving ? 'Saving\u2026' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium text-hos-text-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Onboarding */}
            <div>
              <h2 className="text-lg font-medium mb-2 text-hos-text-secondary">Onboarding</h2>
              <p className="text-xs text-hos-text-muted mb-2">Status: {String(checklist?.status ?? '—')}</p>
              <ul className="space-y-2 text-sm">
                {steps.map((s) => (
                  <li
                    key={s.key}
                    className="flex justify-between items-center border border-hos-border rounded p-2 bg-hos-bg-secondary"
                  >
                    <span className="text-hos-text-secondary">
                      {s.label}
                      {s.completedAt ? (
                        <span className="text-emerald-400 text-xs ml-2">done</span>
                      ) : null}
                    </span>
                    {!s.completedAt && (
                      <button
                        type="button"
                        className="text-xs text-hos-gold hover:text-hos-gold-hover"
                        onClick={() => completeStep(s.key)}
                      >
                        Mark done
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-3 text-sm px-3 py-1 rounded bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-secondary"
                onClick={finishOnboarding}
              >
                Complete onboarding (all steps must be done)
              </button>
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
