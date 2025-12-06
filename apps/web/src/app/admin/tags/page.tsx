'use client';

import { useEffect, useState } from 'react';
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
}

const TAG_CATEGORIES = [
  { value: 'THEME', label: 'Theme' },
  { value: 'OCCASION', label: 'Occasion' },
  { value: 'STYLE', label: 'Style' },
  { value: 'CHARACTER', label: 'Character' },
  { value: 'FANDOM', label: 'Fandom' },
  { value: 'CUSTOM', label: 'Custom' },
] as const;

export default function AdminTagsPage() {
  const toast = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    category: 'THEME' as 'THEME' | 'OCCASION' | 'STYLE' | 'CHARACTER' | 'FANDOM' | 'CUSTOM',
    description: '',
    synonyms: '',
    isActive: true,
  });

  useEffect(() => {
    fetchTags();
  }, [filterCategory]);

  const fetchTags = async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: any = { isActive: true };
      if (filterCategory) {
        filters.category = filterCategory;
      }
      const response = await apiClient.getTags(filters);
      if (response?.data) {
        setTags(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching tags:', err);
      setError(err.message || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

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
      setShowCreateForm(false);
      setFormData({
        name: '',
        category: 'THEME',
        description: '',
        synonyms: '',
        isActive: true,
      });
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
      setEditingTag(null);
      setShowCreateForm(false);
      setFormData({
        name: '',
        category: 'THEME',
        description: '',
        synonyms: '',
        isActive: true,
      });
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update tag');
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
      return;
    }
    try {
      await apiClient.deleteTag(id);
      toast.success('Tag deleted successfully');
      fetchTags();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete tag');
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
    });
    setShowCreateForm(true);
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingTag(null);
    setFormData({
      name: '',
      category: 'THEME',
      description: '',
      synonyms: '',
      isActive: true,
    });
  };

  const filteredTags = tags.filter((tag) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tag.name.toLowerCase().includes(query) ||
        tag.description?.toLowerCase().includes(query) ||
        tag.synonyms.some((syn) => syn.toLowerCase().includes(query))
      );
    }
    return true;
  });

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading tags...</div>
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
            <h1 className="text-2xl font-bold text-gray-900">Product Tags</h1>
            <button
              onClick={() => {
                setShowCreateForm(true);
                setEditingTag(null);
                setFormData({
                  name: '',
                  category: 'THEME',
                  description: '',
                  synonyms: '',
                  isActive: true,
                });
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + Add Tag
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
                {editingTag ? 'Edit Tag' : 'Create New Tag'}
              </h2>
              <form
                onSubmit={editingTag ? handleUpdateTag : handleCreateTag}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tag Name</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {TAG_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
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
                  <p className="text-xs text-gray-500 mt-1">
                    Alternative names for this tag (used in search)
                  </p>
                </div>
                <div className="flex items-center">
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
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    {editingTag ? 'Update Tag' : 'Create Tag'}
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
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">All Tags</h2>
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tags..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                  <select
                    value={filterCategory || ''}
                    onChange={(e) => setFilterCategory(e.target.value || null)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">All Categories</option>
                    {TAG_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="p-4">
              {filteredTags.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery || filterCategory
                    ? 'No tags found matching your filters'
                    : 'No tags found. Create your first tag to get started.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{tag.name}</h3>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded mt-1 inline-block">
                            {TAG_CATEGORIES.find((c) => c.value === tag.category)?.label}
                          </span>
                        </div>
                        {!tag.isActive && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {tag.description && (
                        <p className="text-sm text-gray-600 mb-2">{tag.description}</p>
                      )}
                      {tag.synonyms && tag.synonyms.length > 0 && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 mb-1">Synonyms:</p>
                          <div className="flex flex-wrap gap-1">
                            {tag.synonyms.map((syn, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                              >
                                {syn}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => startEdit(tag)}
                          className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="flex-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

