'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

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
        apiClient.getCMSBlogPosts(100).catch(() => ({ data: [] })),
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
        publishedPosts: blogPosts.filter((p: any) => p.publishedAt).length,
      });
    } catch (err: any) {
      console.error('Error loading CMS dashboard:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading dashboard...</div>
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
            <h1 className="text-2xl font-bold text-gray-900">CMS Dashboard</h1>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Pages Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Pages</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalPages}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.publishedPages} published
                  </p>
                </div>
                <div className="text-4xl">📄</div>
              </div>
              <Link
                href="/cms/pages"
                className="mt-4 inline-block text-sm text-purple-600 hover:text-purple-700"
              >
                Manage Pages →
              </Link>
            </div>

            {/* Banners Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Banners</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalBanners}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.activeBanners} active
                  </p>
                </div>
                <div className="text-4xl">🖼️</div>
              </div>
              <Link
                href="/cms/banners"
                className="mt-4 inline-block text-sm text-purple-600 hover:text-purple-700"
              >
                Manage Banners →
              </Link>
            </div>

            {/* Blog Posts Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Blog Posts</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{stats.totalBlogPosts}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.publishedPosts} published
                  </p>
                </div>
                <div className="text-4xl">✍️</div>
              </div>
              <Link
                href="/cms/blog"
                className="mt-4 inline-block text-sm text-purple-600 hover:text-purple-700"
              >
                Manage Blog →
              </Link>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link
                href="/cms/pages?action=create"
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl">➕</span>
                <div>
                  <p className="font-medium text-gray-900">Create New Page</p>
                  <p className="text-sm text-gray-500">Add a new content page</p>
                </div>
              </Link>
              <Link
                href="/cms/banners?action=create"
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl">🖼️</span>
                <div>
                  <p className="font-medium text-gray-900">Create Banner</p>
                  <p className="text-sm text-gray-500">Add a new banner</p>
                </div>
              </Link>
              <Link
                href="/cms/blog?action=create"
                className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl">✍️</span>
                <div>
                  <p className="font-medium text-gray-900">Write Blog Post</p>
                  <p className="text-sm text-gray-500">Create a new blog post</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
            <div className="text-sm text-gray-500">
              <p>Recent content updates will appear here.</p>
              <p className="mt-2">
                Connect to Strapi CMS to view detailed activity logs.
              </p>
            </div>
          </div>
        </div>
      </CMSLayout>
    </RouteGuard>
  );
}

