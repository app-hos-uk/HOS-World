'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { cmsActionToastMessage, cmsLoadingErrorMessage } from '@/lib/cmsPortalFeedback';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  _count?: { posts: number };
}

export default function BlogCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminBlogCategories();
      setCategories(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      toast.error(cmsLoadingErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const resetForm = () => {
    setForm({ name: '', slug: '', description: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingId) {
        await apiClient.updateBlogCategory(editingId, form);
        toast.success('Category updated');
      } else {
        await apiClient.createBlogCategory(form);
        toast.success('Category created');
      }
      resetForm();
      loadCategories();
    } catch (err) {
      toast.error(cmsActionToastMessage(err, 'Failed to save category'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cat: Category) => {
    setForm({ name: cat.name, slug: cat.slug, description: cat.description || '' });
    setEditingId(cat.id);
    setShowForm(true);
  };

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(`Delete category "${cat.name}"? Posts will be uncategorized.`)) return;
    try {
      await apiClient.deleteBlogCategory(cat.id);
      toast.success('Category deleted');
      loadCategories();
    } catch (err) {
      toast.error(cmsActionToastMessage(err, 'Failed to delete category'));
    }
  };

  return (
    <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
      <CMSLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/cms/blog" className="text-sm text-hos-gold hover:underline">← Back to Blog</Link>
              <h1 className="text-2xl font-bold text-hos-text-secondary mt-1">Blog Categories</h1>
            </div>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
            >
              + Add Category
            </button>
          </div>

          {showForm && (
            <div className="bg-hos-bg-secondary rounded-lg p-6 border border-hos-border">
              <h2 className="text-lg font-semibold mb-4">{editingId ? 'Edit' : 'New'} Category</h2>
              <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                <input
                  type="text"
                  required
                  placeholder="Category name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary"
                />
                <input
                  type="text"
                  placeholder="Slug (auto-generated if empty)"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={saving} className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={resetForm} className="px-4 py-2 border border-hos-border rounded-lg text-hos-text-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-hos-bg-secondary rounded-lg shadow">
            {loading ? (
              <div className="p-8 text-center text-hos-text-muted">Loading...</div>
            ) : categories.length === 0 ? (
              <div className="p-8 text-center text-hos-text-muted">No categories yet.</div>
            ) : (
              <div className="divide-y divide-hos-border">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-hos-text-secondary">{cat.name}</p>
                      <p className="text-sm text-hos-text-secondary">/blog/category/{cat.slug}</p>
                      {cat._count && <p className="text-xs text-hos-text-secondary mt-1">{cat._count.posts} posts</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(cat)} className="px-3 py-1 text-sm text-hos-gold border border-hos-gold/30 rounded">Edit</button>
                      <button onClick={() => handleDelete(cat)} className="px-3 py-1 text-sm text-red-400 border border-red-400/30 rounded">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CMSLayout>
    </RouteGuard>
  );
}
