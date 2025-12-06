'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  level: number;
  path: string;
  description?: string;
  image?: string;
  order: number;
  isActive: boolean;
  children?: Category[];
}

export default function AdminCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
    image: '',
    order: 0,
    isActive: true,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCategoryTree();
      if (response?.data) {
        setCategories(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Determine level based on parent
      let level = 0;
      if (formData.parentId) {
        const findCategory = (cats: Category[], id: string): Category | null => {
          for (const cat of cats) {
            if (cat.id === id) return cat;
            if (cat.children) {
              const found = findCategory(cat.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const parent = findCategory(categories, formData.parentId);
        if (parent) {
          level = parent.level + 1;
          if (level > 2) {
            toast.error('Maximum category depth is 3 levels');
            return;
          }
        }
      }

      await apiClient.createCategory({
        name: formData.name,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
        level,
        image: formData.image || undefined,
        order: formData.order,
        isActive: formData.isActive,
      });
      toast.success('Category created successfully');
      setShowCreateForm(false);
      setFormData({ name: '', description: '', parentId: '', image: '', order: 0, isActive: true });
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    }
  };

  const handleUpdateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      await apiClient.updateCategory(editingCategory.id, {
        name: formData.name,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
        image: formData.image || undefined,
        order: formData.order,
        isActive: formData.isActive,
      });
      toast.success('Category updated successfully');
      setEditingCategory(null);
      setFormData({ name: '', description: '', parentId: '', image: '', order: 0, isActive: true });
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return;
    }
    try {
      await apiClient.deleteCategory(id);
      toast.success('Category deleted successfully');
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      image: category.image || '',
      order: category.order,
      isActive: category.isActive,
    });
    setShowCreateForm(true);
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingCategory(null);
    setFormData({ name: '', description: '', parentId: '', image: '', order: 0, isActive: true });
  };

  const renderCategoryTree = (cats: Category[], level: number = 0): JSX.Element[] => {
    return cats.map((category) => (
      <div key={category.id} className="ml-4">
        <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">{category.name}</span>
              <span className="text-xs text-gray-500">(Level {category.level})</span>
              {!category.isActive && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Inactive</span>
              )}
            </div>
            {category.description && (
              <div className="text-sm text-gray-600 mt-1">{category.description}</div>
            )}
            <div className="text-xs text-gray-500 mt-1">Path: {category.path}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startEdit(category)}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={() => handleDeleteCategory(category.id)}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div className="mt-2">{renderCategoryTree(category.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  const getAllCategoriesFlat = (cats: Category[]): Category[] => {
    const result: Category[] = [];
    const traverse = (items: Category[]) => {
      for (const item of items) {
        result.push(item);
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      }
    };
    traverse(cats);
    return result;
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading categories...</div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Categories & Tags</h1>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingCategory(null);
                setFormData({ name: '', description: '', parentId: '', image: '', order: 0, isActive: true });
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + Add Category
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h2>
              <form
                onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Category name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Category description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
                    <select
                      value={formData.parentId}
                      onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">None (Root Category)</option>
                      {getAllCategoriesFlat(categories)
                        .filter((cat) => !editingCategory || cat.id !== editingCategory.id)
                        .filter((cat) => cat.level < 2) // Can only have 3 levels max
                        .map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {'  '.repeat(cat.level)} {cat.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  <div className="flex items-center pt-6">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    {editingCategory ? 'Update Category' : 'Create Category'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelForm}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Category Tree</h2>
              <p className="text-sm text-gray-600 mt-1">
                Categories are organized in a 3-level hierarchy (Category → Subcategory → Product Type)
              </p>
            </div>
            <div className="p-4">
              {categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No categories found. Create your first category to get started.
                </div>
              ) : (
                <div className="space-y-2">{renderCategoryTree(categories)}</div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
