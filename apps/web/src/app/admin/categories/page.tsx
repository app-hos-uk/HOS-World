'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Image from 'next/image';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  level: number;
  path: string;
  description?: string;
  image?: string;
  icon?: string;
  order: number;
  isActive: boolean;
  isFeatured?: boolean;
  productCount?: number;
  children?: Category[];
  metaTitle?: string;
  metaDescription?: string;
}

interface Stats {
  totalCategories: number;
  rootCategories: number;
  activeCategories: number;
  inactiveCategories: number;
  totalProducts: number;
  avgProductsPerCategory: number;
  maxDepth: number;
}

const CATEGORY_ICONS = [
  { value: '🎁', label: 'Gift' },
  { value: '👕', label: 'Clothing' },
  { value: '🎮', label: 'Gaming' },
  { value: '📚', label: 'Books' },
  { value: '🎨', label: 'Art' },
  { value: '🏠', label: 'Home' },
  { value: '⚡', label: 'Electronics' },
  { value: '🎵', label: 'Music' },
  { value: '🎬', label: 'Movies' },
  { value: '🧸', label: 'Toys' },
  { value: '💍', label: 'Jewelry' },
  { value: '🎭', label: 'Collectibles' },
  { value: '🪄', label: 'Magic' },
  { value: '🐉', label: 'Fantasy' },
  { value: '🚀', label: 'Sci-Fi' },
];

export default function AdminCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: '',
    image: '',
    icon: '',
    order: 0,
    isActive: true,
    isFeatured: false,
    metaTitle: '',
    metaDescription: '',
  });

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCategoryTree();
      if (response?.data) {
        setCategories(response.data);
        calculateStats(response.data);
        // Expand all root categories by default
        const rootIds = new Set(response.data.map((c: Category) => c.id));
        setExpandedIds(rootIds);
      }
    } catch (err: any) {
      console.error('Error fetching categories:', err);
      setError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (cats: Category[]) => {
    let total = 0;
    let active = 0;
    let inactive = 0;
    let totalProducts = 0;
    let maxDepth = 0;

    const traverse = (items: Category[], depth: number) => {
      for (const item of items) {
        total++;
        if (item.isActive) active++;
        else inactive++;
        totalProducts += item.productCount || 0;
        maxDepth = Math.max(maxDepth, depth);
        if (item.children) {
          traverse(item.children, depth + 1);
        }
      }
    };

    traverse(cats, 0);

    setStats({
      totalCategories: total,
      rootCategories: cats.length,
      activeCategories: active,
      inactiveCategories: inactive,
      totalProducts,
      avgProductsPerCategory: total > 0 ? Math.round(totalProducts / total) : 0,
      maxDepth,
    });
  };

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let level = 0;
      if (formData.parentId) {
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
        icon: formData.icon || undefined,
        order: formData.order,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
        metaTitle: formData.metaTitle || undefined,
        metaDescription: formData.metaDescription || undefined,
      });
      toast.success('Category created successfully');
      resetForm();
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
        icon: formData.icon || undefined,
        order: formData.order,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
        metaTitle: formData.metaTitle || undefined,
        metaDescription: formData.metaDescription || undefined,
      });
      toast.success('Category updated successfully');
      resetForm();
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const category = findCategory(categories, id);
    if (category?.children && category.children.length > 0) {
      toast.error('Cannot delete category with subcategories. Delete children first.');
      return;
    }
    if ((category?.productCount || 0) > 0) {
      if (!confirm(`This category has ${category?.productCount} products. Are you sure you want to delete it?`)) {
        return;
      }
    } else if (!confirm(`Delete "${name}"? This action cannot be undone.`)) {
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

  const handleDuplicateCategory = async (category: Category) => {
    try {
      await apiClient.createCategory({
        name: `${category.name} (Copy)`,
        description: category.description,
        parentId: category.parentId,
        level: category.level,
        image: category.image,
        icon: category.icon,
        order: category.order + 1,
        isActive: false, // Start as inactive
        isFeatured: false,
      });
      toast.success('Category duplicated successfully');
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate category');
    }
  };

  const handleToggleActive = async (category: Category) => {
    try {
      await apiClient.updateCategory(category.id, {
        isActive: !category.isActive,
      });
      toast.success(`Category ${category.isActive ? 'deactivated' : 'activated'}`);
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update category');
    }
  };

  const handleMoveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    const parent = findParentCategory(categories, categoryId);
    const siblings = parent ? parent.children || [] : categories;
    const index = siblings.findIndex(c => c.id === categoryId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= siblings.length) return;

    try {
      // Swap orders
      await apiClient.updateCategory(siblings[index].id, { order: siblings[newIndex].order });
      await apiClient.updateCategory(siblings[newIndex].id, { order: siblings[index].order });
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reorder category');
    }
  };

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

  const findParentCategory = (cats: Category[], id: string, parent: Category | null = null): Category | null => {
    for (const cat of cats) {
      if (cat.id === id) return parent;
      if (cat.children) {
        const found = findParentCategory(cat.children, id, cat);
        if (found !== null) return found;
      }
    }
    return null;
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parentId || '',
      image: category.image || '',
      icon: category.icon || '',
      order: category.order,
      isActive: category.isActive,
      isFeatured: category.isFeatured || false,
      metaTitle: category.metaTitle || '',
      metaDescription: category.metaDescription || '',
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setShowCreateForm(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      parentId: '',
      image: '',
      icon: '',
      order: 0,
      isActive: true,
      isFeatured: false,
      metaTitle: '',
      metaDescription: '',
    });
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    const traverse = (cats: Category[]) => {
      for (const cat of cats) {
        allIds.add(cat.id);
        if (cat.children) traverse(cat.children);
      }
    };
    traverse(categories);
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
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

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    
    const term = searchTerm.toLowerCase();
    const filterTree = (cats: Category[]): Category[] => {
      return cats.reduce((acc: Category[], cat) => {
        const matches = cat.name.toLowerCase().includes(term) ||
                       cat.description?.toLowerCase().includes(term) ||
                       cat.slug.toLowerCase().includes(term);
        
        const filteredChildren = cat.children ? filterTree(cat.children) : [];
        
        if (matches || filteredChildren.length > 0) {
          acc.push({
            ...cat,
            children: filteredChildren.length > 0 ? filteredChildren : cat.children,
          });
        }
        return acc;
      }, []);
    };
    
    return filterTree(categories);
  }, [categories, searchTerm]);

  const renderCategoryTree = (cats: Category[], level: number = 0): JSX.Element[] => {
    return cats
      .filter(cat => showInactive || cat.isActive)
      .map((category, index, arr) => (
        <div key={category.id} className={level > 0 ? 'ml-6 border-l-2 border-gray-200 pl-4' : ''}>
          <div className={`flex items-center justify-between p-3 bg-white border rounded-lg mb-2 hover:shadow-md transition-shadow ${
            !category.isActive ? 'opacity-60 bg-gray-50' : ''
          } ${category.isFeatured ? 'border-purple-300 bg-purple-50' : 'border-gray-200'}`}>
            <div className="flex items-center gap-3 flex-1">
              {/* Expand/Collapse */}
              {category.children && category.children.length > 0 ? (
                <button
                  onClick={() => toggleExpanded(category.id)}
                  className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700"
                >
                  {expandedIds.has(category.id) ? '▼' : '▶'}
                </button>
              ) : (
                <div className="w-6" />
              )}
              
              {/* Icon/Image */}
              {category.image ? (
                <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                  <Image
                    src={category.image}
                    alt={category.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : category.icon ? (
                <span className="text-2xl">{category.icon}</span>
              ) : (
                <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0">
                  📁
                </div>
              )}
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 truncate">{category.name}</span>
                  <span className="text-xs text-gray-400">L{category.level}</span>
                  {category.isFeatured && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Featured</span>
                  )}
                  {!category.isActive && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Inactive</span>
                  )}
                  {(category.productCount || 0) > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {category.productCount} products
                    </span>
                  )}
                </div>
                {category.description && (
                  <p className="text-sm text-gray-500 truncate">{category.description}</p>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => handleMoveCategory(category.id, 'up')}
                disabled={index === 0}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => handleMoveCategory(category.id, 'down')}
                disabled={index === arr.length - 1}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                title="Move down"
              >
                ↓
              </button>
              <button
                onClick={() => handleToggleActive(category)}
                className={`p-1 rounded ${category.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                title={category.isActive ? 'Deactivate' : 'Activate'}
              >
                {category.isActive ? '✓' : '○'}
              </button>
              <button
                onClick={() => handleDuplicateCategory(category)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded"
                title="Duplicate"
              >
                📋
              </button>
              <button
                onClick={() => startEdit(category)}
                className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteCategory(category.id, category.name)}
                className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
          
          {/* Children */}
          {category.children && category.children.length > 0 && expandedIds.has(category.id) && (
            <div className="mt-1">
              {renderCategoryTree(category.children, level + 1)}
            </div>
          )}
        </div>
      ));
  };

  const renderCategoryGrid = (cats: Category[]): JSX.Element[] => {
    const allCats = getAllCategoriesFlat(cats).filter(c => showInactive || c.isActive);
    
    return allCats.map(category => (
      <div
        key={category.id}
        className={`bg-white border rounded-lg p-4 hover:shadow-lg transition-shadow ${
          !category.isActive ? 'opacity-60' : ''
        } ${category.isFeatured ? 'border-purple-300' : 'border-gray-200'}`}
      >
        <div className="flex items-start gap-3">
          {category.image ? (
            <div className="w-16 h-16 rounded overflow-hidden bg-gray-100 flex-shrink-0">
              <Image
                src={category.image}
                alt={category.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
              {category.icon || '📁'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{category.name}</h3>
            <p className="text-xs text-gray-500">{category.path}</p>
            {category.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{category.description}</p>
            )}
            <div className="flex flex-wrap gap-1 mt-2">
              {category.isFeatured && (
                <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Featured</span>
              )}
              {!category.isActive && (
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">Inactive</span>
              )}
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                {category.productCount || 0} products
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => startEdit(category)}
            className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => handleDeleteCategory(category.id, category.name)}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Categories</h1>
              <p className="text-gray-600 mt-1">Organize products in a 3-level hierarchy</p>
            </div>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingCategory(null);
                setFormData({
                  name: '', description: '', parentId: '', image: '', icon: '',
                  order: 0, isActive: true, isFeatured: false, metaTitle: '', metaDescription: '',
                });
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <span>+</span> Add Category
            </button>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalCategories}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Root</p>
                <p className="text-2xl font-bold text-blue-600">{stats.rootCategories}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeCategories}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-400">{stats.inactiveCategories}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Products</p>
                <p className="text-2xl font-bold text-orange-600">{stats.totalProducts}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Avg/Category</p>
                <p className="text-2xl font-bold text-indigo-600">{stats.avgProductsPerCategory}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Max Depth</p>
                <p className="text-2xl font-bold text-pink-600">{stats.maxDepth + 1}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchCategories} className="mt-2 text-red-600 hover:text-red-800 text-sm">
                Retry
              </button>
            </div>
          )}

          {/* Filters & Controls */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search categories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span className="text-sm text-gray-700">Show inactive</span>
              </label>
              <div className="flex items-center gap-2 border-l pl-4">
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-3 py-1 rounded ${viewMode === 'tree' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  🌲 Tree
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1 rounded ${viewMode === 'grid' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}
                >
                  ⊞ Grid
                </button>
              </div>
              {viewMode === 'tree' && (
                <div className="flex items-center gap-2 border-l pl-4">
                  <button onClick={expandAll} className="text-sm text-purple-600 hover:text-purple-800">
                    Expand All
                  </button>
                  <button onClick={collapseAll} className="text-sm text-purple-600 hover:text-purple-800">
                    Collapse All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </h2>
              <form onSubmit={editingCategory ? handleUpdateCategory : handleCreateCategory} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
                    <select
                      value={formData.parentId}
                      onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">None (Root Category)</option>
                      {getAllCategoriesFlat(categories)
                        .filter((cat) => !editingCategory || cat.id !== editingCategory.id)
                        .filter((cat) => cat.level < 2)
                        .map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {'  '.repeat(cat.level)}└ {cat.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    placeholder="Category description"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">No icon</option>
                      {CATEGORY_ICONS.map(icon => (
                        <option key={icon.value} value={icon.value}>
                          {icon.value} {icon.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                    <input
                      type="number"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title</label>
                    <input
                      type="text"
                      value={formData.metaTitle}
                      onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="SEO meta title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SEO Description</label>
                    <input
                      type="text"
                      value={formData.metaDescription}
                      onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="SEO meta description"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                  <label className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="checkbox"
                      checked={formData.isFeatured}
                      onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                      className="rounded border-gray-300 text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Featured</span>
                  </label>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    {editingCategory ? 'Update Category' : 'Create Category'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Categories Display */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">
                {viewMode === 'tree' ? 'Category Tree' : 'All Categories'} ({getAllCategoriesFlat(filteredCategories).length})
              </h2>
            </div>
            <div className="p-4">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No categories match your search.' : 'No categories found. Create your first category to get started.'}
                </div>
              ) : viewMode === 'tree' ? (
                <div className="space-y-2">{renderCategoryTree(filteredCategories)}</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {renderCategoryGrid(filteredCategories)}
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
