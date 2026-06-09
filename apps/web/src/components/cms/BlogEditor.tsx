'use client';

import { useState } from 'react';
import { TipTapEditor } from './TipTapEditor';
import { SEOPanel } from './SEOPanel';
import { ImageUploader } from './ImageUploader';
import { apiClient } from '@/lib/api';

export interface BlogFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  coverImageAlt: string;
  coverImageTitle: string;
  author: string;
  categoryId: string;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  status: 'DRAFT' | 'PUBLISHED';
}

interface BlogEditorProps {
  initialData: BlogFormData;
  categories: Array<{ id: string; name: string }>;
  postId?: string;
  onSave: (data: BlogFormData) => Promise<void>;
  saving?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function BlogEditor({
  initialData,
  categories,
  postId,
  onSave,
  saving = false,
}: BlogEditorProps) {
  const [form, setForm] = useState<BlogFormData>(initialData);
  const [slugManual, setSlugManual] = useState(Boolean(initialData.slug));

  const updateField = (field: keyof BlogFormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'title' && !slugManual) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const handleSeoChange = (field: string, value: string) => {
    updateField(field as keyof BlogFormData, value);
  };

  const handleImageChange = (field: 'coverImage' | 'coverImageAlt' | 'coverImageTitle', value: string) => {
    updateField(field, value);
  };

  const handleImageUpload = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const response = await apiClient.uploadCMSMedia(formData);
          resolve(response?.data?.url || response?.data?.original?.url || null);
        } catch {
          resolve(null);
        }
      };
      input.click();
    });
  };

  const handlePreview = () => {
    if (postId) {
      window.open(`/blog/${form.slug}?preview=true`, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent, status?: 'DRAFT' | 'PUBLISHED') => {
    e.preventDefault();
    await onSave({ ...form, status: status || form.status });
  };

  return (
    <form onSubmit={(e) => handleSubmit(e)} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Title</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-hos-text-secondary mb-1">URL Slug</label>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugManual(true);
                  updateField('slug', e.target.value);
                }}
                className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-hos-text-secondary mb-1">Author</label>
              <input
                type="text"
                required
                value={form.author}
                onChange={(e) => updateField('author', e.target.value)}
                className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Excerpt</label>
            <textarea
              required
              value={form.excerpt}
              onChange={(e) => updateField('excerpt', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Content</label>
            <TipTapEditor
              content={form.content}
              onChange={(html) => updateField('content', html)}
              onImageUpload={handleImageUpload}
            />
          </div>
        </div>

        <div className="space-y-6">
          <ImageUploader
            imageUrl={form.coverImage}
            altText={form.coverImageAlt}
            imageTitle={form.coverImageTitle}
            onChange={handleImageChange}
          />

          <div>
            <label className="block text-sm font-medium text-hos-text-secondary mb-1">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
              className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <SEOPanel
            seoTitle={form.seoTitle}
            metaDescription={form.metaDescription}
            focusKeyword={form.focusKeyword}
            canonicalUrl={form.canonicalUrl}
            slug={form.slug}
            title={form.title}
            excerpt={form.excerpt}
            onChange={handleSeoChange}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-4 border-t border-hos-border">
        <button
          type="button"
          onClick={(e) => handleSubmit(e, 'DRAFT')}
          disabled={saving}
          className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-secondary disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          type="button"
          onClick={(e) => handleSubmit(e, 'PUBLISHED')}
          disabled={saving}
          className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50"
        >
          {saving ? 'Publishing...' : 'Publish'}
        </button>
        {postId && (
          <button
            type="button"
            onClick={handlePreview}
            className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
          >
            Preview
          </button>
        )}
      </div>
    </form>
  );
}
