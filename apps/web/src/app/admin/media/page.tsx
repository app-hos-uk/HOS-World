'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { SafeImage } from '@/components/SafeImage';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  alt: string | null;
  type: string;
  productId: string;
  productName: string | null;
  createdAt: string | null;
}

interface MediaResponse {
  items: MediaAsset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function AdminMediaLibraryPage() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 24;

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Preview modal
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getMediaAssets(page, limit);
      if (response?.data) {
        const data = response.data as MediaResponse;
        setAssets(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err: any) {
      console.error('Error fetching media assets:', err);
      setError(err.message || 'Failed to load media assets');
      toast.error(err.message || 'Failed to load media assets');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const filteredAssets = useMemo(() => {
    if (!debouncedSearch) return assets;
    const term = debouncedSearch.toLowerCase();
    return assets.filter(
      (a) =>
        a.filename.toLowerCase().includes(term) ||
        a.productName?.toLowerCase().includes(term) ||
        a.alt?.toLowerCase().includes(term)
    );
  }, [assets, debouncedSearch]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      const file = files[0];

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'uploads');

      await toast.promise(
        fetch(`${getPublicApiBaseUrl() || 'http://localhost:3001/api'}/uploads/single`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData,
        }).then((res) => {
          if (!res.ok) throw new Error('Upload failed');
          return res.json();
        }),
        {
          loading: 'Uploading file...',
          success: 'File uploaded successfully',
          error: (err) => err.message || 'Failed to upload file',
        }
      );

      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchAssets();
    } catch (err: any) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (asset: MediaAsset) => {
    if (!confirm(`Delete "${asset.filename}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await toast.promise(
        apiClient.deleteMediaAsset(encodeURIComponent(asset.url)),
        {
          loading: 'Deleting file...',
          success: 'File deleted successfully',
          error: (err: any) => err.message || 'Failed to delete file',
        }
      );
      await fetchAssets();
    } catch (err: any) {
      console.error('Delete error:', err);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast.success('URL copied to clipboard');
    });
  };

  const formatFileSize = (url: string) => {
    // File size isn't stored in DB; show type/extension instead
    const ext = url.split('.').pop()?.toUpperCase() || 'FILE';
    return ext;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Media Library</h1>
              <p className="text-hos-text-secondary mt-1">
                Manage uploaded images and media assets ({total} total)
              </p>
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
                id="media-upload"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : '+ Upload Image'}
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by filename or product name..."
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => fetchAssets()}
                  className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
              <div className="text-4xl mb-3">⚠️</div>
              <p className="text-red-400 font-medium mb-2">Failed to load media</p>
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button
                onClick={() => fetchAssets()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredAssets.length === 0 && (
            <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-8 text-center">
              <div className="text-5xl mb-4">🖼️</div>
              <p className="text-hos-text-muted text-lg mb-2">
                {debouncedSearch ? 'No matching media found' : 'No media assets yet'}
              </p>
              <p className="text-hos-text-muted text-sm mb-4">
                {debouncedSearch
                  ? 'Try adjusting your search term'
                  : 'Upload images to get started'}
              </p>
              {!debouncedSearch && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover"
                >
                  Upload Your First Image
                </button>
              )}
            </div>
          )}

          {/* Media Grid */}
          {!loading && !error && filteredAssets.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-hos-bg-secondary border border-hos-border rounded-lg overflow-hidden hover:shadow-lg transition-all group"
                >
                  {/* Thumbnail */}
                  <button
                    onClick={() => setPreviewAsset(asset)}
                    className="w-full aspect-square bg-hos-bg-tertiary relative cursor-pointer"
                  >
                    <SafeImage
                      src={asset.url}
                      alt={asset.alt || asset.filename}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm bg-black/60 px-2 py-1 rounded">
                        Preview
                      </span>
                    </div>
                    <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-medium bg-black/50 text-white rounded">
                      {formatFileSize(asset.url)}
                    </span>
                  </button>

                  {/* Info */}
                  <div className="p-2">
                    <p
                      className="text-xs font-medium text-hos-text-secondary truncate"
                      title={asset.filename}
                    >
                      {asset.filename}
                    </p>
                    {asset.productName && (
                      <p className="text-[10px] text-hos-text-muted truncate mt-0.5" title={asset.productName}>
                        {asset.productName}
                      </p>
                    )}
                    <p className="text-[10px] text-hos-text-muted mt-0.5">
                      {formatDate(asset.createdAt)}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => copyUrl(asset.url)}
                        className="flex-1 px-2 py-1 text-[10px] bg-hos-bg-tertiary text-hos-text-secondary rounded hover:bg-hos-bg-tertiary transition-colors"
                        title="Copy URL"
                      >
                        Copy URL
                      </button>
                      <button
                        onClick={() => handleDelete(asset)}
                        className="px-2 py-1 text-[10px] bg-red-500/10 text-red-400 rounded hover:bg-red-500/15 transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between bg-hos-bg-secondary rounded-lg shadow px-4 py-3">
              <p className="text-sm text-hos-text-secondary">
                Showing {(page - 1) * limit + 1}–
                {Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1.5 text-sm rounded-lg ${
                        page === pageNum
                          ? 'bg-hos-gold text-[#1a1406]'
                          : 'border border-hos-border hover:bg-hos-bg-tertiary'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Preview Modal */}
          {previewAsset && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
              <div className="bg-hos-bg-secondary rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-hos-text-secondary">
                        {previewAsset.filename}
                      </h2>
                      {previewAsset.productName && (
                        <p className="text-sm text-hos-text-muted mt-1">
                          Product: {previewAsset.productName}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setPreviewAsset(null)}
                      className="text-hos-text-muted hover:text-hos-text-secondary text-2xl leading-none"
                    >
                      ×
                    </button>
                  </div>

                  <div className="relative w-full aspect-video bg-hos-bg-tertiary rounded-lg overflow-hidden mb-4">
                    <SafeImage
                      src={previewAsset.url}
                      alt={previewAsset.alt || previewAsset.filename}
                      fill
                      className="object-contain"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                    <div className="bg-hos-bg-secondary p-3 rounded">
                      <p className="text-hos-text-muted">Type</p>
                      <p className="font-medium">
                        {formatFileSize(previewAsset.url)}
                      </p>
                    </div>
                    <div className="bg-hos-bg-secondary p-3 rounded">
                      <p className="text-hos-text-muted">Image Type</p>
                      <p className="font-medium">{previewAsset.type}</p>
                    </div>
                    <div className="bg-hos-bg-secondary p-3 rounded">
                      <p className="text-hos-text-muted">Uploaded</p>
                      <p className="font-medium">
                        {formatDate(previewAsset.createdAt)}
                      </p>
                    </div>
                    <div className="bg-hos-bg-secondary p-3 rounded">
                      <p className="text-hos-text-muted">Alt Text</p>
                      <p className="font-medium">
                        {previewAsset.alt || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-hos-bg-secondary p-3 rounded mb-4">
                    <p className="text-xs text-hos-text-muted mb-1">URL</p>
                    <p className="text-sm text-hos-text-secondary break-all font-mono">
                      {previewAsset.url}
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-hos-border">
                    <button
                      onClick={() => copyUrl(previewAsset.url)}
                      className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm"
                    >
                      Copy URL
                    </button>
                    <a
                      href={previewAsset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary text-sm"
                    >
                      Open in New Tab
                    </a>
                    <button
                      onClick={() => {
                        setPreviewAsset(null);
                        handleDelete(previewAsset);
                      }}
                      className="px-4 py-2 bg-red-500/15 text-red-400 rounded-lg hover:bg-red-200 text-sm ml-auto"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setPreviewAsset(null)}
                      className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
