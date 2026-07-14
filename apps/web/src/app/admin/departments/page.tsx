'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Department {
  id: string;
  name: string;
  slug: string;
  description?: string;
  meta?: string;
  ctaText?: string;
  ctaUrl: string;
  iconSvg?: string;
  image?: string;
  order: number;
  isActive: boolean;
  categoryId?: string;
  category?: { id: string; name: string; slug: string };
}

interface Category {
  id: string;
  name: string;
  slug: string;
  level: number;
  children?: Category[];
}

const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  meta: '',
  ctaText: '',
  ctaUrl: '',
  iconSvg: '',
  image: '',
  order: 0,
  isActive: true,
  categoryId: '',
};

export default function AdminDepartmentsPage() {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAllDepartments();
      if (res?.data) setDepartments(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.getCategoryTree();
      if (res?.data) setCategories(res.data);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
    fetchCategories();
  }, [fetchDepartments, fetchCategories]);

  const flatCategories = flattenCategories(categories);

  function flattenCategories(cats: Category[], depth = 0): { id: string; label: string }[] {
    const result: { id: string; label: string }[] = [];
    for (const cat of cats) {
      result.push({ id: cat.id, label: '\u00A0'.repeat(depth * 3) + cat.name });
      if (cat.children?.length) result.push(...flattenCategories(cat.children, depth + 1));
    }
    return result;
  }

  function openCreate() {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(dept: Department) {
    setEditingId(dept.id);
    setFormData({
      name: dept.name,
      slug: dept.slug,
      description: dept.description || '',
      meta: dept.meta || '',
      ctaText: dept.ctaText || '',
      ctaUrl: dept.ctaUrl,
      iconSvg: dept.iconSvg || '',
      image: dept.image || '',
      order: dept.order,
      isActive: dept.isActive,
      categoryId: dept.categoryId || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.name.trim() || !formData.ctaUrl.trim()) {
      toast.error('Name and CTA URL are required');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...formData,
        categoryId: formData.categoryId || undefined,
        slug: formData.slug || undefined,
      };
      if (editingId) {
        await apiClient.updateDepartment(editingId, payload);
        toast.success('Department updated');
      } else {
        await apiClient.createDepartment(payload as any);
        toast.success('Department created');
      }
      setShowForm(false);
      setEditingId(null);
      await fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this department? This cannot be undone.')) return;
    try {
      await apiClient.deleteDepartment(id);
      toast.success('Department deleted');
      await fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  }

  async function handleToggleActive(dept: Department) {
    try {
      await apiClient.updateDepartment(dept.id, { isActive: !dept.isActive });
      await fetchDepartments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  async function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const reordered = [...departments];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setDepartments(reordered);
    setDragIdx(null);
    try {
      await apiClient.reorderDepartments(reordered.map((d) => d.id));
    } catch (err: any) {
      toast.error('Failed to reorder');
      await fetchDepartments();
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-display text-hos-gold">Departments</h1>
              <p className="text-hos-text-secondary text-sm mt-1">
                Manage storefront departments shown in &quot;Browse by department&quot;
              </p>
            </div>
            <button onClick={openCreate} className="btn btn-primary text-sm">
              + New Department
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-hos-card border border-hos-border rounded-lg p-4">
              <p className="text-hos-text-secondary text-xs uppercase tracking-wider">Total</p>
              <p className="text-2xl font-bold text-hos-gold mt-1">{departments.length}</p>
            </div>
            <div className="bg-hos-card border border-hos-border rounded-lg p-4">
              <p className="text-hos-text-secondary text-xs uppercase tracking-wider">Active</p>
              <p className="text-2xl font-bold text-green-400 mt-1">
                {departments.filter((d) => d.isActive).length}
              </p>
            </div>
            <div className="bg-hos-card border border-hos-border rounded-lg p-4">
              <p className="text-hos-text-secondary text-xs uppercase tracking-wider">Inactive</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {departments.filter((d) => !d.isActive).length}
              </p>
            </div>
          </div>

          {/* Department List */}
          {loading ? (
            <div className="text-center py-12 text-hos-text-secondary">Loading departments...</div>
          ) : departments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-hos-text-secondary mb-4">No departments yet.</p>
              <button onClick={openCreate} className="btn btn-primary text-sm">
                Create your first department
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-hos-text-secondary mb-2">
                Drag rows to reorder. Order determines display position on the storefront.
              </p>
              {departments.map((dept, idx) => (
                <div
                  key={dept.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx)}
                  className={`bg-hos-card border rounded-lg p-4 flex items-center gap-4 transition-all cursor-grab active:cursor-grabbing ${
                    dept.isActive ? 'border-hos-border' : 'border-hos-border/50 opacity-60'
                  } ${dragIdx === idx ? 'ring-2 ring-hos-gold/40' : ''}`}
                >
                  {/* Drag handle */}
                  <span className="text-hos-text-secondary text-lg select-none">⠿</span>

                  {/* Icon preview */}
                  <div className="w-10 h-10 flex items-center justify-center text-hos-gold shrink-0">
                    {dept.iconSvg ? (
                      <span dangerouslySetInnerHTML={{ __html: dept.iconSvg }} />
                    ) : (
                      <span className="text-2xl">📦</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-hos-text truncate">{dept.name}</h3>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-semibold ${
                          dept.isActive
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {dept.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-hos-text-secondary truncate mt-0.5">
                      {dept.meta && <span className="text-hos-gold-dim">{dept.meta}</span>}
                      {dept.meta && dept.ctaUrl && <span className="mx-1">·</span>}
                      <span>{dept.ctaUrl}</span>
                      {dept.category && (
                        <span className="ml-2 text-hos-gold/60">→ {dept.category.name}</span>
                      )}
                    </p>
                  </div>

                  {/* Order badge */}
                  <span className="text-xs text-hos-text-secondary bg-hos-bg px-2 py-1 rounded font-mono">
                    #{dept.order}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(dept)}
                      className="p-2 text-sm hover:bg-hos-border/30 rounded transition-colors"
                      title={dept.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {dept.isActive ? '👁️' : '👁️‍🗨️'}
                    </button>
                    <button
                      onClick={() => openEdit(dept)}
                      className="p-2 text-sm hover:bg-hos-border/30 rounded transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(dept.id)}
                      className="p-2 text-sm hover:bg-red-500/10 text-red-400 rounded transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create/Edit Modal */}
          {showForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-hos-card border border-hos-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-hos-card border-b border-hos-border px-6 py-4 flex items-center justify-between z-10">
                  <h2 className="text-lg font-display text-hos-gold">
                    {editingId ? 'Edit Department' : 'New Department'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                    className="text-hos-text-secondary hover:text-hos-text text-xl"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Name & Slug */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Collectibles & replicas"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Slug
                      </label>
                      <input
                        type="text"
                        value={formData.slug}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        placeholder="Auto-generated from name"
                        className="input w-full"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Short description shown on the department card"
                      rows={2}
                      className="input w-full"
                    />
                  </div>

                  {/* Meta & CTA */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Meta / Subtitle
                      </label>
                      <input
                        type="text"
                        value={formData.meta}
                        onChange={(e) => setFormData({ ...formData, meta: e.target.value })}
                        placeholder="e.g. 2.4k+ listings · props & figures"
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        CTA Label
                      </label>
                      <input
                        type="text"
                        value={formData.ctaText}
                        onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                        placeholder="e.g. Shop collectibles"
                        className="input w-full"
                      />
                    </div>
                  </div>

                  {/* CTA URL */}
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      CTA URL *
                    </label>
                    <input
                      type="text"
                      value={formData.ctaUrl}
                      onChange={(e) => setFormData({ ...formData, ctaUrl: e.target.value })}
                      placeholder="/products?category=collectibles"
                      className="input w-full"
                    />
                  </div>

                  {/* Linked Category */}
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Linked Category (optional)
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="select w-full"
                    >
                      <option value="">— None —</option>
                      {flatCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Icon SVG */}
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Icon (SVG markup)
                    </label>
                    <textarea
                      value={formData.iconSvg}
                      onChange={(e) => setFormData({ ...formData, iconSvg: e.target.value })}
                      placeholder='<svg viewBox="0 0 64 64" ...>...</svg>'
                      rows={3}
                      className="input w-full font-mono text-xs"
                    />
                    {formData.iconSvg && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-hos-text-secondary">Preview:</span>
                        <span
                          className="text-hos-gold"
                          dangerouslySetInnerHTML={{ __html: formData.iconSvg }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Image URL */}
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Image URL (optional)
                    </label>
                    <input
                      type="text"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder="https://res.cloudinary.com/..."
                      className="input w-full"
                    />
                  </div>

                  {/* Order & Active */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Display Order
                      </label>
                      <input
                        type="number"
                        value={formData.order}
                        onChange={(e) =>
                          setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                        }
                        className="input w-full"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) =>
                            setFormData({ ...formData, isActive: e.target.checked })
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-hos-text">Active (visible on storefront)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-hos-card border-t border-hos-border px-6 py-4 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                    className="btn btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm">
                    {saving ? 'Saving...' : editingId ? 'Update Department' : 'Create Department'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
