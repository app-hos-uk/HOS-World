'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CmsPortalErrorBanner } from '@/components/CmsPortalErrorBanner';
import { cmsActionToastMessage, cmsLoadingErrorMessage } from '@/lib/cmsPortalFeedback';

export default function CMSBannersPage() {
  const toast = useToast();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'hero' | 'promotional' | 'sidebar'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingBanner, setCreatingBanner] = useState(false);
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [updatingBanner, setUpdatingBanner] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setError(cmsLoadingErrorMessage(err));
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingBanner) return;
    try {
      setCreatingBanner(true);
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
      toast.error(cmsActionToastMessage(err, 'Failed to create banner'));
    } finally {
      setCreatingBanner(false);
    }
  };

  const handleToggleActive = async (bannerId: string, currentActive: boolean) => {
    try {
      await apiClient.updateCMSBanner(bannerId, { active: !currentActive });
      toast.success(`Banner ${!currentActive ? 'activated' : 'deactivated'} successfully`);
      loadBanners();
    } catch (err: any) {
      toast.error(cmsActionToastMessage(err, 'Failed to update banner'));
    }
  };

  const handleEditBanner = (banner: any) => {
    setFormData({
      title: banner.title || '',
      type: banner.type || 'hero',
      image: banner.image || '',
      link: banner.link || '',
      content: banner.content || '',
      active: banner.active ?? true,
    });
    setEditingBannerId(banner.id);
    setShowCreateForm(false);
  };

  const handleUpdateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBannerId || updatingBanner) return;
    try {
      setUpdatingBanner(true);
      await apiClient.updateCMSBanner(editingBannerId, formData);
      toast.success('Banner updated successfully');
      setEditingBannerId(null);
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
      toast.error(cmsActionToastMessage(err, 'Failed to update banner'));
    } finally {
      setUpdatingBanner(false);
    }
  };

  const handleDeleteBanner = async (banner: any) => {
    if (!confirm(`Are you sure you want to delete "${banner.title}"? This action cannot be undone.`)) return;
    try {
      await apiClient.deleteCMSBanner(banner.id);
      toast.success('Banner deleted successfully');
      loadBanners();
    } catch (err: any) {
      toast.error(cmsActionToastMessage(err, 'Failed to delete banner'));
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading banners...</div>
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
            <h1 className="text-2xl font-bold text-hos-text-secondary">CMS Banners</h1>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
            >
              + Create Banner
            </button>
          </div>

          <CmsPortalErrorBanner message={error} />

          {/* Filter */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  filterType === 'all'
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-tertiary'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('hero')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  filterType === 'hero'
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-tertiary'
                }`}
              >
                Hero
              </button>
              <button
                onClick={() => setFilterType('promotional')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  filterType === 'promotional'
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-tertiary'
                }`}
              >
                Promotional
              </button>
              <button
                onClick={() => setFilterType('sidebar')}
                className={`px-4 py-2 rounded-lg text-sm ${
                  filterType === 'sidebar'
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-tertiary'
                }`}
              >
                Sidebar
              </button>
            </div>
          </div>

          {editingBannerId && (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Edit Banner</h2>
              <form onSubmit={handleUpdateBanner} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Banner Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="Banner title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Banner Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                  >
                    <option value="hero">Hero Banner</option>
                    <option value="promotional">Promotional Banner</option>
                    <option value="sidebar">Sidebar Banner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Image URL</label>
                  <input
                    type="url"
                    required
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Link URL (optional)</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="https://example.com/page"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Content (optional)</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
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
                      className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                    />
                    <span className="text-sm text-hos-text-secondary">Active</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updatingBanner}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingBanner ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBannerId(null);
                      setFormData({
                        title: '',
                        type: 'hero',
                        image: '',
                        link: '',
                        content: '',
                        active: true,
                      });
                    }}
                    className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {showCreateForm && (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Create New Banner</h2>
              <form onSubmit={handleCreateBanner} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Banner Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="Banner title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Banner Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                  >
                    <option value="hero">Hero Banner</option>
                    <option value="promotional">Promotional Banner</option>
                    <option value="sidebar">Sidebar Banner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Image URL</label>
                  <input
                    type="url"
                    required
                    value={formData.image}
                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Link URL (optional)</label>
                  <input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    placeholder="https://example.com/page"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Content (optional)</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
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
                      className="rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                    />
                    <span className="text-sm text-hos-text-secondary">Active</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creatingBanner}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingBanner ? 'Creating...' : 'Create Banner'}
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
                    className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-hos-bg-secondary rounded-lg shadow">
            <div className="p-4 border-b border-hos-border">
              <h2 className="text-lg font-semibold">
                {filterType === 'all' ? 'All Banners' : `${filterType.charAt(0).toUpperCase() + filterType.slice(1)} Banners`}
              </h2>
            </div>
            <div className="p-4">
              {banners.length === 0 ? (
                <div className="text-center py-8 text-hos-text-muted">
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
                      className="border border-hos-border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="relative mb-3 h-32">
                        {banner.image && (
                          <Image
                            src={banner.image}
                            alt={banner.title}
                            fill
                            className="object-cover rounded"
                            sizes="(max-width: 768px) 100vw, 33vw"
                          />
                        )}
                      </div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-hos-text-secondary">{banner.title}</h3>
                          <span className="text-xs bg-hos-gold/20 text-hos-gold px-2 py-0.5 rounded mt-1 inline-block">
                            {banner.type}
                          </span>
                        </div>
                        {banner.active ? (
                          <span className="text-xs bg-green-500/15 text-green-300 px-2 py-0.5 rounded">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs bg-hos-bg-tertiary text-hos-text-secondary px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {banner.link && (
                        <p className="text-xs text-hos-text-muted mb-2">Link: {banner.link}</p>
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
                        <button
                          onClick={() => handleEditBanner(banner)}
                          className="flex-1 px-3 py-1 text-sm bg-hos-gold text-[#1a1406] rounded hover:bg-hos-gold-hover"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteBanner(banner)}
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
      </CMSLayout>
    </RouteGuard>
  );
}

