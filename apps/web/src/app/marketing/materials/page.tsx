'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function MarketingMaterialsPage() {
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'library'>('pending');
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [markingCompleteId, setMarkingCompleteId] = useState<string | null>(null);

  // Form state
  const [materialType, setMaterialType] = useState<string>('BANNER');
  const [materialUrl, setMaterialUrl] = useState('');
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const toast = useToast();

  const marketingFileInputId = 'marketing-material-upload';

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPending();
    } else {
      fetchMaterials();
    }
  }, [activeTab]);

  useEffect(() => {
    const refresh = () => {
      if (activeTab === 'pending') fetchPending();
      else fetchMaterials();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchPending = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getMarketingPending();
      if (response?.data) {
        setPendingSubmissions(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching pending:', err);
      setError(err.message || 'Failed to load pending submissions');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getMarketingMaterials();
      if (response?.data) {
        setMaterials(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching materials:', err);
      setError(err.message || 'Failed to load materials');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaterial = (submission: any) => {
    setSelectedSubmission(submission);
    setMaterialType('BANNER');
    setMaterialUrl('');
    setShowModal(true);
  };

  const handleMarkComplete = async (submissionId: string) => {
    try {
      setMarkingCompleteId(submissionId);
      await apiClient.markMarketingComplete(submissionId);
      toast.success('Submission marked as complete');
      await fetchPending();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as complete');
    } finally {
      setMarkingCompleteId(null);
    }
  };

  const uploadMarketingFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSizeBytes = 250 * 1024; // 250KB
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
      return;
    }
    if (file.size > maxSizeBytes) {
      toast.error('Max file size is 250KB');
      return;
    }
    try {
      setUploadingMaterial(true);
      const res = await apiClient.uploadSingleFile(file, 'marketing');
      const url = res?.data?.url;
      if (url) {
        setMaterialUrl(url);
        toast.success('File uploaded');
      } else {
        throw new Error('Upload failed (no URL returned)');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload file');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSubmission || !materialUrl.trim()) {
      toast.error('Material URL is required');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.createMarketingMaterial({
        submissionId: selectedSubmission.id,
        type: materialType,
        url: materialUrl.trim(),
      });
      setShowModal(false);
      setSelectedSubmission(null);
      setMaterialUrl('');
      toast.success('Marketing material created successfully');
      if (activeTab === 'pending') {
        await fetchPending();
      } else {
        await fetchMaterials();
      }
    } catch (err: any) {
      console.error('Error creating material:', err);
      toast.error(err.message || 'Failed to create marketing material');
    } finally {
      setActionLoading(false);
    }
  };

  const menuItems = [
    { title: 'Dashboard', href: '/marketing/dashboard', icon: '📊' },
    { title: 'Marketing Materials', href: '/marketing/materials', icon: '📢', badge: pendingSubmissions.length },
  ];

  return (
    <RouteGuard allowedRoles={['MARKETING', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="MARKETING" menuItems={menuItems} title="Marketing">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Marketing Materials</h1>
          <p className="text-gray-600 mt-2">Create and manage marketing materials for products</p>
        </div>

          {/* Tabs */}
          <div className="mb-6 flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pending Products
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'library'
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Materials Library
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              <p className="font-semibold">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {activeTab === 'pending' && !loading && pendingSubmissions.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No pending products for marketing materials</p>
            </div>
          )}

          {activeTab === 'library' && !loading && materials.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No marketing materials created yet</p>
            </div>
          )}

          {activeTab === 'pending' && !loading && pendingSubmissions.length > 0 && (
            <div className="space-y-4">
              {pendingSubmissions.map((submission) => {
                const productData = submission.productData || {};
                return (
                  <div
                    key={submission.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {productData.name || 'Untitled Product'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Seller: {submission.seller?.storeName || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {productData.description || 'No description'}
                        </p>
                        {submission.marketingMaterials?.length > 0 && (
                          <p className="text-xs text-green-600 mt-2 font-medium">
                            {submission.marketingMaterials.length} material(s) added
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleCreateMaterial(submission)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap"
                        >
                          Create Material
                        </button>
                        {submission.marketingMaterials?.length > 0 && (
                          <button
                            onClick={() => handleMarkComplete(submission.id)}
                            disabled={markingCompleteId === submission.id}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {markingCompleteId === submission.id ? (
                              <>
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent align-middle mr-1" aria-hidden />
                                Completing…
                              </>
                            ) : (
                              'Mark Complete'
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'library' && !loading && materials.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {materials.map((material) => {
                const productData = material.submission?.productData || {};
                return (
                  <div
                    key={material.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-video bg-gray-100 rounded mb-3 overflow-hidden">
                      {material.url ? (
                        <Image
                          src={material.url}
                          alt={material.type}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {productData.name || 'Unknown Product'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{material.type}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(material.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Material Modal */}
          {showModal && selectedSubmission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Create Marketing Material</h2>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedSubmission(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Product</p>
                      <p className="text-gray-900">
                        {selectedSubmission.productData?.name || 'Unknown'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Material Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={materialType}
                        onChange={(e) => setMaterialType(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="BANNER">Banner</option>
                        <option value="CREATIVE">Creative</option>
                        <option value="PRODUCT_IMAGE">Product Image</option>
                        <option value="CAMPAIGN_ASSET">Campaign Asset</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Material URL <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <input
                          id={marketingFileInputId}
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          disabled={uploadingMaterial}
                          onChange={(e) => {
                            uploadMarketingFile(e.target.files);
                            e.target.value = '';
                          }}
                        />
                        <label
                          htmlFor={marketingFileInputId}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-50 transition-colors ${uploadingMaterial ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {uploadingMaterial ? (
                            <>
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-purple-600" aria-hidden />
                              Uploading…
                            </>
                          ) : (
                            <>📤 Upload file</>
                          )}
                        </label>
                        <span className="text-xs text-gray-500">JPEG, PNG, GIF, WebP · max 250KB</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">Or paste a URL:</p>
                      <input
                        type="url"
                        value={materialUrl}
                        onChange={(e) => setMaterialUrl(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="https://example.com/image.jpg"
                      />
                      {materialUrl && (
                        <div className="relative mt-2 h-32 w-full max-w-md">
                          <Image
                            src={materialUrl}
                            alt="Preview"
                            fill
                            className="object-contain border rounded"
                            sizes="(max-width: 768px) 100vw, 28rem"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSubmit}
                        disabled={actionLoading || !materialUrl.trim()}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {actionLoading ? 'Creating...' : 'Create Material'}
                      </button>
                      <button
                        onClick={() => {
                          setShowModal(false);
                          setSelectedSubmission(null);
                        }}
                        disabled={actionLoading}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
      </DashboardLayout>
    </RouteGuard>
  );
}

