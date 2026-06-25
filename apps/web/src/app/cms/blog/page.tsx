'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CmsPortalErrorBanner } from '@/components/CmsPortalErrorBanner';
import { cmsActionToastMessage, cmsLoadingErrorMessage } from '@/lib/cmsPortalFeedback';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string;
  author: string;
  status: string;
  publishedAt?: string;
  category?: { name: string };
}

export default function CMSBlogPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBlogPosts();
  }, []);

  const loadBlogPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getAdminBlogPosts(100);
      setPosts(Array.isArray(response?.data) ? response.data : []);
    } catch (err: unknown) {
      console.error('Error loading blog posts:', err);
      setError(cmsLoadingErrorMessage(err));
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (post: BlogPost) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      await apiClient.deleteBlogPost(post.id);
      toast.success('Blog post deleted');
      loadBlogPosts();
    } catch (err: unknown) {
      toast.error(cmsActionToastMessage(err, 'Failed to delete blog post'));
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    try {
      if (post.status === 'PUBLISHED') {
        await apiClient.unpublishBlogPost(post.id);
        toast.success('Blog post unpublished');
      } else {
        await apiClient.publishBlogPost(post.id);
        toast.success('Blog post published');
      }
      loadBlogPosts();
    } catch (err: unknown) {
      toast.error(cmsActionToastMessage(err, 'Failed to update publish status'));
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading blog posts...</div>
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
            <h1 className="text-2xl font-bold text-hos-text-secondary">Blog Posts</h1>
            <div className="flex gap-2">
              <Link
                href="/cms/blog/categories"
                className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
              >
                Categories
              </Link>
              <Link
                href="/cms/blog/new"
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
              >
                + Write Post
              </Link>
            </div>
          </div>

          <CmsPortalErrorBanner message={error} />

          <div className="bg-hos-bg-secondary rounded-lg shadow">
            <div className="p-4 border-b border-hos-border">
              <h2 className="text-lg font-semibold">All Blog Posts</h2>
            </div>
            <div className="p-4">
              {posts.length === 0 ? (
                <div className="text-center py-8 text-hos-text-muted">
                  <p>No blog posts yet.</p>
                  <Link href="/cms/blog/new" className="text-hos-gold hover:underline text-sm mt-2 inline-block">
                    Create your first post
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="border border-hos-border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        {post.coverImage && (
                          <Image
                            src={post.coverImage}
                            alt={post.title}
                            width={128}
                            height={80}
                            className="object-cover rounded w-32 h-20"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-medium text-hos-text-secondary truncate">{post.title}</h3>
                          <p className="text-sm text-hos-text-secondary mt-1 line-clamp-1">{post.excerpt}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-hos-text-secondary">
                            <span>By {post.author}</span>
                            {post.category && <span>{post.category.name}</span>}
                            {post.publishedAt && (
                              <span>Published {new Date(post.publishedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                          <span className={`inline-block mt-2 text-xs px-2 py-1 rounded ${
                            post.status === 'PUBLISHED'
                              ? 'bg-green-500/15 text-green-300'
                              : 'bg-yellow-500/15 text-yellow-300'
                          }`}>
                            {post.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleTogglePublish(post)}
                            className={`px-3 py-1 text-sm rounded ${
                              post.status === 'PUBLISHED'
                                ? 'bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {post.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                          </button>
                          <Link
                            href={`/cms/blog/${post.id}/edit`}
                            className="px-3 py-1 text-sm bg-hos-gold text-[#1a1406] rounded hover:bg-hos-gold-hover"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDeletePost(post)}
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
