'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Theme {
  id: string;
  name: string;
  description?: string;
  type: 'HOS' | 'SELLER' | 'CUSTOMER';
  isActive: boolean;
  config?: Record<string, unknown>;
  createdAt?: string;
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  HOS: 'bg-purple-500/20 text-purple-400',
  SELLER: 'bg-blue-500/20 text-blue-400',
  CUSTOMER: 'bg-green-500/20 text-green-400',
};

export default function AdminThemesPage() {
  const toast = useToast();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', type: 'HOS' as Theme['type'], isActive: true });
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', type: 'HOS' as Theme['type'], isActive: true });

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchThemes = useCallback(async () => {
    try {
      setLoading(true);
      const filter = typeFilter !== 'ALL' ? typeFilter : undefined;
      const res = await apiClient.getThemes(filter);
      if (res.data) {
        setThemes(res.data as Theme[]);
      }
    } catch {
      toast.error('Failed to load themes');
    } finally {
      setLoading(false);
    }
  }, [toast, typeFilter]);

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    try {
      setCreating(true);
      await apiClient.createTheme({
        name: createForm.name,
        type: createForm.type,
        isActive: createForm.isActive,
      });
      toast.success('Theme created successfully');
      setShowCreate(false);
      setCreateForm({ name: '', type: 'HOS', isActive: true });
      fetchThemes();
    } catch {
      toast.error('Failed to create theme');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (theme: Theme) => {
    setEditingId(theme.id);
    setEditForm({
      name: theme.name,
      description: theme.description || '',
      type: theme.type,
      isActive: theme.isActive,
    });
  };

  const handleUpdate = async (id: string) => {
    try {
      await apiClient.updateTheme(id, {
        name: editForm.name,
        description: editForm.description || undefined,
        type: editForm.type,
        isActive: editForm.isActive,
      });
      toast.success('Theme updated');
      setEditingId(null);
      fetchThemes();
    } catch {
      toast.error('Failed to update theme');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await apiClient.duplicateTheme(id);
      toast.success('Theme duplicated');
      fetchThemes();
    } catch {
      toast.error('Failed to duplicate theme');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.deleteTheme(id);
      toast.success('Theme deleted');
      setDeletingId(null);
      fetchThemes();
    } catch {
      toast.error('Failed to delete theme');
    }
  };

  const filteredThemes = typeFilter === 'ALL' ? themes : themes.filter((t) => t.type === typeFilter);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Themes Management</h1>
          <div className="flex items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-sm text-hos-text-secondary"
            >
              <option value="ALL">All Types</option>
              <option value="HOS">HOS</option>
              <option value="SELLER">Seller</option>
              <option value="CUSTOMER">Customer</option>
            </select>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="px-4 py-2 bg-hos-gold text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              {showCreate ? 'Cancel' : '+ New Theme'}
            </button>
          </div>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Type *</label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm({ ...createForm, type: e.target.value as Theme['type'] })}
                  className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary"
                >
                  <option value="HOS">HOS</option>
                  <option value="SELLER">Seller</option>
                  <option value="CUSTOMER">Customer</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createForm.isActive}
                    onChange={(e) => setCreateForm({ ...createForm, isActive: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-600 peer-checked:bg-hos-gold rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm text-hos-text-secondary">Active</span>
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-hos-gold text-white rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Theme'}
            </button>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" />
          </div>
        ) : filteredThemes.length === 0 ? (
          <div className="text-center py-20 text-hos-text-muted">No themes found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredThemes.map((theme) => (
              <div key={theme.id} className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5 flex flex-col">
                {editingId === theme.id ? (
                  <div className="space-y-3 flex-1">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-sm text-hos-text-secondary"
                      placeholder="Name"
                    />
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-sm text-hos-text-secondary"
                      placeholder="Description"
                    />
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm({ ...editForm, type: e.target.value as Theme['type'] })}
                      className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-sm text-hos-text-secondary"
                    >
                      <option value="HOS">HOS</option>
                      <option value="SELLER">Seller</option>
                      <option value="CUSTOMER">Customer</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.isActive}
                          onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-600 peer-checked:bg-hos-gold rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                      </label>
                      <span className="text-xs text-hos-text-muted">Active</span>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => handleUpdate(theme.id)}
                        className="px-3 py-1.5 bg-hos-gold text-white rounded-lg text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 border border-hos-border text-hos-text-secondary rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-hos-text-secondary">{theme.name}</h3>
                        {theme.description && (
                          <p className="text-xs text-hos-text-muted mt-0.5">{theme.description}</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${theme.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {theme.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="mb-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_BADGE_STYLES[theme.type] || 'bg-gray-500/20 text-gray-400'}`}>
                        {theme.type}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center gap-2 pt-3 border-t border-hos-border">
                      <button
                        onClick={() => startEdit(theme)}
                        className="px-2.5 py-1 text-xs border border-hos-border text-hos-text-muted rounded hover:text-hos-text-secondary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(theme.id)}
                        className="px-2.5 py-1 text-xs border border-hos-border text-hos-text-muted rounded hover:text-hos-text-secondary"
                      >
                        Duplicate
                      </button>
                      {deletingId === theme.id ? (
                        <div className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => handleDelete(theme.id)}
                            className="px-2.5 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="px-2.5 py-1 text-xs border border-hos-border text-hos-text-muted rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingId(theme.id)}
                          className="px-2.5 py-1 text-xs text-red-400 border border-red-400/30 rounded hover:bg-red-500/10 ml-auto"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
