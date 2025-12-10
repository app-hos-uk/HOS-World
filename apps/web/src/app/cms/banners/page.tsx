'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function CMSBannersPage() {
  const toast = useToast();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'hero' | 'promotional' | 'sidebar'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'hero' as 'hero' | 'promotional' | 'sidebar',
    image: '',
    link: '',
    content: '',
    active: true,
  });

  useEffect(() => {
    loadBanners();
  }, [filterType]);

  const loadBanners = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCMSBanners(filterType !== 'all' ? filterType : undefined);
      if (response?.data) {
        setBanners(Array.isArray(response.data) ? response.data : []);
      } else {
        setBanners([]);
      }
    } catch (err: any) {
      console.error('Error loading banners:', err);
      setError(err.message || 'Failed to load banners');
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createCMSBanner(formData);
      toast.success('Banner created successfully');
      setShowCreateForm(false);
      setFormData({
        title: '',
        type: 'hero',
        image: '',
        link: '',
        content: '',
        active: true,
      });
      loadBanners();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create banner');
    }
  };

  const handleToggleActive = async (bannerId: string, currentActive: boolean) => {
    try {
      await apiClient.updateCMSBanner(bannerId, { active: !currentActive });
      toast.success(`Banner ${!currentActive ? 'activated' : 'deactivated'} successfully`);
      loadBanners();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update banner');
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading banners...</div>
          </div>
        </CMSLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
      <CMSLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">CMS Banners</h1>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + Create Banner
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {/* Filter */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  filterType === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('hero')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  filterType === 'hero'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Hero
              </button>
              <button
                onClick={() => setFilterType('promotional')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  filterType === 'promotional'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Promotional
              </button>
              <button
                onClick={() => setFilterType('sidebar')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  filterType === 'sidebar'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Sidebar
              </button>
            </div>
          </div>

          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Create New Banner</h2>
              <form onSubmit={handleCreateBanner} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banner Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Banner title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banner Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="hero">Hero Banner</option>
                    <option value="promotional">Promotional Banner</option>
                    <option value="sidebar">Sidebar Banner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    required
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link URL (optional)</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="https://example.com/page"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content (optional)</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Banner content or description"
                  />
                </div>
                <div className="flex items-center">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
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
                    Create Banner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({
                        title: '',
                        type: 'hero',
                        image: '',
                        link: '',
                        content: '',
                        active: true,
                      });
                    }}
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
              <h2 className="text-lg font-semibold">
                {filterType === 'all' ? 'All Banners' : `${filterType.charAt(0).toUpperCase() + filterType.slice(1)} Banners`}
              </h2>
            </div>
            <div className="p-4">
              {banners.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No banners found.</p>
                  <p className="text-sm mt-2">
                    {filterType !== 'all' ? `No ${filterType} banners available.` : 'Create your first banner to get started.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {banners.map((banner) => (
                    <div
                      key={banner.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="mb-3">
                        {banner.image && (
                          <img
                            src={banner.image}
                            alt={banner.title}
                            className="w-full h-32 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-banner.svg';
                            }}
                          />
                        )}
                      </div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{banner.title}</h3>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded mt-1 inline-block">
                            {banner.type}
                          </span>
                        </div>
                        {banner.active ? (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {banner.link && (
                        <p className="text-xs text-gray-500 mb-2">Link: {banner.link}</p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleToggleActive(banner.id, banner.active)}
                          className={`flex-1 px-3 py-1 text-sm rounded ${
                            banner.active
                              ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {banner.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                          Edit
                        </button>
                        <button className="flex-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
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
      </CMSLayout>
    </RouteGuard>
  );
}

