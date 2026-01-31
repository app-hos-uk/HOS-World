'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';

interface Theme {
  id: string;
  name: string;
  type: string;
  description?: string;
  version: number;
  versionString?: string;
  isActive: boolean;
  previewImages?: string[];
  assets?: any;
  metadata?: any;
  usageCount?: number;
  sellersUsing?: Array<{ id: string; storeName: string }>;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  hos: number;
  seller: number;
  customer: number;
  active: number;
  inactive: number;
  mostUsed: Theme | null;
}

const THEME_TYPES = [
  { value: 'HOS', label: 'HOS', color: '#8b5cf6' },
  { value: 'SELLER', label: 'Seller', color: '#3b82f6' },
  { value: 'CUSTOMER', label: 'Customer', color: '#10b981' },
];

const CHART_COLORS = ['#8b5cf6', '#3b82f6', '#10b981'];

export default function AdminThemesPage() {
  const toast = useToast();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'HOS' | 'SELLER' | 'CUSTOMER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'usage' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modals
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Bulk selection
  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    name: '',
    description: '',
    type: 'SELLER',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    type: 'SELLER',
  });

  const fetchThemes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getThemes();
      if (response?.data) {
        const themeList = Array.isArray(response.data) ? response.data : [];
        setThemes(themeList);
        calculateStats(themeList);
      }
    } catch (err: any) {
      console.error('Error fetching themes:', err);
      toast.error(err.message || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calculateStats = (themeList: Theme[]) => {
    const mostUsed = themeList.reduce((max, t) => 
      (t.usageCount || 0) > (max?.usageCount || 0) ? t : max, 
      themeList[0] || null
    );

    setStats({
      total: themeList.length,
      hos: themeList.filter(t => t.type === 'HOS').length,
      seller: themeList.filter(t => t.type === 'SELLER').length,
      customer: themeList.filter(t => t.type === 'CUSTOMER').length,
      active: themeList.filter(t => t.isActive).length,
      inactive: themeList.filter(t => !t.isActive).length,
      mostUsed,
    });
  };

  useEffect(() => {
    fetchThemes();
  }, [fetchThemes]);

  // Filtered and sorted themes
  const filteredThemes = useMemo(() => {
    let result = [...themes];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term)
      );
    }

    // Type filter
    if (filter !== 'ALL') {
      result = result.filter(t => t.type === filter);
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      result = result.filter(t => statusFilter === 'ACTIVE' ? t.isActive : !t.isActive);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'usage':
          comparison = (a.usageCount || 0) - (b.usageCount || 0);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [themes, searchTerm, filter, statusFilter, sortBy, sortOrder]);

  // Chart data
  const chartData = useMemo(() => {
    return THEME_TYPES.map(t => ({
      name: t.label,
      value: themes.filter(theme => theme.type === t.value).length,
      color: t.color,
    })).filter(d => d.value > 0);
  }, [themes]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadForm({ ...uploadForm, file: e.target.files[0] });
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file) {
      toast.error('Please select a theme file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      if (uploadForm.name) formData.append('name', uploadForm.name);
      if (uploadForm.description) formData.append('description', uploadForm.description);
      formData.append('type', uploadForm.type);

      await toast.promise(
        fetch(`${getPublicApiBaseUrl() || 'http://localhost:3001/api'}/themes/upload`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: formData,
        }).then((res) => {
          if (!res.ok) throw new Error('Upload failed');
          return res.json();
        }),
        {
          loading: 'Uploading theme...',
          success: 'Theme uploaded successfully',
          error: (err) => err.message || 'Failed to upload theme',
        }
      );

      setShowUploadModal(false);
      setUploadForm({ file: null, name: '', description: '', type: 'SELLER' });
      await fetchThemes();
    } catch (err: any) {
      console.error('Error uploading theme:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (theme: Theme) => {
    setSelectedTheme(theme);
    setEditForm({
      name: theme.name,
      description: theme.description || '',
      type: theme.type,
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedTheme) return;

    try {
      setActionLoading(true);
      await apiClient.updateTheme(selectedTheme.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        type: editForm.type,
      });
      toast.success('Theme updated successfully');
      setShowEditModal(false);
      await fetchThemes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update theme');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (theme: Theme) => {
    // TODO: Implement theme duplication when backend supports it
    toast.error('Theme duplication is not yet supported by the API');
  };

  const handleToggleActive = async (theme: Theme) => {
    try {
      await toast.promise(
        apiClient.updateTheme(theme.id, { isActive: !theme.isActive }),
        {
          loading: `${theme.isActive ? 'Deactivating' : 'Activating'} theme...`,
          success: `Theme ${theme.isActive ? 'deactivated' : 'activated'} successfully`,
          error: (err) => err.message || 'Failed to update theme',
        }
      );
      await fetchThemes();
    } catch (err: any) {
      console.error('Error updating theme:', err);
    }
  };

  const handleDelete = async (theme: Theme) => {
    if (!confirm(`Are you sure you want to delete "${theme.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await toast.promise(
        apiClient.deleteTheme(theme.id),
        {
          loading: 'Deleting theme...',
          success: 'Theme deleted successfully',
          error: (err) => err.message || 'Failed to delete theme',
        }
      );
      await fetchThemes();
    } catch (err: any) {
      console.error('Error deleting theme:', err);
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedThemes.size === 0) {
      toast.error('No themes selected');
      return;
    }

    if (action === 'delete' && !confirm(`Delete ${selectedThemes.size} themes? This cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      for (const id of selectedThemes) {
        if (action === 'delete') {
          await apiClient.deleteTheme(id);
        } else {
          await apiClient.updateTheme(id, { isActive: action === 'activate' });
        }
      }
      toast.success(`${selectedThemes.size} themes ${action}d successfully`);
      setSelectedThemes(new Set());
      await fetchThemes();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} themes`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreview = (theme: Theme) => {
    setSelectedTheme(theme);
    setShowPreviewModal(true);
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedThemes);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedThemes(newSelection);
  };

  const selectAll = () => {
    if (selectedThemes.size === filteredThemes.length) {
      setSelectedThemes(new Set());
    } else {
      setSelectedThemes(new Set(filteredThemes.map(t => t.id)));
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'HOS': return 'bg-purple-100 text-purple-800';
      case 'SELLER': return 'bg-blue-100 text-blue-800';
      case 'CUSTOMER': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportColumns = [
    { key: 'name', header: 'Name' },
    { key: 'type', header: 'Type' },
    { key: 'description', header: 'Description' },
    { key: 'version', header: 'Version', format: (v: number, row: any) => row.versionString || v },
    { key: 'isActive', header: 'Status', format: (v: boolean) => v ? 'Active' : 'Inactive' },
    { key: 'usageCount', header: 'Usage Count', format: (v: number) => v || 0 },
    { key: 'createdAt', header: 'Created', format: (v: string) => new Date(v).toLocaleDateString() },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Theme Management</h1>
              <p className="text-gray-600 mt-1">Upload, manage, and configure themes for sellers</p>
            </div>
            <div className="flex gap-2">
              <DataExport data={filteredThemes} columns={exportColumns} filename="themes-export" />
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                + Upload Theme
              </button>
            </div>
          </div>

          {/* Stats Dashboard */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <button
                onClick={() => { setFilter('ALL'); setStatusFilter('ALL'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${filter === 'ALL' && statusFilter === 'ALL' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-sm text-gray-500">Total Themes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </button>
              <button
                onClick={() => { setFilter('HOS'); setStatusFilter('ALL'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${filter === 'HOS' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-sm text-gray-500">HOS Themes</p>
                <p className="text-2xl font-bold text-purple-600">{stats.hos}</p>
              </button>
              <button
                onClick={() => { setFilter('SELLER'); setStatusFilter('ALL'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${filter === 'SELLER' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-sm text-gray-500">Seller Themes</p>
                <p className="text-2xl font-bold text-blue-600">{stats.seller}</p>
              </button>
              <button
                onClick={() => { setFilter('CUSTOMER'); setStatusFilter('ALL'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${filter === 'CUSTOMER' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-sm text-gray-500">Customer Themes</p>
                <p className="text-2xl font-bold text-green-600">{stats.customer}</p>
              </button>
              <button
                onClick={() => { setFilter('ALL'); setStatusFilter('ACTIVE'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${statusFilter === 'ACTIVE' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
              </button>
              <button
                onClick={() => { setFilter('ALL'); setStatusFilter('INACTIVE'); }}
                className={`bg-white rounded-lg shadow p-4 text-left hover:shadow-md transition-shadow ${statusFilter === 'INACTIVE' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-sm text-gray-500">Inactive</p>
                <p className="text-2xl font-bold text-gray-600">{stats.inactive}</p>
              </button>
            </div>
          )}

          {/* Chart & Most Used */}
          {stats && chartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Themes by Type</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {stats.mostUsed && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Most Popular Theme</h3>
                  <div className="flex items-center gap-4">
                    <div className="relative w-24 h-16 bg-gray-100 rounded-lg overflow-hidden">
                      {stats.mostUsed.previewImages?.[0] ? (
                        <Image src={stats.mostUsed.previewImages[0]} alt="" fill className="object-cover" sizes="96px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🎨</div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{stats.mostUsed.name}</p>
                      <p className="text-sm text-gray-500">
                        Used by {stats.mostUsed.usageCount || 0} sellers
                      </p>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${getTypeBadgeColor(stats.mostUsed.type)}`}>
                        {stats.mostUsed.type}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search & Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name or description..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field as any);
                    setSortOrder(order as any);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="usage-desc">Most Used</option>
                  <option value="type-asc">Type A-Z</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bulk Actions</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkAction('activate')}
                    disabled={selectedThemes.size === 0 || actionLoading}
                    className="flex-1 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    disabled={selectedThemes.size === 0 || actionLoading}
                    className="flex-1 px-3 py-2 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 disabled:opacity-50"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            </div>
            {selectedThemes.size > 0 && (
              <div className="mt-3 flex items-center gap-4">
                <span className="text-sm text-gray-600">{selectedThemes.size} selected</span>
                <button onClick={() => setSelectedThemes(new Set())} className="text-sm text-purple-600 hover:underline">
                  Clear selection
                </button>
                <button onClick={selectAll} className="text-sm text-purple-600 hover:underline">
                  {selectedThemes.size === filteredThemes.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredThemes.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <div className="text-5xl mb-4">🎨</div>
              <p className="text-gray-500 text-lg mb-4">No themes found</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Upload Your First Theme
              </button>
            </div>
          )}

          {/* Theme Grid */}
          {!loading && filteredThemes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredThemes.map((theme) => (
                <div
                  key={theme.id}
                  className={`bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-all ${
                    selectedThemes.has(theme.id) ? 'ring-2 ring-purple-500 border-purple-500' : 'border-gray-200'
                  }`}
                >
                  {/* Selection checkbox */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedThemes.has(theme.id)}
                      onChange={() => toggleSelection(theme.id)}
                      className="h-4 w-4 text-purple-600 rounded border-gray-300"
                    />
                  </div>

                  {/* Preview Image */}
                  <div className="aspect-video bg-gray-100 relative">
                    {theme.previewImages && theme.previewImages.length > 0 ? (
                      <Image src={theme.previewImages[0]} alt={theme.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <div className="text-center">
                          <div className="text-4xl mb-2">🎨</div>
                          <div className="text-sm">No Preview</div>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeBadgeColor(theme.type)}`}>
                        {theme.type}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${theme.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {theme.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {(theme.usageCount ?? 0) > 0 && (
                      <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                        👥 {theme.usageCount} sellers
                      </div>
                    )}
                  </div>

                  {/* Theme Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{theme.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">v{theme.versionString || theme.version}</p>
                    {theme.description && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{theme.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handlePreview(theme)}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleEdit(theme)}
                        className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(theme)}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleToggleActive(theme)}
                        className={`px-3 py-1.5 text-sm rounded ${theme.isActive ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                      >
                        {theme.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(theme)}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upload Modal */}
          {showUploadModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">Upload Theme</h2>
                    <button onClick={() => setShowUploadModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Theme File (ZIP) *</label>
                      <input
                        type="file"
                        accept=".zip"
                        onChange={handleFileChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum file size: 50MB</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Theme Name *</label>
                      <input
                        type="text"
                        value={uploadForm.name}
                        onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                        placeholder="Enter theme name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                      <select
                        value={uploadForm.type}
                        onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="SELLER">Seller Theme</option>
                        <option value="HOS">HOS Theme</option>
                        <option value="CUSTOMER">Customer Theme</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={uploadForm.description}
                        onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                        placeholder="Enter theme description"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleUpload}
                        disabled={uploading || !uploadForm.file || !uploadForm.name}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {uploading ? 'Uploading...' : 'Upload Theme'}
                      </button>
                      <button
                        onClick={() => setShowUploadModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {showEditModal && selectedTheme && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold">Edit Theme</h2>
                    <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Theme Name *</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                      <select
                        value={editForm.type}
                        onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="SELLER">Seller Theme</option>
                        <option value="HOS">HOS Theme</option>
                        <option value="CUSTOMER">Customer Theme</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSaveEdit}
                        disabled={actionLoading || !editForm.name}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {actionLoading ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview Modal */}
          {showPreviewModal && selectedTheme && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold">{selectedTheme.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded ${getTypeBadgeColor(selectedTheme.type)}`}>{selectedTheme.type}</span>
                        <span className="text-gray-500">v{selectedTheme.versionString || selectedTheme.version}</span>
                      </div>
                    </div>
                    <button onClick={() => setShowPreviewModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-4">
                    {selectedTheme.previewImages && selectedTheme.previewImages.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedTheme.previewImages.map((img, idx) => (
                          <div key={idx} className="relative w-full aspect-video rounded-lg border border-gray-200 overflow-hidden">
                            <Image src={img} alt={`Preview ${idx + 1}`} fill className="object-contain" sizes="(max-width: 768px) 100vw, 50vw" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-gray-100 rounded-lg p-8 text-center">
                        <p className="text-gray-500">No preview images available</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-500">Status</p>
                        <p className="font-medium">{selectedTheme.isActive ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-500">Usage</p>
                        <p className="font-medium">{selectedTheme.usageCount || 0} sellers</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-500">Created</p>
                        <p className="font-medium">{new Date(selectedTheme.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <p className="text-gray-500">Updated</p>
                        <p className="font-medium">{new Date(selectedTheme.updatedAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {selectedTheme.description && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Description</p>
                        <p className="text-gray-700">{selectedTheme.description}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4 border-t">
                      <button onClick={() => { setShowPreviewModal(false); handleEdit(selectedTheme); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        Edit Theme
                      </button>
                      <button onClick={() => setShowPreviewModal(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
