'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminLoyaltyCampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', description: '', multiplier: 2, startsAt: '', endsAt: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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

  const resetForm = () => {
    setForm({ name: '', description: '', multiplier: 2, startsAt: '', endsAt: '', isActive: true });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name || '',
      description: c.description || '',
      multiplier: c.multiplier || 2,
      startsAt: c.startsAt ? new Date(c.startsAt).toISOString().slice(0, 16) : '',
      endsAt: c.endsAt ? new Date(c.endsAt).toISOString().slice(0, 16) : '',
      isActive: c.isActive ?? true,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      };
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

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await apiClient.adminDeleteLoyaltyCampaign(id);
      toast.success('Campaign deleted');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const getStatus = (c: any) => {
    const now = new Date();
    if (!c.isActive) return { label: 'Inactive', cls: 'bg-gray-100 text-gray-600' };
    if (c.endsAt && new Date(c.endsAt) < now) return { label: 'Ended', cls: 'bg-red-100 text-red-700' };
    if (c.startsAt && new Date(c.startsAt) > now) return { label: 'Scheduled', cls: 'bg-blue-100 text-blue-700' };
    return { label: 'Active', cls: 'bg-green-100 text-green-700' };
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bonus Campaigns</h1>
            <p className="text-gray-600 mt-1">Create double-points and multiplier campaigns</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
            + New Campaign
          </button>
        </div>

        {showForm && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Campaign' : 'New Campaign'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Double Points Weekend" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Multiplier</label>
                <input type="number" step="0.5" className="w-full border rounded-lg px-3 py-2" value={form.multiplier} onChange={(e) => setForm({ ...form, multiplier: parseFloat(e.target.value) || 1 })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starts At</label>
                <input type="datetime-local" className="w-full border rounded-lg px-3 py-2" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ends At</label>
                <input type="datetime-local" className="w-full border rounded-lg px-3 py-2" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input className="w-full border rounded-lg px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="campActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <label htmlFor="campActive" className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => {
              const status = getStatus(c);
              return (
                <div key={c.id} className="bg-white border rounded-lg p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{c.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.cls}`}>{status.label}</span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{c.description || 'No description'}</p>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span><strong>{c.multiplier}x</strong> multiplier</span>
                        {c.startsAt && <span>From: {new Date(c.startsAt).toLocaleDateString()}</span>}
                        {c.endsAt && <span>Until: {new Date(c.endsAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(c)} className="text-sm text-purple-600 hover:text-purple-800 font-medium">Edit</button>
                      <button onClick={() => handleDelete(c.id)} className="text-sm text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {campaigns.length === 0 && (
              <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
                No bonus campaigns yet. Create one to boost engagement.
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
