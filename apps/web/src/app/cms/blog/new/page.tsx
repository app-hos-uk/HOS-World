'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import { BlogEditor, type BlogFormData } from '@/components/cms/BlogEditor';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import { cmsActionToastMessage } from '@/lib/cmsPortalFeedback';

const EMPTY_FORM: BlogFormData = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  coverImage: '',
  coverImageAlt: '',
  coverImageTitle: '',
  author: '',
  categoryId: '',
  seoTitle: '',
  metaDescription: '',
  focusKeyword: '',
  canonicalUrl: '',
  status: 'DRAFT',
};

export default function NewBlogPostPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.getAdminBlogCategories().then((res) => {
      if (Array.isArray(res?.data)) setCategories(res.data);
    }).catch(() => {});
  }, []);

  const initialData: BlogFormData = {
    ...EMPTY_FORM,
    author: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : '',
  };

  const handleSave = async (data: BlogFormData) => {
    try {
      setSaving(true);
      const response = await apiClient.createBlogPost({
        ...data,
        categoryId: data.categoryId || undefined,
      });
      toast.success(data.status === 'PUBLISHED' ? 'Blog post published' : 'Draft saved');
      if (response?.data?.id) {
        router.push(`/cms/blog/${response.data.id}/edit`);
      } else {
        router.push('/cms/blog');
      }
    } catch (err: unknown) {
      toast.error(cmsActionToastMessage(err, 'Failed to save blog post'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
      <CMSLayout>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-hos-text-secondary">New Blog Post</h1>
          <BlogEditor
            initialData={initialData}
            categories={categories}
            onSave={handleSave}
            saving={saving}
          />
        </div>
      </CMSLayout>
    </RouteGuard>
  );
}
