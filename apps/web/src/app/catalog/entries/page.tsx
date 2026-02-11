'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import Image from 'next/image';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type CatalogStatusTab = 'pending' | 'in_progress' | 'completed';

const VALID_STATUS_PARAMS: CatalogStatusTab[] = ['pending', 'in_progress', 'completed'];

function parseStatusParam(value: string | null): CatalogStatusTab | null {
  if (!value) return null;
  return VALID_STATUS_PARAMS.includes(value as CatalogStatusTab) ? (value as CatalogStatusTab) : null;
}

export default function CatalogEntriesPage() {
  const searchParams = useSearchParams();
  const statusFilter = parseStatusParam(searchParams.get('status'));

  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [inProgressEntries, setInProgressEntries] = useState<any[]>([]);
  const [completedEntries, setCompletedEntries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<CatalogStatusTab>(
    statusFilter === 'completed'
      ? 'completed'
      : statusFilter === 'in_progress'
        ? 'in_progress'
        : 'pending',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const toast = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (statusFilter === 'completed') {
      setActiveTab('completed');
    } else if (statusFilter === 'in_progress') {
      setActiveTab('in_progress');
    } else if (statusFilter === 'pending') {
      setActiveTab('pending');
    }
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pendingRes, inProgressRes, completedRes] = await Promise.all([
        apiClient.getCatalogPending(),
        apiClient.getCatalogEntries('in_progress'),
        apiClient.getCatalogEntries('completed'),
      ]);
      if (pendingRes?.data) {
        setPendingSubmissions(pendingRes.data);
      }
      if (inProgressRes?.data) {
        setInProgressEntries(inProgressRes.data);
      }
      if (completedRes?.data) {
        setCompletedEntries(completedRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching catalog data:', err);
      setError(err.message || 'Failed to load catalog data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEntry = async (submissionId: string) => {
    try {
      const response = await apiClient.getCatalogSubmission(submissionId);
      if (response?.data) {
        const submission = response.data;
        const productData = submission.productData || {};
        setSelectedSubmission(submission);
        setTitle(productData.name || '');
        setDescription(productData.description || '');
        setKeywords(productData.tags || []);
        setImages(productData.images?.map((img: any) => img.url) || []);
        setShowModal(true);
      }
    } catch (err: any) {
      console.error('Error fetching submission:', err);
      setError(err.message || 'Failed to load submission details');
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword('');
    }
  };

  const removeKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const addImage = () => {
    if (newImageUrl.trim() && !images.includes(newImageUrl.trim())) {
      setImages([...images, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedSubmission || !title.trim() || !description.trim() || images.length === 0) {
      toast.error('Title, description, and at least one image are required');
      return;
    }

    try {
      setActionLoading(true);
      await apiClient.createCatalogEntry(selectedSubmission.id, {
        title: title.trim(),
        description: description.trim(),
        keywords: keywords,
        images: images,
      });
      setShowModal(false);
      setSelectedSubmission(null);
      setTitle('');
      setDescription('');
      setKeywords([]);
      setImages([]);
      toast.success('Catalog entry created successfully');
      await fetchData();
    } catch (err: any) {
      console.error('Error creating catalog entry:', err);
      toast.error(err.message || 'Failed to create catalog entry');
    } finally {
      setActionLoading(false);
    }
  };

  const menuItems = [
    { title: 'Dashboard', href: '/catalog/dashboard', icon: '📊' },
    { title: 'Catalog Entries', href: '/catalog/entries', icon: '📚', badge: pendingSubmissions.length },
  ];

  return (
    <RouteGuard allowedRoles={['CATALOG', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="CATALOG" menuItems={menuItems} title="Catalog">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Catalog Entries</h1>
          <p className="text-gray-600 mt-2">Create marketplace-ready product listings</p>
        </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'pending'
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending ({pendingSubmissions.length})
            </button>
            <button
              onClick={() => setActiveTab('in_progress')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'in_progress'
                  ? 'bg-white text-yellow-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              In Progress ({inProgressEntries.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'completed'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Completed ({completedEntries.length})
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

          {/* Pending Submissions Tab */}
          {!loading && activeTab === 'pending' && pendingSubmissions.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No pending submissions for catalog creation</p>
            </div>
          )}

          {!loading && activeTab === 'pending' && pendingSubmissions.length > 0 && (
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
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                          {productData.sku && (
                            <span>
                              <strong>SKU:</strong> {productData.sku}
                            </span>
                          )}
                          {productData.price && (
                            <span>
                              <strong>Price:</strong> {productData.currency || 'GBP'}{' '}
                              {parseFloat(productData.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCreateEntry(submission.id)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap"
                        >
                          Create Entry
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* In Progress Entries Tab */}
          {!loading && activeTab === 'in_progress' && inProgressEntries.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No entries in progress</p>
              <p className="text-sm text-gray-400 mt-1">Catalog entries not yet completed will appear here</p>
            </div>
          )}

          {!loading && activeTab === 'in_progress' && inProgressEntries.length > 0 && (
            <div className="space-y-4">
              {inProgressEntries.map((entry) => {
                const submission = entry.submission || {};
                const productData = submission.productData || {};
                return (
                  <div
                    key={entry.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {entry.title || productData.name || 'Untitled Product'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Seller: {submission.seller?.storeName || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {entry.description || productData.description || 'No description'}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                          {entry.keywords && entry.keywords.length > 0 && (
                            <span>
                              <strong>Keywords:</strong> {entry.keywords.join(', ')}
                            </span>
                          )}
                          {entry.createdAt && (
                            <span>
                              <strong>Started:</strong> {new Date(entry.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            In progress
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completed Entries Tab */}
          {!loading && activeTab === 'completed' && completedEntries.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No completed catalog entries yet</p>
            </div>
          )}

          {!loading && activeTab === 'completed' && completedEntries.length > 0 && (
            <div className="space-y-4">
              {completedEntries.map((entry) => {
                const submission = entry.submission || {};
                const productData = submission.productData || {};
                return (
                  <div
                    key={entry.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {entry.title || productData.name || 'Untitled Product'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Seller: {submission.seller?.storeName || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {entry.description || productData.description || 'No description'}
                        </p>
                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                          {entry.keywords && entry.keywords.length > 0 && (
                            <span>
                              <strong>Keywords:</strong> {entry.keywords.join(', ')}
                            </span>
                          )}
                          {entry.completedAt && (
                            <span>
                              <strong>Completed:</strong> {new Date(entry.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {submission.status || 'COMPLETED'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Entry Modal */}
          {showModal && selectedSubmission && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Create Catalog Entry</h2>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Product title"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        rows={6}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Product description"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Keywords
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addKeyword();
                            }
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Add keyword"
                        />
                        <button
                          onClick={addKeyword}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Add
                        </button>
                      </div>
                      {keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {keywords.map((keyword, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                            >
                              {keyword}
                              <button
                                onClick={() => removeKeyword(index)}
                                className="text-purple-600 hover:text-purple-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Images <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="url"
                          value={newImageUrl}
                          onChange={(e) => setNewImageUrl(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addImage();
                            }
                          }}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="Image URL"
                        />
                        <button
                          onClick={addImage}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                        >
                          Add
                        </button>
                      </div>
                      {images.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                          {images.map((url, index) => (
                            <div key={index} className="relative h-24">
                              <Image
                                src={url}
                                alt={`Product ${index + 1}`}
                                fill
                                className="object-cover rounded"
                                sizes="33vw"
                              />
                              <button
                                onClick={() => removeImage(index)}
                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-700"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSubmit}
                        disabled={actionLoading || !title.trim() || !description.trim() || images.length === 0}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {actionLoading ? 'Creating...' : 'Create Entry'}
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

