'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

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
  createdAt: string;
  updatedAt: string;
}

export default function AdminThemesPage() {
  const toast = useToast();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'HOS' | 'SELLER' | 'CUSTOMER'>('ALL');

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchThemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getThemes(filter !== 'ALL' ? filter : undefined);
      if (response?.data) {
        setThemes(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching themes:', err);
      toast.error(err.message || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

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

      await toast.promise(
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/themes/upload`, {
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
      setUploadForm({ file: null, name: '', description: '' });
      await fetchThemes();
    } catch (err: any) {
      console.error('Error uploading theme:', err);
    } finally {
      setUploading(false);
    }
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

  const handlePreview = (theme: Theme) => {
    setSelectedTheme(theme);
    setShowPreviewModal(true);
  };

  const filteredThemes = themes.filter((theme) => {
    if (filter === 'ALL') return true;
    return theme.type === filter;
  });

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Theme Management</h1>
              <p className="text-gray-600 mt-2">Upload, manage, and configure themes for sellers</p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium whitespace-nowrap"
            >
              + Upload Theme
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'ALL'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Themes
            </button>
            <button
              onClick={() => setFilter('HOS')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'HOS'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              HOS Themes
            </button>
            <button
              onClick={() => setFilter('SELLER')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'SELLER'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Seller Themes
            </button>
            <button
              onClick={() => setFilter('CUSTOMER')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'CUSTOMER'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Customer Themes
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}

        {!loading && filteredThemes.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-500 text-lg">No themes found</p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Upload Your First Theme
            </button>
          </div>
        )}

        {!loading && filteredThemes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredThemes.map((theme) => (
              <div
                key={theme.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Preview Image */}
                <div className="aspect-video bg-gray-100 relative">
                  {theme.previewImages && theme.previewImages.length > 0 ? (
                    <img
                      src={theme.previewImages[0]}
                      alt={theme.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <div className="text-4xl mb-2">🎨</div>
                        <div className="text-sm">No Preview</div>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        theme.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {theme.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Theme Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{theme.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {theme.type} • v{theme.versionString || theme.version}
                      </p>
                    </div>
                  </div>

                  {theme.description && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{theme.description}</p>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handlePreview(theme)}
                      className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => handleToggleActive(theme)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme.isActive
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {theme.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(theme)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-md w-full my-4">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">Upload Theme</h2>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Theme File (ZIP)
                    </label>
                    <input
                      type="file"
                      accept=".zip"
                      onChange={handleFileChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum file size: 50MB</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Theme Name</label>
                    <input
                      type="text"
                      value={uploadForm.name}
                      onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                      placeholder="Enter theme name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
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
                      disabled={uploading || !uploadForm.file}
                      className="flex-1 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : 'Upload Theme'}
                    </button>
                    <button
                      onClick={() => setShowUploadModal(false)}
                      disabled={uploading}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-4xl w-full my-4">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold">{selectedTheme.name}</h2>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedTheme.previewImages && selectedTheme.previewImages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedTheme.previewImages.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`Preview ${idx + 1}`}
                          className="w-full rounded-lg border border-gray-200"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-100 rounded-lg p-8 text-center">
                      <p className="text-gray-500">No preview images available</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Type:</span>
                      <span className="ml-2 text-gray-600">{selectedTheme.type}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Version:</span>
                      <span className="ml-2 text-gray-600">
                        {selectedTheme.versionString || selectedTheme.version}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className="ml-2 text-gray-600">
                        {selectedTheme.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Created:</span>
                      <span className="ml-2 text-gray-600">
                        {new Date(selectedTheme.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {selectedTheme.description && (
                    <div>
                      <span className="font-medium text-gray-700">Description:</span>
                      <p className="mt-1 text-gray-600">{selectedTheme.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}

