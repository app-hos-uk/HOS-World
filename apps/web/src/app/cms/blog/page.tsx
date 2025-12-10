'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function CMSBlogPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    coverImage: '',
    author: '',
  });

  useEffect(() => {
    loadBlogPosts();
  }, []);

  const loadBlogPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCMSBlogPosts(100);
      if (response?.data) {
        setPosts(Array.isArray(response.data) ? response.data : []);
      } else {
        setPosts([]);
      }
    } catch (err: any) {
      console.error('Error loading blog posts:', err);
      setError(err.message || 'Failed to load blog posts');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createCMSBlogPost(formData);
      toast.success('Blog post created successfully');
      setShowCreateForm(false);
      setFormData({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        coverImage: '',
        author: '',
      });
      loadBlogPosts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create blog post');
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Loading blog posts...</div>
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
            <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + Write Post
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          {showCreateForm && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Create New Blog Post</h2>
              <form onSubmit={handleCreatePost} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Post Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Blog post title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="blog-post-slug"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Author name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>
                  <textarea
                    required
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    placeholder="Short excerpt or summary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    value={formData.coverImage}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={15}
                    placeholder="Blog post content (Markdown or HTML)"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Create Post
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormData({
                        title: '',
                        slug: '',
                        excerpt: '',
                        content: '',
                        coverImage: '',
                        author: '',
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
              <h2 className="text-lg font-semibold">All Blog Posts</h2>
            </div>
            <div className="p-4">
              {posts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No blog posts found.</p>
                  <p className="text-sm mt-2">Create your first blog post to get started.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        {post.coverImage && (
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-32 h-32 object-cover rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/placeholder-banner.svg';
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{post.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{post.excerpt}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {post.author && <span>By {post.author}</span>}
                            {post.publishedAt && (
                              <span>
                                Published: {new Date(post.publishedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {post.publishedAt ? (
                            <span className="inline-block mt-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Published
                            </span>
                          ) : (
                            <span className="inline-block mt-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              Draft
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                            Edit
                          </button>
                          <button className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
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

