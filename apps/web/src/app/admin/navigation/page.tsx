'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface NavItem {
  id: string;
  group: string;
  label: string;
  href: string;
  order: number;
  isActive: boolean;
  external: boolean;
}

const GROUPS = [
  { key: 'header_primary', label: 'Header — Primary Nav' },
  { key: 'header_more', label: 'Header — More Dropdown' },
  { key: 'footer_shop', label: 'Footer — Shop Links' },
  { key: 'footer_policy', label: 'Footer — Policy Links' },
];

const EMPTY_FORM = {
  label: '',
  href: '',
  group: 'header_primary',
  order: 0,
  isActive: true,
  external: false,
};

export default function AdminNavigationPage() {
  const toast = useToast();
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [activeGroup, setActiveGroup] = useState('header_primary');

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAllNavigation();
      if (res?.data) setItems(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load navigation');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = items
    .filter((i) => i.group === activeGroup)
    .sort((a, b) => a.order - b.order);

  const openNew = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, group: activeGroup, order: filtered.length });
    setShowForm(true);
  };

  const openEdit = (item: NavItem) => {
    setEditingId(item.id);
    setFormData({
      label: item.label,
      href: item.href,
      group: item.group,
      order: item.order,
      isActive: item.isActive,
      external: item.external,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.label.trim() || !formData.href.trim()) {
      toast.error('Label and URL are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiClient.updateNavigationItem(editingId, formData);
        toast.success('Navigation item updated');
      } else {
        await apiClient.createNavigationItem(formData);
        toast.success('Navigation item created');
      }
      setShowForm(false);
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this navigation item?')) return;
    try {
      await apiClient.deleteNavigationItem(id);
      toast.success('Item deleted');
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const moveItem = async (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= filtered.length) return;
    const a = filtered[idx];
    const b = filtered[newIdx];
    try {
      await Promise.all([
        apiClient.updateNavigationItem(a.id, { order: b.order }),
        apiClient.updateNavigationItem(b.id, { order: a.order }),
      ]);
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Reorder failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-primary">Navigation Management</h1>
              <p className="text-sm text-hos-text-muted mt-1">
                Manage header and footer navigation links
              </p>
            </div>
            <button
              onClick={openNew}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg font-medium hover:bg-hos-gold-hover transition-colors"
            >
              + Add Item
            </button>
          </div>

          {/* Group tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setActiveGroup(g.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeGroup === g.key
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-secondary text-hos-text-secondary hover:bg-hos-bg-tertiary'
                }`}
              >
                {g.label}
                <span className="ml-1.5 text-xs opacity-70">
                  ({items.filter((i) => i.group === g.key).length})
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" />
            </div>
          ) : (
            <div className="bg-hos-bg-secondary border border-hos-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-hos-border bg-hos-bg-tertiary/50">
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted w-10">#</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Label</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted">URL</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted w-20">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-hos-text-muted w-36">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-hos-text-muted">
                        No items in this group
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, idx) => (
                      <tr key={item.id} className="border-b border-hos-border/50 hover:bg-hos-bg-tertiary/30">
                        <td className="px-4 py-3 text-hos-text-muted">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveItem(idx, -1)}
                              disabled={idx === 0}
                              className="text-xs disabled:opacity-20 hover:text-hos-gold"
                            >▲</button>
                            <button
                              onClick={() => moveItem(idx, 1)}
                              disabled={idx === filtered.length - 1}
                              className="text-xs disabled:opacity-20 hover:text-hos-gold"
                            >▼</button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-hos-text-primary">
                          {item.label}
                          {item.external && <span className="ml-1 text-xs text-hos-text-muted">↗</span>}
                        </td>
                        <td className="px-4 py-3 text-hos-text-muted text-xs font-mono truncate max-w-[200px]">
                          {item.href}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.isActive
                              ? 'bg-green-900/30 text-green-400'
                              : 'bg-red-900/30 text-red-400'
                          }`}>
                            {item.isActive ? 'Active' : 'Hidden'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openEdit(item)}
                            className="text-hos-gold hover:text-hos-gold-hover text-xs mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
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

          {/* Modal form */}
          {showForm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-hos-bg-secondary border border-hos-border rounded-xl w-full max-w-lg p-6 space-y-4">
                <h2 className="text-lg font-bold text-hos-text-primary">
                  {editingId ? 'Edit Navigation Item' : 'New Navigation Item'}
                </h2>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">Group</label>
                  <select
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                  >
                    {GROUPS.map((g) => (
                      <option key={g.key} value={g.key}>{g.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">Label *</label>
                  <input
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                    placeholder="e.g. Shop Now"
                  />
                </div>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">URL *</label>
                  <input
                    value={formData.href}
                    onChange={(e) => setFormData({ ...formData, href: e.target.value })}
                    className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                    placeholder="/products or https://..."
                  />
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded"
                    />
                    Active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                    <input
                      type="checkbox"
                      checked={formData.external}
                      onChange={(e) => setFormData({ ...formData, external: e.target.checked })}
                      className="rounded"
                    />
                    External link
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 text-sm text-hos-text-muted hover:text-hos-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
