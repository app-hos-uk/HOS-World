'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { CmsPortalErrorBanner } from '@/components/CmsPortalErrorBanner';
import { cmsLoadingErrorMessage } from '@/lib/cmsPortalFeedback';

interface DashboardStats {
  totalPages: number;
  totalBanners: number;
  totalBlogPosts: number;
  publishedPages: number;
  activeBanners: number;
  publishedPosts: number;
}

export default function CMSDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPages: 0,
    totalBanners: 0,
    totalBlogPosts: 0,
    publishedPages: 0,
    activeBanners: 0,
    publishedPosts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadDashboardData();
    };
    const interval = setInterval(() => loadDashboardData(), 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch CMS content statistics
      const [pagesResponse, bannersResponse, blogPostsResponse] = await Promise.all([
        apiClient.getCMSPages().catch(() => ({ data: [] })),
        apiClient.getCMSBanners().catch(() => ({ data: [] })),
        apiClient.getAdminBlogPosts(100).catch(() => ({ data: [] })),
      ]);

      const pages = Array.isArray(pagesResponse?.data) ? pagesResponse.data : [];
      const allBanners = Array.isArray(bannersResponse?.data) ? bannersResponse.data : [];
      const blogPosts = Array.isArray(blogPostsResponse?.data) ? blogPostsResponse.data : [];
      const activeBanners = allBanners.filter((b: any) => b.active);

      setStats({
        totalPages: pages.length,
        totalBanners: allBanners.length,
        totalBlogPosts: blogPosts.length,
        publishedPages: pages.filter((p: any) => p.publishedAt).length,
        activeBanners: activeBanners.length,
        publishedPosts: blogPosts.filter((p: any) => p.status === 'PUBLISHED').length,
      });
    } catch (err: unknown) {
      console.error('Error loading CMS dashboard:', err);
      setError(cmsLoadingErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading dashboard...</div>
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
            <h1 className="text-2xl font-bold text-hos-text-secondary">CMS Dashboard</h1>
          </div>

          <CmsPortalErrorBanner message={error} />

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Pages Card */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-hos-text-secondary">Total Pages</p>
                  <p className="text-2xl font-bold text-hos-text-secondary mt-2">{stats.totalPages}</p>
                  <p className="text-xs text-hos-text-secondary mt-1">
                    {stats.publishedPages} published
                  </p>
                </div>
                <div className="text-4xl">📄</div>
              </div>
              <Link
                href="/cms/pages"
                className="mt-4 inline-block text-sm text-hos-gold hover:text-hos-gold-hover"
              >
                Manage Pages →
              </Link>
            </div>

            {/* Banners Card */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-hos-text-secondary">Total Banners</p>
                  <p className="text-2xl font-bold text-hos-text-secondary mt-2">{stats.totalBanners}</p>
                  <p className="text-xs text-hos-text-secondary mt-1">
                    {stats.activeBanners} active
                  </p>
                </div>
                <div className="text-4xl">🖼️</div>
              </div>
              <Link
                href="/cms/banners"
                className="mt-4 inline-block text-sm text-hos-gold hover:text-hos-gold-hover"
              >
                Manage Banners →
              </Link>
            </div>

            {/* Blog Posts Card */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-hos-text-secondary">Blog Posts</p>
                  <p className="text-2xl font-bold text-hos-text-secondary mt-2">{stats.totalBlogPosts}</p>
                  <p className="text-xs text-hos-text-secondary mt-1">
                    {stats.publishedPosts} published
                  </p>
                </div>
                <div className="text-4xl">✍️</div>
              </div>
              <Link
                href="/cms/blog"
                className="mt-4 inline-block text-sm text-hos-gold hover:text-hos-gold-hover"
              >
                Manage Blog →
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/cms/pages?action=create"
                className="flex items-center gap-3 p-4 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
              >
                <span className="text-2xl">➕</span>
                <div>
                  <p className="font-medium text-hos-text-secondary">Create New Page</p>
                  <p className="text-sm text-hos-text-secondary">Add a new content page</p>
                </div>
              </Link>
              <Link
                href="/cms/banners?action=create"
                className="flex items-center gap-3 p-4 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
              >
                <span className="text-2xl">🖼️</span>
                <div>
                  <p className="font-medium text-hos-text-secondary">Create Banner</p>
                  <p className="text-sm text-hos-text-secondary">Add a new banner</p>
                </div>
              </Link>
              <Link
                href="/cms/blog/new"
                className="flex items-center gap-3 p-4 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
              >
                <span className="text-2xl">✍️</span>
                <div>
                  <p className="font-medium text-hos-text-secondary">Write Blog Post</p>
                  <p className="text-sm text-hos-text-secondary">Create a new blog post</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Recent Activity</h2>
            <div className="text-sm text-hos-text-secondary">
              <p>Recent content updates will appear here.</p>
              <p className="mt-2">
                Connect the external content service to view detailed activity logs.
              </p>
            </div>
          </div>
        </div>
      </CMSLayout>
    </RouteGuard>
  );
}

