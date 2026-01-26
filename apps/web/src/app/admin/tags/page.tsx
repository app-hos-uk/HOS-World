'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Tag {
  id: string;
  name: string;
  slug: string;
  category: 'THEME' | 'OCCASION' | 'STYLE' | 'CHARACTER' | 'FANDOM' | 'CUSTOM';
  description?: string;
  synonyms: string[];
  isActive: boolean;
  productCount?: number;
  color?: string;
}

interface Stats {
  totalTags: number;
  activeTags: number;
  inactiveTags: number;
  totalProducts: number;
  tagsByCategory: Record<string, number>;
  mostUsedTag?: { name: string; count: number };
  unusedTags: number;
}

const TAG_CATEGORIES = [
  { value: 'THEME', label: 'Theme', icon: '🎨', color: 'purple', description: 'Visual themes like Dark, Colorful, Minimalist' },
  { value: 'OCCASION', label: 'Occasion', icon: '🎉', color: 'pink', description: 'Events like Christmas, Birthday, Halloween' },
  { value: 'STYLE', label: 'Style', icon: '✨', color: 'blue', description: 'Product styles like Vintage, Modern, Classic' },
  { value: 'CHARACTER', label: 'Character', icon: '🧙', color: 'green', description: 'Specific characters like Harry Potter, Darth Vader' },
  { value: 'FANDOM', label: 'Fandom', icon: '⚡', color: 'yellow', description: 'Franchises like Marvel, Star Wars, Disney' },
  { value: 'CUSTOM', label: 'Custom', icon: '🏷️', color: 'gray', description: 'Custom tags for specific needs' },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  THEME: 'bg-purple-100 text-purple-800 border-purple-200',
  OCCASION: 'bg-pink-100 text-pink-800 border-pink-200',
  STYLE: 'bg-blue-100 text-blue-800 border-blue-200',
  CHARACTER: 'bg-green-100 text-green-800 border-green-200',
  FANDOM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CUSTOM: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function AdminTagsPage() {
  const toast = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'usage'>('name');
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'THEME' as Tag['category'],
    description: '',
    synonyms: '',
    isActive: true,
    color: '',
  });

  const [bulkData, setBulkData] = useState({
    category: 'THEME' as Tag['category'],
    tags: '',
  });

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch all tags (including inactive for admin)
      const response = await apiClient.getTags({});
      if (response?.data && Array.isArray(response.data)) {
        setTags(response.data);
        calculateStats(response.data);
      } else {
        setTags([]);
      }
    } catch (err: any) {
      console.error('Error fetching tags:', err);
      setError(err.message || 'Failed to load tags');
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (tagList: Tag[]) => {
    const active = tagList.filter(t => t.isActive);
    const inactive = tagList.filter(t => !t.isActive);
    const totalProducts = tagList.reduce((sum, t) => sum + (t.productCount || 0), 0);
    const unused = tagList.filter(t => !t.productCount || t.productCount === 0);
    
    const byCategory: Record<string, number> = {};
    for (const cat of TAG_CATEGORIES) {
      byCategory[cat.value] = tagList.filter(t => t.category === cat.value).length;
    }
    
    const mostUsed = tagList.reduce((max, t) => 
      (t.productCount || 0) > (max?.count || 0) ? { name: t.name, count: t.productCount || 0 } : max,
      null as { name: string; count: number } | null
    );

    setStats({
      totalTags: tagList.length,
      activeTags: active.length,
      inactiveTags: inactive.length,
      totalProducts,
      tagsByCategory: byCategory,
      mostUsedTag: mostUsed || undefined,
      unusedTags: unused.length,
    });
  };

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const synonyms = formData.synonyms
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      await apiClient.createTag({
        name: formData.name,
        category: formData.category,
        description: formData.description || undefined,
        synonyms: synonyms.length > 0 ? synonyms : undefined,
        isActive: formData.isActive,
      });
      toast.success('Tag created successfully');
      resetForm();
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create tag');
    }
  };

  const handleUpdateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;
    try {
      const synonyms = formData.synonyms
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      await apiClient.updateTag(editingTag.id, {
        name: formData.name,
        category: formData.category,
        description: formData.description || undefined,
        synonyms: synonyms.length > 0 ? synonyms : undefined,
        isActive: formData.isActive,
      });
      toast.success('Tag updated successfully');
      resetForm();
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tag');
    }
  };

  const handleDeleteTag = async (id: string, name: string) => {
    const tag = tags.find(t => t.id === id);
    if ((tag?.productCount || 0) > 0) {
      if (!confirm(`"${name}" is used by ${tag?.productCount} products. Delete anyway?`)) return;
    } else if (!confirm(`Delete "${name}"?`)) return;
    
    try {
      await apiClient.deleteTag(id);
      toast.success('Tag deleted');
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete tag');
    }
  };

  const handleBulkCreate = async () => {
    const tagNames = bulkData.tags
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    if (tagNames.length === 0) {
      toast.error('Please enter tag names');
      return;
    }

    let success = 0;
    let failed = 0;

    for (const name of tagNames) {
      try {
        await apiClient.createTag({
          name,
          category: bulkData.category,
          isActive: true,
        });
        success++;
      } catch {
        failed++;
      }
    }

    toast.success(`Created ${success} tags${failed > 0 ? `, ${failed} failed` : ''}`);
    setBulkData({ category: 'THEME', tags: '' });
    setShowBulkCreate(false);
    fetchTags();
  };

  const handleBulkDelete = async () => {
    if (selectedTags.size === 0) return;
    if (!confirm(`Delete ${selectedTags.size} selected tags?`)) return;

    let success = 0;
    for (const id of selectedTags) {
      try {
        await apiClient.deleteTag(id);
        success++;
      } catch {
        // Continue on error
      }
    }

    toast.success(`Deleted ${success} tags`);
    setSelectedTags(new Set());
    fetchTags();
  };

  const handleBulkToggleActive = async (activate: boolean) => {
    if (selectedTags.size === 0) return;

    let success = 0;
    for (const id of selectedTags) {
      try {
        await apiClient.updateTag(id, { isActive: activate });
        success++;
      } catch {
        // Continue on error
      }
    }

    toast.success(`Updated ${success} tags`);
    setSelectedTags(new Set());
    fetchTags();
  };

  const handleMergeTags = async (targetId: string) => {
    if (selectedTags.size < 2) {
      toast.error('Select at least 2 tags to merge');
      return;
    }

    const targetTag = tags.find(t => t.id === targetId);
    if (!targetTag) return;

    // Collect all synonyms from selected tags
    const allSynonyms = new Set(targetTag.synonyms || []);
    for (const id of selectedTags) {
      if (id === targetId) continue;
      const tag = tags.find(t => t.id === id);
      if (tag) {
        allSynonyms.add(tag.name);
        tag.synonyms?.forEach(s => allSynonyms.add(s));
      }
    }

    try {
      // Update target with all synonyms
      await apiClient.updateTag(targetId, {
        synonyms: Array.from(allSynonyms),
      });

      // Delete other tags
      for (const id of selectedTags) {
        if (id !== targetId) {
          await apiClient.deleteTag(id);
        }
      }

      toast.success(`Merged ${selectedTags.size} tags into "${targetTag.name}"`);
      setSelectedTags(new Set());
      setShowMergeModal(false);
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to merge tags');
    }
  };

  const handleDuplicateTag = async (tag: Tag) => {
    try {
      await apiClient.createTag({
        name: `${tag.name} (Copy)`,
        category: tag.category,
        description: tag.description,
        synonyms: tag.synonyms,
        isActive: false,
      });
      toast.success('Tag duplicated');
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate');
    }
  };

  const startEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      category: tag.category,
      description: tag.description || '',
      synonyms: tag.synonyms.join(', '),
      isActive: tag.isActive,
      color: tag.color || '',
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setShowCreateForm(false);
    setEditingTag(null);
    setFormData({
      name: '',
      category: 'THEME',
      description: '',
      synonyms: '',
      isActive: true,
      color: '',
    });
  };

  const toggleTagSelection = (id: string) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const visibleIds = filteredTags.map(t => t.id);
    setSelectedTags(new Set(visibleIds));
  };

  const clearSelection = () => {
    setSelectedTags(new Set());
  };

  // Filtered and sorted tags
  const filteredTags = useMemo(() => {
    let filtered = [...tags];

    // Category filter
    if (filterCategory !== 'ALL') {
      filtered = filtered.filter(t => t.category === filterCategory);
    }

    // Active filter
    if (!showInactive) {
      filtered = filtered.filter(t => t.isActive);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.synonyms.some(s => s.toLowerCase().includes(query))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case 'usage':
          return (b.productCount || 0) - (a.productCount || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [tags, filterCategory, showInactive, searchQuery, sortBy]);

  const getCategoryInfo = (category: string) => TAG_CATEGORIES.find(c => c.value === category);

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
              <h1 className="text-2xl font-bold text-gray-900">Product Tags</h1>
              <p className="text-gray-600 mt-1">Organize products with searchable tags</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkCreate(true)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Bulk Create
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setEditingTag(null);
                  resetForm();
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                + Add Tag
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Total Tags</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalTags}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.activeTags}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-gray-400">{stats.inactiveTags}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Products Tagged</p>
                <p className="text-2xl font-bold text-blue-600">{stats.totalProducts}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Unused Tags</p>
                <p className="text-2xl font-bold text-orange-600">{stats.unusedTags}</p>
              </div>
              {stats.mostUsedTag && (
                <div className="bg-white rounded-lg shadow p-4 col-span-2">
                  <p className="text-sm text-gray-600">Most Used</p>
                  <p className="text-lg font-bold text-pink-600 truncate">{stats.mostUsedTag.name}</p>
                  <p className="text-xs text-gray-500">{stats.mostUsedTag.count} products</p>
                </div>
              )}
            </div>
          )}

          {/* Category Distribution */}
          {stats && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Tags by Category</h3>
              <div className="flex flex-wrap gap-3">
                {TAG_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setFilterCategory(filterCategory === cat.value ? 'ALL' : cat.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      filterCategory === cat.value
                        ? CATEGORY_COLORS[cat.value]
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="font-medium">{cat.label}</span>
                    <span className="text-sm opacity-75">({stats.tagsByCategory[cat.value] || 0})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchTags} className="mt-2 text-red-600 hover:text-red-800 text-sm">
                Retry
              </button>
            </div>
          )}

          {/* Filters & Bulk Actions */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tags or synonyms..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="name">Sort by Name</option>
                <option value="category">Sort by Category</option>
                <option value="usage">Sort by Usage</option>
              </select>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span className="text-sm text-gray-700">Show inactive</span>
              </label>
              
              {selectedTags.size > 0 && (
                <div className="flex items-center gap-2 border-l pl-4">
                  <span className="text-sm text-gray-600">{selectedTags.size} selected</span>
                  <button
                    onClick={() => handleBulkToggleActive(true)}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkToggleActive(false)}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => setShowMergeModal(true)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    disabled={selectedTags.size < 2}
                  >
                    Merge
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Create/Edit Form */}
          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                {editingTag ? 'Edit Tag' : 'Create New Tag'}
              </h2>
              <form onSubmit={editingTag ? handleUpdateTag : handleCreateTag} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tag Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., Harry Potter, Christmas, Vintage"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {TAG_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label} - {cat.description}
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
                    placeholder="Optional description"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Synonyms (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.synonyms}
                      onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="e.g., HP, Potter, Wizarding World"
                    />
                    <p className="text-xs text-gray-500 mt-1">Alternative names for search</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color (optional)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.color || '#6b7280'}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="#6b7280"
                      />
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-purple-600"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    {editingTag ? 'Update Tag' : 'Create Tag'}
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

          {/* Tags Grid */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                Tags ({filteredTags.length})
              </h2>
              <button
                onClick={selectAllVisible}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Select All Visible
              </button>
            </div>
            <div className="p-4">
              {filteredTags.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery || filterCategory !== 'ALL'
                    ? 'No tags match your filters'
                    : 'No tags found. Create your first tag to get started.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredTags.map((tag) => {
                    const catInfo = getCategoryInfo(tag.category);
                    return (
                      <div
                        key={tag.id}
                        className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                          selectedTags.has(tag.id) ? 'ring-2 ring-purple-500' : ''
                        } ${!tag.isActive ? 'opacity-60 bg-gray-50' : 'bg-white'}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedTags.has(tag.id)}
                              onChange={() => toggleTagSelection(tag.id)}
                              className="rounded border-gray-300 text-purple-600"
                            />
                            <div className="flex items-center gap-2 min-w-0">
                              {tag.color && (
                                <span 
                                  className="w-4 h-4 rounded-full border"
                                  style={{ backgroundColor: tag.color }}
                                />
                              )}
                              <h3 className="font-medium text-gray-900 truncate">{tag.name}</h3>
                            </div>
                          </label>
                          {!tag.isActive && (
                            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                              Inactive
                            </span>
                          )}
                        </div>
                        
                        <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${CATEGORY_COLORS[tag.category]}`}>
                          <span>{catInfo?.icon}</span>
                          <span>{catInfo?.label}</span>
                        </div>
                        
                        {tag.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{tag.description}</p>
                        )}
                        
                        {tag.synonyms && tag.synonyms.length > 0 && (
                          <div className="mt-2">
                            <div className="flex flex-wrap gap-1">
                              {tag.synonyms.slice(0, 3).map((syn, idx) => (
                                <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                  {syn}
                                </span>
                              ))}
                              {tag.synonyms.length > 3 && (
                                <span className="text-xs text-gray-400">+{tag.synonyms.length - 3}</span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <span className="text-sm text-gray-500">
                            {tag.productCount || 0} products
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDuplicateTag(tag)}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                              title="Duplicate"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => startEdit(tag)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteTag(tag.id, tag.name)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Bulk Create Modal */}
          {showBulkCreate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Bulk Create Tags</h3>
                  <button onClick={() => setShowBulkCreate(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={bulkData.category}
                      onChange={(e) => setBulkData({ ...bulkData, category: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      {TAG_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (one per line)</label>
                    <textarea
                      value={bulkData.tags}
                      onChange={(e) => setBulkData({ ...bulkData, tags: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      rows={8}
                      placeholder="Harry Potter&#10;Hermione Granger&#10;Ron Weasley&#10;..."
                    />
                  </div>
                  <button
                    onClick={handleBulkCreate}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Create Tags
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Merge Modal */}
          {showMergeModal && selectedTags.size >= 2 && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Merge Tags</h3>
                  <button onClick={() => setShowMergeModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                    ×
                  </button>
                </div>
                <p className="text-gray-600 mb-4">
                  Select the target tag to merge others into. Other tags will become synonyms.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {Array.from(selectedTags).map(id => {
                    const tag = tags.find(t => t.id === id);
                    if (!tag) return null;
                    return (
                      <button
                        key={id}
                        onClick={() => handleMergeTags(id)}
                        className="w-full text-left p-3 border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
                      >
                        <span className="font-medium">{tag.name}</span>
                        <span className="text-sm text-gray-500 ml-2">({tag.productCount || 0} products)</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
