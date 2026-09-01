'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { DEFAULT_CURRENCY } from '@/lib/regionConfig';

interface Market {
  id: string;
  code: string;
  name: string;
  country: string;
  countryCode: string;
  currency: string;
  locale: string;
  timezone: string;
  isActive: boolean;
  isDefault: boolean;
}

const EMPTY_MARKET = {
  code: '',
  name: '',
  country: '',
  countryCode: '',
  currency: DEFAULT_CURRENCY,
  locale: 'en-US',
  timezone: 'America/New_York',
  isActive: true,
  isDefault: false,
};

export default function AdminMarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMarket, setEditingMarket] = useState<Market | null>(null);
  const [form, setForm] = useState(EMPTY_MARKET);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiClient.listAdminMarkets();
      setMarkets(res?.data || []);
    } catch {
      toast.error('Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingMarket(null);
    setForm(EMPTY_MARKET);
    setShowModal(true);
  };

  const openEdit = (m: Market) => {
    setEditingMarket(m);
    setForm({
      code: m.code,
      name: m.name,
      country: m.country,
      countryCode: m.countryCode,
      currency: m.currency,
      locale: m.locale,
      timezone: m.timezone,
      isActive: m.isActive,
      isDefault: m.isDefault,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.country || !form.countryCode || !form.currency) {
      toast.error('Code, name, country, country code and currency are required');
      return;
    }
    setSaving(true);
    try {
      if (editingMarket) {
        await apiClient.updateMarket(editingMarket.id, form);
        toast.success('Market updated');
      } else {
        await apiClient.createMarket(form);
        toast.success('Market created');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save market');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Markets</h1>
          <p className="text-hos-text-secondary mt-2">Manage selling markets and geographic regions</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium"
        >
          + New Market
        </button>
      </div>

      <div className="bg-hos-bg-secondary border border-hos-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-hos-text-muted">Loading...</div>
        ) : markets.length === 0 ? (
          <div className="p-8 text-center text-hos-text-muted">No markets configured yet.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-hos-border">
                <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Code</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Name</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Country</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Currency</th>
                <th className="text-left px-4 py-3 text-sm font-semibold text-hos-text-secondary">Status</th>
                <th className="text-right px-4 py-3 text-sm font-semibold text-hos-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => (
                <tr key={m.id} className="border-b border-hos-border last:border-0 hover:bg-hos-bg-tertiary">
                  <td className="px-4 py-3 font-mono text-sm">{m.code}</td>
                  <td className="px-4 py-3">
                    {m.name}
                    {m.isDefault && (
                      <span className="ml-2 px-1.5 py-0.5 text-xs bg-hos-gold/20 text-hos-gold-hover rounded">Default</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{m.country} ({m.countryCode})</td>
                  <td className="px-4 py-3 text-sm">{m.currency}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded ${m.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {m.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(m)}
                      className="text-sm text-hos-gold hover:text-hos-gold-hover"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-hos-bg-secondary rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingMarket ? `Edit Market: ${editingMarket.code}` : 'Create New Market'}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="US"
                    disabled={!!editingMarket}
                    className="input w-full disabled:opacity-60"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="United States"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Country *</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    placeholder="United States"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Country Code *</label>
                  <input
                    type="text"
                    value={form.countryCode}
                    onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })}
                    placeholder="US"
                    className="input w-full"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Currency *</label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    placeholder={DEFAULT_CURRENCY}
                    className="input w-full"
                    maxLength={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Locale</label>
                  <input
                    type="text"
                    value={form.locale}
                    onChange={(e) => setForm({ ...form, locale: e.target.value })}
                    placeholder="en-US"
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Timezone</label>
                  <input
                    type="text"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    placeholder="America/New_York"
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                  />
                  <span className="text-sm font-medium text-hos-text-secondary">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                  />
                  <span className="text-sm font-medium text-hos-text-secondary">Default Market</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-tertiary rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-[#1a1406] bg-hos-gold rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingMarket ? 'Update Market' : 'Create Market'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}
