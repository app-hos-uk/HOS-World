'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminLoyaltyRedemptionPage() {
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', description: '', pointsCost: 0, type: 'DISCOUNT', value: 0, isActive: true });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyRedemptionOptions();
      if (res?.data) setOptions(res.data as any[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load redemption options');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ name: '', description: '', pointsCost: 0, type: 'DISCOUNT', value: 0, isActive: true });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (opt: any) => {
    setEditing(opt);
    setForm({
      name: opt.name || '',
      description: opt.description || '',
      pointsCost: opt.pointsCost || 0,
      type: opt.type || 'DISCOUNT',
      value: opt.value ?? opt.discountValue ?? 0,
      isActive: opt.isActive ?? true,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await apiClient.adminUpdateLoyaltyRedemptionOption(editing.id, form);
        toast.success('Option updated');
      } else {
        await apiClient.adminCreateLoyaltyRedemptionOption(form);
        toast.success('Option created');
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this redemption option? If it has redemption history, it will be deactivated instead.')) return;
    try {
      const res = await apiClient.adminDeleteLoyaltyRedemptionOption(id);
      toast.success(res.message || 'Deleted');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Redemption Options</h1>
            <p className="text-hos-text-secondary mt-1">Manage the rewards catalogue customers can redeem points for</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm font-medium">
            + New Option
          </button>
        </div>

        {showForm && (
          <div className="bg-hos-bg-secondary border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Option' : 'New Redemption Option'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Name</label>
                <input className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" placeholder="e.g. $5 Discount" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Points Cost</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={form.pointsCost} onChange={(e) => setForm({ ...form, pointsCost: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Type</label>
                <select className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary focus:outline-none border-hos-border" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="DISCOUNT">Discount</option>
                  <option value="FREE_SHIPPING">Free Shipping</option>
                  <option value="FREE_PRODUCT">Free Product</option>
                  <option value="EXCLUSIVE_ACCESS">Exclusive Access</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Discount Value</label>
                <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Description</label>
                <input className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="optActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <label htmlFor="optActive" className="text-sm font-medium text-hos-text-secondary">Active</label>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {options.map((opt) => (
              <div key={opt.id} className="bg-hos-bg-secondary border rounded-lg p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-hos-text-secondary">{opt.name}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${opt.isActive !== false ? 'bg-green-500/15 text-green-400' : 'bg-hos-bg-tertiary text-hos-text-secondary'}`}>
                    {opt.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-hos-text-secondary mb-3">{opt.description || 'No description'}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-hos-gold">{Number(opt.pointsCost).toLocaleString()} pts</span>
                  <span className="text-hos-text-muted">{opt.type}</span>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <button onClick={() => startEdit(opt)} className="text-sm text-hos-gold hover:text-hos-gold-hover font-medium">Edit</button>
                  <button onClick={() => handleDelete(opt.id)} className="text-sm text-red-400 hover:text-red-300 font-medium">Delete</button>
                </div>
              </div>
            ))}
            {options.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3 bg-hos-bg-secondary border rounded-lg p-8 text-center text-hos-text-muted">
                No redemption options yet. Create one to populate the rewards catalogue.
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
