'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function PublishingDashboardPage() {
  const toast = useToast();
  const [readySubmissions, setReadySubmissions] = useState<any[]>([]);
  const [publishedProducts, setPublishedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<Set<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'ready' | 'published'>('ready');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [readyRes, publishedRes] = await Promise.all([
        apiClient.getReadyToPublish().catch(() => ({ data: [] })),
        apiClient.getPublishedProducts().catch(() => ({ data: [] })),
      ]);
      setReadySubmissions(Array.isArray(readyRes?.data) ? readyRes.data : []);
      setPublishedProducts(Array.isArray(publishedRes?.data) ? publishedRes.data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load publishing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePublish = async (submissionId: string) => {
    try {
      setPublishing((prev) => new Set(prev).add(submissionId));
      await apiClient.publishSubmission(submissionId);
      toast.success('Product published successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to publish product');
    } finally {
      setPublishing((prev) => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
    }
  };

  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) {
      toast.error('No submissions selected');
      return;
    }
    try {
      setBulkPublishing(true);
      const result = await apiClient.bulkPublishSubmissions(Array.from(selectedIds));
      const data = result?.data;
      toast.success(
        `Published ${data?.succeeded ?? selectedIds.size} product(s)` +
          (data?.failed ? `, ${data.failed} failed` : ''),
      );
      setSelectedIds(new Set());
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Bulk publish failed');
    } finally {
      setBulkPublishing(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === readySubmissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(readySubmissions.map((s) => s.id)));
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <AdminLayout>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Publishing Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Review and publish finance-approved products to the marketplace
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-xs">
          <button
            onClick={() => setTab('ready')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'ready' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Ready ({readySubmissions.length})
          </button>
          <button
            onClick={() => setTab('published')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === 'published' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Published ({publishedProducts.length})
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!loading && !error && tab === 'ready' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {readySubmissions.length > 0 && (
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === readySubmissions.length && readySubmissions.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  Select all ({readySubmissions.length})
                </label>
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBulkPublish}
                    disabled={bulkPublishing}
                    className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {bulkPublishing ? 'Publishing...' : `Publish Selected (${selectedIds.size})`}
                  </button>
                )}
              </div>
            )}

            {readySubmissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-lg font-medium">All caught up!</p>
                <p className="text-sm mt-1">No submissions are waiting to be published.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {readySubmissions.map((submission) => {
                  const name =
                    submission.catalogEntry?.title ||
                    submission.product?.name ||
                    submission.productData?.name ||
                    'Untitled Product';
                  const seller = submission.seller?.storeName || 'Unknown Seller';
                  const price = submission.productData?.price;
                  const isPublishing = publishing.has(submission.id);
                  return (
                    <div
                      key={submission.id}
                      className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-3"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(submission.id)}
                        onChange={() => toggleSelect(submission.id)}
                        className="mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">{seller}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                          {price && <span>Price: ${parseFloat(price).toFixed(2)}</span>}
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded font-medium">
                            FINANCE APPROVED
                          </span>
                          {submission.financeApprovedAt && (
                            <span>
                              Approved: {new Date(submission.financeApprovedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handlePublish(submission.id)}
                        disabled={isPublishing}
                        className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {isPublishing ? 'Publishing...' : 'Publish'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!loading && !error && tab === 'published' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {publishedProducts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">No published products yet</p>
                <p className="text-sm mt-1">Products will appear here after publishing.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {publishedProducts.map((product: any) => {
                  const name = product.name || product.catalogEntry?.title || product.productData?.name || 'Untitled';
                  return (
                    <div key={product.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{name}</p>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                            {product.price && (
                              <span>Price: ${parseFloat(product.price).toFixed(2)}</span>
                            )}
                            {product.publishedAt && (
                              <span>
                                Published: {new Date(product.publishedAt).toLocaleDateString()}
                              </span>
                            )}
                            {product.seller?.storeName && (
                              <span>Seller: {product.seller.storeName}</span>
                            )}
                          </div>
                        </div>
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          LIVE
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </RouteGuard>
  );
}
