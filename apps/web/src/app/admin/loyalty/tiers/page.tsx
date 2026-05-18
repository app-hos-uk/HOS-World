'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminLoyaltyTiersPage() {
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyTiers();
      if (res?.data) setTiers(res.data as any[]);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tiers');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (tier: any) => {
    setEditing(tier.id);
    setForm({
      name: tier.name,
      level: tier.level,
      minPoints: tier.minPoints,
      maxPoints: tier.maxPoints,
      multiplier: tier.multiplier,
      color: tier.color || '',
      icon: tier.icon || '',
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await apiClient.adminUpdateLoyaltyTier(editing, form);
      toast.success('Tier updated');
      setEditing(null);
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tier');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <AdminLayout>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Tiers</h1>
          <p className="text-gray-600 mt-1">Configure tier thresholds, multipliers, and branding</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => (
              <div key={tier.id} className="bg-white border rounded-lg p-6">
                {editing === tier.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input className="w-full border rounded-lg px-3 py-2" value={String(form.name || '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2" value={Number(form.level || 0)} onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Points</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2" value={Number(form.minPoints || 0)} onChange={(e) => setForm({ ...form, minPoints: parseInt(e.target.value) })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Multiplier</label>
                        <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2" value={Number(form.multiplier || 1)} onChange={(e) => setForm({ ...form, multiplier: parseFloat(e.target.value) })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium">
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-xl">
                        {tier.icon || '🏆'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{tier.name}</h3>
                        <p className="text-sm text-gray-500">
                          Level {tier.level} &middot; {Number(tier.minPoints).toLocaleString()}+ pts &middot; {tier.multiplier}x multiplier
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {tier._count?.members != null && (
                        <span className="text-sm text-gray-500">{tier._count.members} members</span>
                      )}
                      <button onClick={() => startEdit(tier)} className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium">
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {tiers.length === 0 && (
              <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
                No tiers configured. Seed the loyalty programme to create default tiers.
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
