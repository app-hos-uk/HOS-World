'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CmsPortalErrorBanner } from '@/components/CmsPortalErrorBanner';
import { cmsActionToastMessage, cmsLoadingErrorMessage } from '@/lib/cmsPortalFeedback';

export default function CMSBlogPage() {
  const toast = useToast();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [creatingPost, setCreatingPost] = useState(false);
  const [updatingPost, setUpdatingPost] = useState(false);
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
    } catch (err: unknown) {
      console.error('Error loading blog posts:', err);
      setError(cmsLoadingErrorMessage(err));
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingPost) return;
    try {
      setCreatingPost(true);
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
    } catch (err: unknown) {
      toast.error(cmsActionToastMessage(err, 'Failed to create blog post'));
    } finally {
      setCreatingPost(false);
    }
  };

  const handleEditPost = (post: any) => {
    setFormData({
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      author: post.author || '',
    });
    setEditingPostId(post.id);
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPostId || updatingPost) return;
    try {
      setUpdatingPost(true);
      await apiClient.updateCMSBlogPost(editingPostId, formData);
      toast.success('Blog post updated successfully');
      setShowEditForm(false);
      setEditingPostId(null);
      setFormData({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        coverImage: '',
        author: '',
      });
      loadBlogPosts();
    } catch (err: unknown) {
      toast.error(cmsActionToastMessage(err, 'Failed to update blog post'));
    } finally {
      setUpdatingPost(false);
    }
  };

  const handleDeletePost = async (post: any) => {
    if (!window.confirm(`Are you sure you want to delete "${post.title}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await apiClient.deleteCMSBlogPost(post.id);
      toast.success('Blog post deleted successfully');
      loadBlogPosts();
    } catch (err: unknown) {
      toast.error(cmsActionToastMessage(err, 'Failed to delete blog post'));
    }
  };

  const handleTogglePublish = async (post: any) => {
    try {
      if (post.publishedAt) {
        await apiClient.unpublishCMSBlogPost(post.id);
        toast.success('Blog post unpublished');
      } else {
        await apiClient.publishCMSBlogPost(post.id);
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
            <h1 className="text-2xl font-bold text-white">Blog Posts</h1>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
            >
              + Write Post
            </button>
          </div>

          <CmsPortalErrorBanner message={error} />

          {showEditForm && editingPostId && (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Edit Blog Post</h2>
              <form onSubmit={handleUpdatePost} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Post Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="Blog post title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Slug</label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="blog-post-slug"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Author</label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="Author name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Excerpt</label>
                  <textarea
                    required
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    rows={2}
                    placeholder="Short excerpt or summary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    value={formData.coverImage}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Content</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    rows={15}
                    placeholder="Blog post content (Markdown or HTML)"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={updatingPost}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingPost ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditForm(false);
                      setEditingPostId(null);
                      setFormData({
                        title: '',
                        slug: '',
                        excerpt: '',
                        content: '',
                        coverImage: '',
                        author: '',
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
              <h2 className="text-lg font-semibold mb-4">Create New Blog Post</h2>
              <form onSubmit={handleCreatePost} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Post Title</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="Blog post title"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Slug</label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="blog-post-slug"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">Author</label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                      placeholder="Author name"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Excerpt</label>
                  <textarea
                    required
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    rows={2}
                    placeholder="Short excerpt or summary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Cover Image URL</label>
                  <input
                    type="url"
                    value={formData.coverImage}
                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Content</label>
                  <textarea
                    required
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                    rows={15}
                    placeholder="Blog post content (Markdown or HTML)"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creatingPost}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingPost ? 'Creating...' : 'Create Post'}
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
              <h2 className="text-lg font-semibold">All Blog Posts</h2>
            </div>
            <div className="p-4">
              {posts.length === 0 ? (
                <div className="text-center py-8 text-hos-text-muted">
                  <p>No blog posts found.</p>
                  <p className="text-sm mt-2">Create your first blog post to get started.</p>
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
                            height={128}
                            className="object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-white">{post.title}</h3>
                          <p className="text-sm text-hos-text-secondary mt-1">{post.excerpt}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-hos-text-muted">
                            {post.author && <span>By {post.author}</span>}
                            {post.publishedAt && (
                              <span>
                                Published: {new Date(post.publishedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          {post.publishedAt ? (
                            <span className="inline-block mt-2 text-xs bg-green-500/15 text-green-300 px-2 py-1 rounded">
                              Published
                            </span>
                          ) : (
                            <span className="inline-block mt-2 text-xs bg-yellow-500/15 text-yellow-300 px-2 py-1 rounded">
                              Draft
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleTogglePublish(post)}
                            className={`px-3 py-1 text-sm rounded ${
                              post.publishedAt
                                ? 'bg-yellow-500/10 text-white hover:bg-yellow-600'
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                          >
                            {post.publishedAt ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            onClick={() => handleEditPost(post)}
                            className="px-3 py-1 text-sm bg-hos-gold text-[#1a1406] rounded hover:bg-hos-gold-hover"
                          >
                            Edit
                          </button>
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

