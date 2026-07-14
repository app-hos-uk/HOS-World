'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { FileUpload } from '@/components/FileUpload';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface GalleryImage {
  id: string;
  url: string;
  alt?: string | null;
  caption?: string | null;
  order: number;
}

interface GalleryAlbum {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  eventDate?: string | null;
  location?: string | null;
  countryCode?: string | null;
  outletSlug?: string | null;
  uploadFolder?: string;
  coverUrl?: string | null;
  order: number;
  isActive: boolean;
  imageCount?: number;
  images?: GalleryImage[];
}

const EMPTY_ALBUM = {
  title: '',
  description: '',
  location: '',
  countryCode: '',
  outletSlug: '',
  eventDate: '',
  coverUrl: '',
  order: 0,
  isActive: true,
};

export default function AdminGalleryPage() {
  const toast = useToast();
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAlbumForm, setShowAlbumForm] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [albumForm, setAlbumForm] = useState(EMPTY_ALBUM);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<GalleryAlbum | null>(null);

  const fetchAlbums = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getAdminGalleryAlbums();
      if (res?.data) setAlbums(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load gallery albums');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadSelectedAlbum = useCallback(async (id: string) => {
    try {
      const res = await apiClient.getAdminGalleryAlbum(id);
      if (res?.data) setSelectedAlbum(res.data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load album');
    }
  }, [toast]);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

  useEffect(() => {
    if (selectedAlbumId) {
      loadSelectedAlbum(selectedAlbumId);
    } else {
      setSelectedAlbum(null);
    }
  }, [selectedAlbumId, loadSelectedAlbum]);

  const openNewAlbum = () => {
    setEditingAlbumId(null);
    setAlbumForm({ ...EMPTY_ALBUM, order: albums.length });
    setShowAlbumForm(true);
  };

  const openEditAlbum = (album: GalleryAlbum) => {
    setEditingAlbumId(album.id);
    setAlbumForm({
      title: album.title,
      description: album.description || '',
      location: album.location || '',
      countryCode: album.countryCode || '',
      outletSlug: album.outletSlug || '',
      eventDate: album.eventDate ? album.eventDate.slice(0, 10) : '',
      coverUrl: album.coverUrl || '',
      order: album.order,
      isActive: album.isActive,
    });
    setShowAlbumForm(true);
  };

  const handleSaveAlbum = async () => {
    if (!albumForm.title.trim()) {
      toast.error('Event title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: albumForm.title.trim(),
        description: albumForm.description.trim() || undefined,
        location: albumForm.location.trim() || undefined,
        countryCode: albumForm.countryCode.trim() || undefined,
        outletSlug: albumForm.outletSlug.trim() || undefined,
        eventDate: albumForm.eventDate ? new Date(albumForm.eventDate).toISOString() : undefined,
        coverUrl: albumForm.coverUrl || undefined,
        order: albumForm.order,
        isActive: albumForm.isActive,
      };
      if (editingAlbumId) {
        await apiClient.updateGalleryAlbum(editingAlbumId, payload);
        toast.success('Event folder updated');
      } else {
        const res = await apiClient.createGalleryAlbum(payload);
        toast.success('Event folder created');
        if (res?.data?.id) setSelectedAlbumId(res.data.id);
      }
      setShowAlbumForm(false);
      await fetchAlbums();
      if (selectedAlbumId) await loadSelectedAlbum(selectedAlbumId);
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!confirm('Delete this event folder and all its images?')) return;
    try {
      await apiClient.deleteGalleryAlbum(id);
      toast.success('Event folder deleted');
      if (selectedAlbumId === id) setSelectedAlbumId(null);
      await fetchAlbums();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const handleUploadImages = async (urls: string[]) => {
    if (!selectedAlbumId || urls.length === 0) return;
    try {
      await apiClient.addGalleryImagesBulk(
        selectedAlbumId,
        urls.map((url) => ({ url })),
      );
      toast.success(`${urls.length} image(s) added`);
      await loadSelectedAlbum(selectedAlbumId);
      await fetchAlbums();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add images');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Remove this image?')) return;
    try {
      await apiClient.deleteGalleryImage(imageId);
      toast.success('Image removed');
      if (selectedAlbumId) await loadSelectedAlbum(selectedAlbumId);
      await fetchAlbums();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const handleSetCover = async (url: string) => {
    if (!selectedAlbumId) return;
    try {
      await apiClient.updateGalleryAlbum(selectedAlbumId, { coverUrl: url });
      toast.success('Cover image updated');
      await loadSelectedAlbum(selectedAlbumId);
      await fetchAlbums();
    } catch (err: any) {
      toast.error(err.message || 'Failed to set cover');
    }
  };

  const sortedAlbums = [...albums].sort((a, b) => a.order - b.order);

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">Gallery</h1>
            <p className="text-hos-text-secondary mt-1">
              Create event folders and manage photos for the landing gallery
            </p>
          </div>
          <button
            onClick={openNewAlbum}
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm font-medium"
          >
            + New Event Folder
          </button>
        </div>

        {showAlbumForm && (
          <div className="bg-hos-bg-secondary border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingAlbumId ? 'Edit Event Folder' : 'New Event Folder'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary"
                  value={albumForm.title}
                  onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })}
                  placeholder="e.g. Times Square Launch Night"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary"
                  value={albumForm.location}
                  onChange={(e) => setAlbumForm({ ...albumForm, location: e.target.value })}
                  placeholder="e.g. Times Square, New York"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Country / Region</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary"
                  value={albumForm.countryCode}
                  onChange={(e) => setAlbumForm({ ...albumForm, countryCode: e.target.value })}
                  placeholder="e.g. us, uk, ae"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Outlet / Venue</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary"
                  value={albumForm.outletSlug}
                  onChange={(e) => setAlbumForm({ ...albumForm, outletSlug: e.target.value })}
                  placeholder="e.g. times-square, stratford"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Event Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary"
                  value={albumForm.eventDate}
                  onChange={(e) => setAlbumForm({ ...albumForm, eventDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display Order</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary"
                  value={albumForm.order}
                  onChange={(e) => setAlbumForm({ ...albumForm, order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  rows={3}
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary"
                  value={albumForm.description}
                  onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Cover Image URL</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary"
                  value={albumForm.coverUrl}
                  onChange={(e) => setAlbumForm({ ...albumForm, coverUrl: e.target.value })}
                  placeholder="Optional — auto-set from first upload"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="albumActive"
                  checked={albumForm.isActive}
                  onChange={(e) => setAlbumForm({ ...albumForm, isActive: e.target.checked })}
                />
                <label htmlFor="albumActive" className="text-sm font-medium">Active (visible on site)</label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveAlbum}
                disabled={saving}
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg disabled:opacity-50 text-sm font-medium"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowAlbumForm(false)}
                className="px-4 py-2 border rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-hos-bg-secondary border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b font-semibold">Event Folders</div>
              <div className="divide-y max-h-[70vh] overflow-y-auto">
                {sortedAlbums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => setSelectedAlbumId(album.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-hos-bg-tertiary transition-colors ${
                      selectedAlbumId === album.id ? 'bg-hos-bg-tertiary' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {album.coverUrl ? (
                        <img src={album.coverUrl} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-hos-bg-tertiary flex items-center justify-center text-lg">📷</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-hos-text-secondary truncate">{album.title}</p>
                        <p className="text-xs text-hos-text-muted">
                          {album.imageCount ?? album.images?.length ?? 0} photos
                          {album.countryCode && ` · ${album.countryCode.toUpperCase()}`}
                          {album.outletSlug && ` / ${album.outletSlug}`}
                          {!album.isActive && ' · Hidden'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                {sortedAlbums.length === 0 && (
                  <p className="px-4 py-8 text-center text-hos-text-muted text-sm">No event folders yet.</p>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 bg-hos-bg-secondary border rounded-lg p-6">
              {!selectedAlbum ? (
                <p className="text-hos-text-muted text-center py-12">
                  Select an event folder to manage photos, or create a new one.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                    <div>
                      <h2 className="text-xl font-semibold">{selectedAlbum.title}</h2>
                      <p className="text-sm text-hos-text-muted mt-1">
                        /gallery/{selectedAlbum.slug}
                        {selectedAlbum.location && ` · ${selectedAlbum.location}`}
                      </p>
                      {selectedAlbum.uploadFolder && (
                        <p className="text-xs text-hos-text-muted mt-1 font-mono">
                          Storage: {selectedAlbum.uploadFolder}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditAlbum(selectedAlbum)}
                        className="px-3 py-1.5 border rounded-lg text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteAlbum(selectedAlbum.id)}
                        className="px-3 py-1.5 border border-red-500/40 text-red-400 rounded-lg text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2">Upload Photos</h3>
                    <FileUpload
                      multiple
                      folder={selectedAlbum.uploadFolder || `gallery/global/general/${selectedAlbum.slug}`}
                      maxSize={10}
                      onUploadMultipleComplete={handleUploadImages}
                    />
                  </div>

                  <h3 className="text-sm font-semibold mb-3">
                    Photos ({selectedAlbum.images?.length ?? 0})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(selectedAlbum.images || []).map((img) => (
                      <div key={img.id} className="relative group border rounded-lg overflow-hidden">
                        <img src={img.url} alt={img.alt || ''} className="w-full aspect-square object-cover" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                          <button
                            type="button"
                            onClick={() => handleSetCover(img.url)}
                            className="text-xs text-white bg-hos-gold/80 px-2 py-1 rounded"
                          >
                            Set Cover
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(img.id)}
                            className="text-xs text-white bg-red-600/80 px-2 py-1 rounded"
                          >
                            Remove
                          </button>
                        </div>
                        {selectedAlbum.coverUrl === img.url && (
                          <span className="absolute top-1 left-1 text-[10px] bg-hos-gold text-[#1a1406] px-1.5 py-0.5 rounded font-medium">
                            Cover
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {(selectedAlbum.images?.length ?? 0) === 0 && (
                    <p className="text-sm text-hos-text-muted py-8 text-center">
                      No photos yet. Upload images above.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
          </RouteGuard>
  );
}
