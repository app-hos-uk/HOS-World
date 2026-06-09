'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { apiClient } from '@/lib/api';

interface ImageUploaderProps {
  imageUrl: string;
  altText: string;
  imageTitle: string;
  onChange: (field: 'coverImage' | 'coverImageAlt' | 'coverImageTitle', value: string) => void;
}

export function ImageUploader({ imageUrl, altText, imageTitle, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.uploadCMSMedia(formData);
      const url = response?.data?.url || response?.data?.original?.url;
      if (url) onChange('coverImage', url);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-hos-text-secondary">Featured Image</label>

      {imageUrl && (
        <div className="relative w-full max-w-sm aspect-video rounded-lg overflow-hidden border border-hos-border">
          <Image src={imageUrl} alt={altText || 'Featured image'} fill className="object-cover" />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 text-sm bg-hos-bg-tertiary border border-hos-border rounded-lg hover:bg-hos-bg-secondary disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : imageUrl ? 'Change Image' : 'Upload Image'}
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={() => onChange('coverImage', '')}
            className="px-4 py-2 text-sm text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10"
          >
            Remove
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      <div>
        <label className="block text-xs text-hos-text-muted mb-1">Alt Text (required for SEO)</label>
        <input
          type="text"
          value={altText}
          onChange={(e) => onChange('coverImageAlt', e.target.value)}
          className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary text-sm focus:outline-none focus:border-hos-gold"
          placeholder="Describe the image for screen readers and SEO"
        />
      </div>

      <div>
        <label className="block text-xs text-hos-text-muted mb-1">Image Title</label>
        <input
          type="text"
          value={imageTitle}
          onChange={(e) => onChange('coverImageTitle', e.target.value)}
          className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary text-sm focus:outline-none focus:border-hos-gold"
          placeholder="Image title attribute"
        />
      </div>
    </div>
  );
}
