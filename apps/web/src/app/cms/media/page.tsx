'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { CMSLayout } from '@/components/CMSLayout';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CmsPortalErrorBanner } from '@/components/CmsPortalErrorBanner';
import { cmsActionToastMessage, cmsLoadingErrorMessage } from '@/lib/cmsPortalFeedback';

export default function CMSMediaPage() {
  const toast = useToast();
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getCMSMedia();
      if (response?.data) {
        setMedia(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: unknown) {
      console.error('Error fetching media:', err);
      setError(cmsLoadingErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await apiClient.uploadCMSMedia(formData);
      if (response?.data) {
        await fetchMedia();
      }
    } catch (err: unknown) {
      console.error('Error uploading media:', err);
      toast.error(cmsActionToastMessage(err, 'Failed to upload media'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['CMS_EDITOR', 'ADMIN']}>
      <CMSLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Media Library</h1>
              <p className="text-hos-text-secondary mt-1">Manage your media files</p>
            </div>
            <label className="px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium cursor-pointer">
              {uploading ? 'Uploading...' : '+ Upload Media'}
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*"
                disabled={uploading}
              />
            </label>
          </div>

          {error ? (
            <CmsPortalErrorBanner message={error}>
              <button
                type="button"
                onClick={fetchMedia}
                className="inline-flex rounded-md bg-hos-gold px-4 py-2 text-sm font-medium text-hos-text-secondary hover:bg-hos-gold-hover"
              >
                Retry loading
              </button>
            </CmsPortalErrorBanner>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-hos-text-muted">Loading media...</div>
            </div>
          ) : media.length === 0 ? (
            <div className="text-center py-12 bg-hos-bg-secondary rounded-lg shadow">
              <p className="text-hos-text-muted mb-4">No media files found</p>
              <label className="px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium cursor-pointer inline-block">
                Upload your first file
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,video/*"
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="relative aspect-video bg-hos-bg-tertiary">
                    {item.url ? (
                      <Image
                        src={item.url}
                        alt={item.name || 'Media'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-hos-text-muted">
                        📄
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-hos-text-secondary truncate">
                      {item.name || 'Untitled'}
                    </p>
                    <p className="text-xs text-hos-text-secondary mt-1">
                      {item.mime || 'Unknown type'}
                    </p>
                    {item.size && (
                      <p className="text-xs text-hos-text-secondary mt-1">
                        {(item.size / 1024).toFixed(2)} KB
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CMSLayout>
    </RouteGuard>
  );
}

