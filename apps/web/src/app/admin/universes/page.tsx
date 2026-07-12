'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { FileUpload } from '@/components/FileUpload';

interface UniverseRow {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  tag?: string | null;
  description?: string | null;
  accentColor?: string | null;
  gradientColors?: string[];
  order: number;
  featured: boolean;
  isActive: boolean;
}

const DEFAULT_GRADIENT = ['#05050D', '#0C0C18', '#12122A', '#18183C', '#20204A'];

const EMPTY_FORM = {
  name: '',
  logo: '',
  tag: '',
  description: '',
  accentColor: '#C9A84C',
  gradientColors: [...DEFAULT_GRADIENT],
  order: 0,
  featured: false,
  isActive: true,
};

export default function AdminUniversesPage() {
  const toast = useToast();
  const [items, setItems] = useState<UniverseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminUniverses();
      if (res?.data) setItems(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load universes');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const sorted = [...items].sort((a, b) => a.order - b.order);

  const nextOrder = sorted.reduce((max, u) => Math.max(max, u.order), -1) + 1;

  const openNew = () => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, order: nextOrder });
    setShowForm(true);
  };

  const openEdit = (item: UniverseRow) => {
    setEditingId(item.id);
    setFormData({
      name: item.name,
      logo: item.logo || '',
      tag: item.tag || '',
      description: item.description || '',
      accentColor: item.accentColor || '#C9A84C',
      gradientColors:
        item.gradientColors && item.gradientColors.length === 5
          ? [...item.gradientColors]
          : [...DEFAULT_GRADIENT],
      order: item.order,
      featured: item.featured,
      isActive: item.isActive,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        logo: formData.logo || undefined,
        tag: formData.tag || undefined,
        description: formData.description || undefined,
        accentColor: formData.accentColor || undefined,
        gradientColors: formData.gradientColors,
        order: formData.order,
        featured: formData.featured,
        isActive: formData.isActive,
      };

      if (editingId) {
        await apiClient.updateUniverse(editingId, payload);
        toast.success('Universe updated');
      } else {
        await apiClient.createUniverse(payload);
        toast.success('Universe created');
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
    if (!confirm('Delete this universe?')) return;
    try {
      await apiClient.deleteUniverse(id);
      toast.success('Universe deleted');
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const moveItem = async (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, moved);
    try {
      await apiClient.reorderUniverses(reordered.map((u) => u.id));
      await fetchItems();
    } catch (err: any) {
      toast.error(err.message || 'Reorder failed');
    }
  };

  const updateGradientColor = (index: number, value: string) => {
    setFormData((prev) => {
      const next = [...prev.gradientColors];
      next[index] = value;
      return { ...prev, gradientColors: next };
    });
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-primary">Universe Management</h1>
              <p className="text-sm text-hos-text-muted mt-1">
                Manage landing page universe tiles — logos, tags, descriptions, and colors
              </p>
            </div>
            <button
              onClick={openNew}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg font-medium hover:bg-hos-gold-hover transition-colors"
            >
              + Add Universe
            </button>
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
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted w-16">Logo</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Tag</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted w-16">Accent</th>
                    <th className="text-left px-4 py-3 font-medium text-hos-text-muted w-20">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-hos-text-muted w-36">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-hos-text-muted">
                        No universes yet
                      </td>
                    </tr>
                  ) : (
                    sorted.map((item, idx) => (
                      <tr key={item.id} className="border-b border-hos-border/50 hover:bg-hos-bg-tertiary/30">
                        <td className="px-4 py-3 text-hos-text-muted">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveItem(idx, -1)}
                              disabled={idx === 0}
                              className="text-xs disabled:opacity-20 hover:text-hos-gold"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveItem(idx, 1)}
                              disabled={idx === sorted.length - 1}
                              className="text-xs disabled:opacity-20 hover:text-hos-gold"
                            >
                              ▼
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.logo ? (
                            <img
                              src={item.logo}
                              alt=""
                              className="w-10 h-10 rounded-full object-cover border border-hos-border bg-hos-bg"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-hos-bg-tertiary border border-hos-border" />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-hos-text-primary">
                          {item.name}
                          {item.featured && (
                            <span className="ml-2 text-xs text-hos-gold">★ Featured</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-hos-text-muted">{item.tag || '—'}</td>
                        <td className="px-4 py-3">
                          {item.accentColor ? (
                            <span
                              className="inline-block w-6 h-6 rounded border border-hos-border"
                              style={{ backgroundColor: item.accentColor }}
                              title={item.accentColor}
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.isActive
                                ? 'bg-green-900/30 text-green-400'
                                : 'bg-red-900/30 text-red-400'
                            }`}
                          >
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

          {showForm && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-hos-bg-secondary border border-hos-border rounded-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold text-hos-text-primary">
                  {editingId ? 'Edit Universe' : 'New Universe'}
                </h2>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">Name *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                    placeholder="e.g. Marvel"
                  />
                </div>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">Tag line</label>
                  <input
                    value={formData.tag}
                    onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                    className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                    placeholder="e.g. Superhero Universe"
                  />
                </div>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                    placeholder="Short description for the universe tile"
                  />
                </div>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">Logo</label>
                  {formData.logo && (
                    <div className="mb-2 flex items-center gap-3">
                      <img
                        src={formData.logo}
                        alt="Logo preview"
                        className="w-12 h-12 rounded-full object-cover border border-hos-border"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, logo: '' })}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  <FileUpload
                    folder="universes"
                    onUploadComplete={(url) => setFormData({ ...formData, logo: url })}
                  />
                  <input
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    className="mt-2 w-full bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary"
                    placeholder="Or paste logo URL"
                  />
                </div>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-1">Accent color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.accentColor}
                      onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      className="w-10 h-10 rounded border border-hos-border bg-transparent cursor-pointer"
                    />
                    <input
                      value={formData.accentColor}
                      onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      className="flex-1 bg-hos-bg border border-hos-border rounded-lg px-3 py-2 text-sm text-hos-text-primary font-mono"
                      placeholder="#C9A84C"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-hos-text-muted mb-2">Gradient colors (5 stops)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    {formData.gradientColors.map((color, index) => (
                      <div key={index} className="space-y-1">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => updateGradientColor(index, e.target.value)}
                          className="w-full h-10 rounded border border-hos-border bg-transparent cursor-pointer"
                        />
                        <input
                          value={color}
                          onChange={(e) => updateGradientColor(index, e.target.value)}
                          className="w-full bg-hos-bg border border-hos-border rounded px-2 py-1 text-xs text-hos-text-primary font-mono"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
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
                      checked={formData.featured}
                      onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                      className="rounded"
                    />
                    Featured
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
      </AdminLayout>
    </RouteGuard>
  );
}
