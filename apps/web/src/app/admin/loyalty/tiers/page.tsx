'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
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
      pointsThreshold: tier.pointsThreshold ?? tier.minPoints ?? 0,
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
              <div className="mb-6">
          <h1 className="text-2xl font-bold text-hos-text-secondary">Loyalty Tiers</h1>
          <p className="text-hos-text-secondary mt-1">Configure tier thresholds, multipliers, and branding</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
          </div>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => (
              <div key={tier.id} className="bg-hos-bg-secondary border rounded-lg p-6">
                {editing === tier.id ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Name</label>
                        <input className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={String(form.name || '')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Level</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={Number(form.level || 0)} onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Points Threshold</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={Number(form.pointsThreshold || 0)} onChange={(e) => setForm({ ...form, pointsThreshold: parseInt(e.target.value) })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Multiplier</label>
                        <input type="number" step="0.1" className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border" value={Number(form.multiplier || 1)} onChange={(e) => setForm({ ...form, multiplier: parseFloat(e.target.value) })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm font-medium">
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-hos-gold/20 flex items-center justify-center text-xl">
                        {tier.icon || '🏆'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-hos-text-secondary">{tier.name}</h3>
                        <p className="text-sm text-hos-text-muted">
                          Level {tier.level} &middot; {Number(tier.pointsThreshold ?? tier.minPoints ?? 0).toLocaleString()}+ pts &middot; {tier.multiplier}x multiplier
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {tier._count?.members != null && (
                        <span className="text-sm text-hos-text-muted">{tier._count.members} members</span>
                      )}
                      <button onClick={() => startEdit(tier)} className="px-3 py-1.5 text-sm text-hos-gold hover:bg-hos-gold/10 rounded-lg transition-colors font-medium">
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {tiers.length === 0 && (
              <div className="bg-hos-bg-secondary border rounded-lg p-8 text-center text-hos-text-muted">
                No tiers configured. Seed the loyalty program to create default tiers.
              </div>
            )}
          </div>
        )}
          </RouteGuard>
  );
}
