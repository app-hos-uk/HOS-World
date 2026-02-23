'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

function CMSPagesContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const toast = useToast();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const [updatingPage, setUpdatingPage] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    metaTitle: '',
    metaDescription: '',
    keywords: '',
  });

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    if (editId && pages.length > 0) {
      const page = pages.find((p) => p.id === editId);
      if (page) {
        setFormData({
          title: page.title || '',
          slug: page.slug || '',
          content: page.content || '',
          metaTitle: page.metaTitle || '',
          metaDescription: page.metaDescription || '',
          keywords: page.keywords || '',
        });
        setEditingPageId(editId);
        setShowEditForm(true);
      } else {
        apiClient.getCMSPage(editId).then((res) => {
          if (res?.data) {
            const p = res.data;
            setFormData({
              title: p.title || '',
              slug: p.slug || '',
              content: p.content || '',
              metaTitle: p.metaTitle || '',
              metaDescription: p.metaDescription || '',
              keywords: p.keywords || '',
            });
            setEditingPageId(editId);
            setShowEditForm(true);
          }
        }).catch(() => toast.error('Page not found'));
      }
    } else {
      setShowEditForm(false);
      setEditingPageId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, pages]);

  const loadPages = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCMSPages();
      if (response?.data) {
        setPages(Array.isArray(response.data) ? response.data : []);
      } else {
        setPages([]);
      }
    } catch (err: any) {
      console.error('Error loading pages:', err);
      setError(err.message || 'Failed to load pages');
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingPage) return;
    try {
      setCreatingPage(true);
      await apiClient.createCMSPage(formData);
      toast.success('Page created successfully');
      setShowCreateForm(false);
      setFormData({
        title: '',
        slug: '',
        content: '',
        metaTitle: '',
        metaDescription: '',
        keywords: '',
      });
      loadPages();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create page');
    } finally {
      setCreatingPage(false);
    }
  };

  const handleUpdatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPageId || updatingPage) return;
    try {
      setUpdatingPage(true);
      await apiClient.updateCMSPage(editingPageId, formData);
      toast.success('Page updated successfully');
      setShowEditForm(false);
      setEditingPageId(null);
      setFormData({
        title: '',
        slug: '',
        content: '',
        metaTitle: '',
        metaDescription: '',
        keywords: '',
      });
      loadPages();
      window.history.replaceState({}, '', '/cms/pages');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update page');
    } finally {
      setUpdatingPage(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading pages...</div>
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
            <h1 className="text-2xl font-bold text-gray-900">CMS Pages</h1>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + Create Page
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {showEditForm && editingPageId && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Edit Page</h2>
              <form onSubmit={handleUpdatePage} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Page title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="page-slug"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={10}
                    placeholder="Page content (Markdown or HTML)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                    <input
                      type="text"
                      value={formData.metaTitle}
                      onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="SEO meta title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                    <input
                      type="text"
                      value={formData.metaDescription}
                      onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="SEO meta description"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updatingPage}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingPage ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditForm(false);
                      setEditingPageId(null);
                      window.history.replaceState({}, '', '/cms/pages');
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Create New Page</h2>
              <form onSubmit={handleCreatePage} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Page Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Page title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="page-slug"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={10}
                    placeholder="Page content (Markdown or HTML)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                    <input
                      type="text"
                      value={formData.metaTitle}
                      onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="SEO meta title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                    <input
                      type="text"
                      value={formData.metaDescription}
                      onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="SEO meta description"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creatingPage}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingPage ? 'Creating...' : 'Create Page'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({
                        title: '',
                        slug: '',
                        content: '',
                        metaTitle: '',
                        metaDescription: '',
                        keywords: '',
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
              <h2 className="text-lg font-semibold">All Pages</h2>
            </div>
            <div className="p-4">
              {pages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No pages found.</p>
                  <p className="text-sm mt-2">
                    Pages are managed through Strapi CMS. Connect to Strapi to view and manage pages.
                  </p>
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> To manage pages, ensure Strapi CMS is configured and
                      the <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_CMS_URL</code> environment variable is set.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {pages.map((page) => (
                    <div
                      key={page.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{page.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">Slug: /{page.slug}</p>
                          {page.publishedAt && (
                            <span className="inline-block mt-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Published
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                if (page.publishedAt) {
                                  await apiClient.unpublishCMSPage(page.id);
                                  toast.success('Page unpublished');
                                } else {
                                  await apiClient.publishCMSPage(page.id);
                                  toast.success('Page published');
                                }
                                loadPages();
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to update publish status');
                              }
                            }}
                            className={`px-3 py-1 text-sm rounded ${
                              page.publishedAt
                                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {page.publishedAt ? 'Unpublish' : 'Publish'}
                          </button>
                          <Link
                            href={`/cms/pages?edit=${page.id}`}
                            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to delete "${page.title}"? This action cannot be undone.`)) return;
                              try {
                                await apiClient.deleteCMSPage(page.id);
                                toast.success('Page deleted successfully');
                                loadPages();
                              } catch (err: any) {
                                toast.error(err.message || 'Failed to delete page');
                              }
                            }}
                            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
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

export default function CMSPagesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>}>
      <CMSPagesContent />
    </Suspense>
  );
}

