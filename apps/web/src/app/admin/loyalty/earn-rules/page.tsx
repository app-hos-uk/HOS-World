'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminLoyaltyEarnRulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ action: '', pointsAwarded: 0, description: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyEarnRules();
      if (res?.data) setRules(res.data as any[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load earn rules');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm({ action: '', pointsAwarded: 0, description: '', isActive: true });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (rule: any) => {
    setEditing(rule);
    setForm({
      action: rule.action || '',
      pointsAwarded: rule.pointsAwarded || 0,
      description: rule.description || '',
      isActive: rule.isActive ?? true,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.action.trim()) { toast.error('Action is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await apiClient.adminUpdateLoyaltyEarnRule(editing.id, form);
        toast.success('Rule updated');
      } else {
        await apiClient.adminCreateLoyaltyEarnRule(form);
        toast.success('Rule created');
      }
      resetForm();
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this earn rule?')) return;
    try {
      await apiClient.adminDeleteLoyaltyEarnRule(id);
      toast.success('Rule deleted');
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
            <h1 className="text-2xl font-bold text-gray-900">Earn Rules</h1>
            <p className="text-gray-600 mt-1">Configure how customers earn loyalty points</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
            + New Rule
          </button>
        </div>

        {showForm && (
          <div className="bg-white border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{editing ? 'Edit Rule' : 'New Earn Rule'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="e.g. PURCHASE, REVIEW, REFERRAL" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points Awarded</label>
                <input type="number" className="w-full border rounded-lg px-3 py-2" value={form.pointsAwarded} onChange={(e) => setForm({ ...form, pointsAwarded: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="What triggers this rule" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active</label>
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
          <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Points</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{rule.action}</td>
                    <td className="px-4 py-3">{rule.pointsAwarded}</td>
                    <td className="px-4 py-3 text-gray-600">{rule.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${rule.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {rule.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => startEdit(rule)} className="text-purple-600 hover:text-purple-800 font-medium mr-3">Edit</button>
                      <button onClick={() => handleDelete(rule.id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rules.length === 0 && (
              <div className="p-8 text-center text-gray-500">No earn rules configured yet.</div>
            )}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
