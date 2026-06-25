'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Review {
  id: string;
  rating: number;
  title?: string;
  comment?: string;
  productId: string;
  userId: string;
  status?: string;
  verified?: boolean;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    slug?: string;
    images?: { url: string }[];
  };
  user?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  helpfulCount?: number;
  isVerifiedPurchase?: boolean;
}

type ModerationFilter = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';

const PAGE_SIZE = 20;

function renderStars(rating: number) {
  return Array.from({ length: 5 }).map((_, i) => (
    <span key={i} className={i < rating ? 'text-yellow-400' : 'text-hos-text-muted'}>
      ★
    </span>
  ));
}

function statusBadge(status?: string) {
  const normalized = (status || '').toUpperCase();
  const styles: Record<string, string> = {
    PENDING: 'bg-yellow-500/15 text-yellow-300',
    APPROVED: 'bg-green-500/15 text-green-300',
    REJECTED: 'bg-red-500/15 text-red-300',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full ${styles[normalized] || 'bg-hos-bg-tertiary text-hos-text-muted'}`}>
      {normalized || 'UNKNOWN'}
    </span>
  );
}

function reviewerName(review: Review) {
  if (review.user?.firstName) {
    return `${review.user.firstName} ${review.user.lastName || ''}`.trim();
  }
  return review.user?.email || 'Anonymous';
}

function ModerationQueue() {
  const toast = useToast();
  const [filter, setFilter] = useState<ModerationFilter>('PENDING');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response =
        filter === 'PENDING'
          ? await apiClient.getPendingReviews({ page, limit: PAGE_SIZE })
          : await apiClient.getAdminReviews({
              status: filter === 'ALL' ? undefined : filter,
              page,
              limit: PAGE_SIZE,
            });

      const payload = response?.data as { reviews?: Review[]; pagination?: any } | undefined;
      const list = Array.isArray(payload?.reviews) ? payload!.reviews : [];
      setReviews(list);
      setTotalPages(payload?.pagination?.totalPages ?? 1);
      setTotal(payload?.pagination?.total ?? list.length);
    } catch (err: any) {
      setError(err?.message || 'Failed to load reviews');
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleFilterChange = (next: ModerationFilter) => {
    setPage(1);
    setFilter(next);
  };

  const handleModerate = async (reviewId: string, action: 'approve' | 'reject') => {
    try {
      setActioningId(reviewId);
      if (action === 'approve') {
        await apiClient.approveReview(reviewId);
        toast.success('Review approved');
      } else {
        await apiClient.rejectReview(reviewId);
        toast.success('Review rejected');
      }
      if (filter === 'PENDING') {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        setTotal((t) => {
          const newTotal = Math.max(0, t - 1);
          const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
          setTotalPages(newTotalPages);
          setPage((p) => Math.min(p, newTotalPages));
          return newTotal;
        });
      } else {
        fetchReviews();
      }
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${action} review`);
    } finally {
      setActioningId(null);
    }
  };

  const filterTabs: { key: ModerationFilter; label: string }[] = [
    { key: 'PENDING', label: 'Pending' },
    { key: 'APPROVED', label: 'Approved' },
    { key: 'REJECTED', label: 'Rejected' },
    { key: 'ALL', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleFilterChange(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === t.key
                ? 'bg-hos-gold text-hos-bg-primary'
                : 'bg-hos-bg-secondary text-hos-text-secondary hover:bg-hos-bg-tertiary'
            }`}
          >
            {t.label}
            {filter === t.key && total > 0 ? ` (${total})` : ''}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold"></div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-300">Error: {error}</p>
          <button
            onClick={fetchReviews}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
          {reviews.length === 0 ? (
            <div className="px-6 py-12 text-center text-hos-text-muted">
              <span className="text-4xl block mb-2">✅</span>
              <p>
                {filter === 'PENDING'
                  ? 'No reviews awaiting moderation'
                  : `No ${filter.toLowerCase()} reviews found`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-hos-border">
              {reviews.map((review) => (
                <div key={review.id} className="p-6 hover:bg-hos-bg-tertiary">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <div className="flex">{renderStars(review.rating)}</div>
                        {statusBadge(review.status)}
                        {(review.verified || review.isVerifiedPurchase) && (
                          <span className="px-2 py-0.5 bg-green-500/15 text-green-300 text-xs rounded-full">
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      {review.product?.name && (
                        <p className="text-sm text-hos-gold mb-1">
                          Product: {review.product.name}
                        </p>
                      )}
                      {review.title && (
                        <h3 className="font-semibold text-hos-text-secondary mb-1">{review.title}</h3>
                      )}
                      <p className="text-hos-text-secondary text-sm mb-2">
                        {review.comment || 'No comment provided'}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-hos-text-muted">
                        <span>By: {reviewerName(review)}</span>
                        <span>{new Date(review.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {(review.status || '').toUpperCase() === 'PENDING' && (
                      <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
                        <button
                          onClick={() => handleModerate(review.id, 'approve')}
                          disabled={actioningId === review.id}
                          className="px-4 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                        >
                          {actioningId === review.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleModerate(review.id, 'reject')}
                          disabled={actioningId === review.id}
                          className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {actioningId === review.id ? '...' : 'Reject'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-hos-border flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm bg-hos-bg-tertiary rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-hos-text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm bg-hos-bg-tertiary rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewsByProduct() {
  const toast = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    fiveStars: 0,
    fourStars: 0,
    threeStars: 0,
    twoStars: 0,
    oneStars: 0,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchReviews(selectedProduct);
    }
  }, [selectedProduct]);

  const fetchProducts = async () => {
    try {
      const response = await apiClient.getAdminProducts({ page: 1, limit: 100 });
      const raw = response?.data as { products?: unknown[]; data?: unknown[] } | unknown[] | undefined;
      const productList = Array.isArray(raw) ? raw : (raw as any)?.products ?? (raw as any)?.data ?? [];
      setProducts(Array.isArray(productList) ? productList : []);
      if (Array.isArray(productList) && productList.length > 0) {
        setSelectedProduct(productList[0].id);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.message || 'Failed to load products');
    }
  };

  const fetchReviews = async (productId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getProductReviews(productId, { page: 1, limit: 500 });
      const rawList = Array.isArray(response?.data) ? response.data : [];
      const reviewList: Review[] = rawList.map((r: any) => ({
        ...r,
        isVerifiedPurchase: r.isVerifiedPurchase ?? r.verified,
        helpfulCount: r.helpfulCount ?? r.helpful ?? 0,
      }));
      setReviews(reviewList);

      if (reviewList.length > 0) {
        const avgRating = reviewList.reduce((sum: number, r: Review) => sum + r.rating, 0) / reviewList.length;
        setStats({
          totalReviews: reviewList.length,
          averageRating: avgRating,
          fiveStars: reviewList.filter((r: Review) => r.rating === 5).length,
          fourStars: reviewList.filter((r: Review) => r.rating === 4).length,
          threeStars: reviewList.filter((r: Review) => r.rating === 3).length,
          twoStars: reviewList.filter((r: Review) => r.rating === 2).length,
          oneStars: reviewList.filter((r: Review) => r.rating === 1).length,
        });
      } else {
        setStats({
          totalReviews: 0,
          averageRating: 0,
          fiveStars: 0,
          fourStars: 0,
          threeStars: 0,
          twoStars: 0,
          oneStars: 0,
        });
      }
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      if (err.message?.includes('404')) {
        setReviews([]);
      } else {
        setError(err.message || 'Failed to load reviews');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      await apiClient.deleteReview(reviewId);
      toast.success('Review deleted successfully');
      if (selectedProduct) {
        fetchReviews(selectedProduct);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review');
    }
  };

  const filteredReviews = filterRating
    ? reviews.filter((r) => r.rating === filterRating)
    : reviews;

  return (
    <div className="space-y-6">
      <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-hos-text-secondary mb-2">
          Select Product to View Reviews
        </label>
        <select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
        >
          <option value="">-- Select a product --</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku || 'No SKU'})
            </option>
          ))}
        </select>
      </div>

      {selectedProduct && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Total</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">{stats.totalReviews}</p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Average</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">
                {stats.averageRating.toFixed(1)} ★
              </p>
            </div>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                onClick={() => setFilterRating(filterRating === star ? null : star)}
                className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-colors ${
                  filterRating === star ? 'ring-2 ring-hos-gold/50' : ''
                }`}
              >
                <h3 className="text-xs font-medium text-hos-text-muted uppercase">{star} Star</h3>
                <p className="text-2xl font-bold text-hos-text-secondary mt-1">
                  {star === 5
                    ? stats.fiveStars
                    : star === 4
                    ? stats.fourStars
                    : star === 3
                    ? stats.threeStars
                    : star === 2
                    ? stats.twoStars
                    : stats.oneStars}
                </p>
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button
                onClick={() => selectedProduct && fetchReviews(selectedProduct)}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-hos-border flex items-center justify-between">
                <h2 className="text-lg font-semibold text-hos-text-secondary">
                  Reviews {filterRating && `(${filterRating} stars only)`}
                </h2>
                {filterRating && (
                  <button
                    onClick={() => setFilterRating(null)}
                    className="text-sm text-hos-gold hover:underline"
                  >
                    Clear filter
                  </button>
                )}
              </div>

              {filteredReviews.length === 0 ? (
                <div className="px-6 py-12 text-center text-hos-text-muted">
                  <span className="text-4xl block mb-2">📝</span>
                  <p>No reviews found for this product</p>
                </div>
              ) : (
                <div className="divide-y divide-hos-border">
                  {filteredReviews.map((review) => (
                    <div key={review.id} className="p-6 hover:bg-hos-bg-tertiary">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="flex">{renderStars(review.rating)}</div>
                            {review.isVerifiedPurchase && (
                              <span className="px-2 py-0.5 bg-green-500/15 text-green-300 text-xs rounded-full">
                                Verified Purchase
                              </span>
                            )}
                          </div>
                          {review.title && (
                            <h3 className="font-semibold text-hos-text-secondary mb-1">{review.title}</h3>
                          )}
                          <p className="text-hos-text-secondary text-sm mb-2">
                            {review.comment || 'No comment provided'}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-hos-text-muted">
                            <span>By: {reviewerName(review)}</span>
                            <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                            {review.helpfulCount !== undefined && review.helpfulCount > 0 && (
                              <span>{review.helpfulCount} found helpful</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteReview(review.id)}
                          className="ml-4 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!selectedProduct && !loading && (
        <div className="bg-hos-bg-secondary rounded-lg shadow p-12 text-center text-hos-text-muted">
          <span className="text-5xl block mb-4">📋</span>
          <p className="text-lg">Select a product above to view its reviews</p>
        </div>
      )}
    </div>
  );
}

export default function AdminReviewsPage() {
  const [tab, setTab] = useState<'moderation' | 'byProduct'>('moderation');

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Product Reviews</h1>
              <p className="text-hos-text-secondary mt-1">Moderate customer reviews and browse them by product</p>
            </div>
          </div>

          <div className="flex border-b border-hos-border">
            <button
              onClick={() => setTab('moderation')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'moderation'
                  ? 'border-hos-gold text-hos-gold'
                  : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary'
              }`}
            >
              Moderation Queue
            </button>
            <button
              onClick={() => setTab('byProduct')}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'byProduct'
                  ? 'border-hos-gold text-hos-gold'
                  : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary'
              }`}
            >
              By Product
            </button>
          </div>

          {tab === 'moderation' ? <ModerationQueue /> : <ReviewsByProduct />}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
