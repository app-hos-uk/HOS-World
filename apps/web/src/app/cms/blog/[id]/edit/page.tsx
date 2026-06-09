'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { BlogEditor, type BlogFormData } from '@/components/cms/BlogEditor';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { cmsActionToastMessage, cmsLoadingErrorMessage } from '@/lib/cmsPortalFeedback';

export default function EditBlogPostPage() {
  const params = useParams();
  const id = params?.id as string;
  const toast = useToast();
  const [formData, setFormData] = useState<BlogFormData | null>(null);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiClient.getAdminBlogPost(id),
      apiClient.getAdminBlogCategories(),
    ])
      .then(([postRes, catRes]) => {
        const post = postRes?.data;
        if (!post) throw new Error('Post not found');
        setFormData({
          title: post.title || '',
          slug: post.slug || '',
          excerpt: post.excerpt || '',
          content: post.contentHtml || post.content || '',
          coverImage: post.coverImage || '',
          coverImageAlt: post.coverImageAlt || '',
          coverImageTitle: post.coverImageTitle || '',
          author: post.author || '',
          categoryId: post.categoryId || '',
          seoTitle: post.seoTitle || '',
          metaDescription: post.metaDescription || '',
          focusKeyword: post.focusKeyword || '',
          canonicalUrl: post.canonicalUrl || '',
          status: post.status || 'DRAFT',
        });
        if (Array.isArray(catRes?.data)) setCategories(catRes.data);
      })
      .catch((err) => setError(cmsLoadingErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (data: BlogFormData) => {
    try {
      setSaving(true);
      await apiClient.updateBlogPost(id, {
        ...data,
        categoryId: data.categoryId || null,
      });
      toast.success(data.status === 'PUBLISHED' ? 'Blog post published' : 'Draft saved');
      setFormData(data);
    } catch (err: unknown) {
      toast.error(cmsActionToastMessage(err, 'Failed to save blog post'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="flex items-center justify-center h-64 text-hos-text-muted">Loading...</div>
        </CMSLayout>
      </RouteGuard>
    );
  }

  if (error || !formData) {
    return (
      <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
        <CMSLayout>
          <div className="text-red-400">{error || 'Post not found'}</div>
        </CMSLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
      <CMSLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-hos-text-secondary">Edit Blog Post</h1>
          <BlogEditor
            initialData={formData}
            categories={categories}
            postId={id}
            onSave={handleSave}
            saving={saving}
          />
        </div>
      </CMSLayout>
    </RouteGuard>
  );
}
