'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface ShippingCarrier {
  id: string;
  name: string;
  code?: string | null;
  trackingUrlTemplate?: string | null;
  isActive: boolean;
  allowCustomName: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

interface CarrierFormData {
  name: string;
  code: string;
  trackingUrlTemplate: string;
  isActive: boolean;
  allowCustomName: boolean;
  sortOrder: string;
}

const emptyForm: CarrierFormData = {
  name: '',
  code: '',
  trackingUrlTemplate: '',
  isActive: true,
  allowCustomName: false,
  sortOrder: '0',
};

export default function AdminShippingCarriersPage() {
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [carriers, setCarriers] = useState<ShippingCarrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ShippingCarrier | null>(null);
  const [form, setForm] = useState<CarrierFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCarriers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAdminShippingCarriers();
      setCarriers(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load shipping carriers');
      setCarriers([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCarriers();
  }, [fetchCarriers]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (carrier: ShippingCarrier) => {
    setEditing(carrier);
    setForm({
      name: carrier.name,
      code: carrier.code || '',
      trackingUrlTemplate: carrier.trackingUrlTemplate || '',
      isActive: carrier.isActive,
      allowCustomName: carrier.allowCustomName,
      sortOrder: String(carrier.sortOrder ?? 0),
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Carrier name is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        trackingUrlTemplate: form.trackingUrlTemplate.trim() || undefined,
        isActive: form.isActive,
        allowCustomName: form.allowCustomName,
        sortOrder: parseInt(form.sortOrder, 10) || 0,
      };

      if (editing) {
        await apiClient.updateShippingCarrier(editing.id, {
          ...payload,
          code: form.code.trim() || null,
          trackingUrlTemplate: form.trackingUrlTemplate.trim() || null,
        });
        toast.success('Carrier updated');
      } else {
        await apiClient.createShippingCarrier(payload);
        toast.success('Carrier created');
      }

      setShowModal(false);
      setEditing(null);
      setForm(emptyForm);
      await fetchCarriers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save carrier');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (carrier: ShippingCarrier) => {
    try {
      await apiClient.updateShippingCarrier(carrier.id, { isActive: !carrier.isActive });
      toast.success(carrier.isActive ? 'Carrier deactivated' : 'Carrier activated');
      await fetchCarriers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update carrier');
    }
  };

  const handleDelete = (carrier: ShippingCarrier) => {
    setConfirmDialog({
      title: `Delete carrier "${carrier.name}"?`,
      description: 'Sellers will no longer see it in manual shipping.',
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          setDeletingId(carrier.id);
          await apiClient.deleteShippingCarrier(carrier.id);
          toast.success('Carrier deleted');
          await fetchCarriers();
        } catch (err: any) {
          toast.error(err.message || 'Failed to delete carrier');
        } finally {
          setDeletingId(null);
        }
      },
    });
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-hos-text-muted mb-2">
            <Link href="/admin/settings" className="hover:text-hos-gold">
              Settings
            </Link>
            <span>/</span>
            <Link href="/admin/settings/integrations/shipping" className="hover:text-hos-gold">
              Shipping
            </Link>
            <span>/</span>
            <span>Manual Carriers</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Manual Shipping Carriers</h1>
              <p className="text-hos-text-secondary mt-1">
                Carriers shown when sellers choose &quot;Enter Tracking Manually&quot;. Only active carriers appear in that list.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm font-medium"
            >
              Add Carrier
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin/shipping"
            className="px-3 py-1.5 rounded-lg border border-hos-border text-hos-text-secondary hover:border-hos-gold hover:text-hos-gold"
          >
            Shipping Methods
          </Link>
          <Link
            href="/admin/settings/integrations/shipping"
            className="px-3 py-1.5 rounded-lg border border-hos-border text-hos-text-secondary hover:border-hos-gold hover:text-hos-gold"
          >
            Carrier Integrations (Shippo, etc.)
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto mb-4" />
              <p className="text-hos-text-secondary">Loading carriers...</p>
            </div>
          </div>
        ) : (
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-hos-border">
              <thead className="bg-hos-bg-tertiary/40">
                <tr>
                  <th className="px-4 py-3 text-xs font-medium text-hos-text-muted uppercase text-center">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">
                    Sort
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">
                    Options
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hos-border">
                {carriers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-hos-text-muted">
                      No carriers configured yet. Add the carriers sellers should use for manual tracking entry.
                    </td>
                  </tr>
                ) : (
                  carriers.map((carrier) => (
                    <tr key={carrier.id} className="hover:bg-hos-bg-tertiary/30">
                      <td className="px-4 py-3 text-sm font-medium text-hos-text-secondary">
                        {carrier.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-muted">
                        {carrier.code || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-muted">
                        {carrier.sortOrder}
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-muted">
                        {carrier.allowCustomName ? (
                          <span className="px-2 py-0.5 text-xs rounded bg-hos-gold/15 text-hos-gold">
                            Custom name
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(carrier)}
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            carrier.isActive
                              ? 'bg-green-500/15 text-green-300'
                              : 'bg-hos-bg-tertiary text-hos-text-secondary'
                          }`}
                        >
                          {carrier.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-sm space-x-3">
                        <button
                          type="button"
                          onClick={() => openEdit(carrier)}
                          className="text-hos-gold hover:text-hos-gold-hover"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(carrier)}
                          disabled={deletingId === carrier.id}
                          className="text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-lg bg-hos-bg-secondary border border-hos-border rounded-lg shadow-xl">
              <div className="px-5 py-4 border-b border-hos-border flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {editing ? 'Edit Carrier' : 'Add Carrier'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-hos-text-muted hover:text-hos-text-secondary"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                    Display name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Royal Mail"
                    className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Code (optional)
                    </label>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      placeholder="e.g. royal_mail"
                      className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Sort order
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                    Tracking URL template (optional)
                  </label>
                  <input
                    type="text"
                    value={form.trackingUrlTemplate}
                    onChange={(e) => setForm({ ...form, trackingUrlTemplate: e.target.value })}
                    placeholder="https://track.example.com/?n={trackingNumber}"
                    className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none"
                  />
                  <p className="text-xs text-hos-text-muted mt-1">
                    Use {'{trackingNumber}'} as a placeholder.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="h-4 w-4 text-hos-gold rounded"
                    />
                    Active (visible to sellers)
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.allowCustomName}
                      onChange={(e) => setForm({ ...form, allowCustomName: e.target.checked })}
                      className="h-4 w-4 text-hos-gold rounded"
                    />
                    Allow custom name entry
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-hos-border rounded-lg text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editing ? 'Save changes' : 'Create carrier'}
                  </button>
                </div>
              </form>
            </div>
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
