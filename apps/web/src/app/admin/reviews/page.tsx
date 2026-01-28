'use client';

import { useEffect, useState } from 'react';
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
  createdAt: string;
  product?: {
    id: string;
    name: string;
    images?: { url: string }[];
  };
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  helpfulCount?: number;
  isVerifiedPurchase?: boolean;
}

export default function AdminReviewsPage() {
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
      
      // Auto-select first product if available
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
      
      const response = await apiClient.getProductReviews(productId);
      const reviewList = Array.isArray(response?.data) ? response.data : [];
      setReviews(reviewList);
      
      // Calculate stats
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
      // Don't show error for 404 - just means no reviews
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
    ? reviews.filter(r => r.rating === filterRating)
    : reviews;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        className={i < rating ? 'text-yellow-400' : 'text-gray-300'}
      >
        ★
      </span>
    ));
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Product Reviews</h1>
              <p className="text-gray-600 mt-1">Manage and moderate customer reviews</p>
            </div>
          </div>

          {/* Product Selector */}
          <div className="bg-white rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Product to View Reviews
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase">Total</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalReviews}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase">Average</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats.averageRating.toFixed(1)} ★
                  </p>
                </div>
                {[5, 4, 3, 2, 1].map((star) => (
                  <button
                    key={star}
                    onClick={() => setFilterRating(filterRating === star ? null : star)}
                    className={`bg-white rounded-lg shadow p-4 text-left transition-colors ${
                      filterRating === star ? 'ring-2 ring-purple-500' : ''
                    }`}
                  >
                    <h3 className="text-xs font-medium text-gray-500 uppercase">{star} Star</h3>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {star === 5 ? stats.fiveStars :
                       star === 4 ? stats.fourStars :
                       star === 3 ? stats.threeStars :
                       star === 2 ? stats.twoStars : stats.oneStars}
                    </p>
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">Error: {error}</p>
                  <button
                    onClick={() => selectedProduct && fetchReviews(selectedProduct)}
                    className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Reviews {filterRating && `(${filterRating} stars only)`}
                    </h2>
                    {filterRating && (
                      <button
                        onClick={() => setFilterRating(null)}
                        className="text-sm text-purple-600 hover:underline"
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                  
                  {filteredReviews.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                      <span className="text-4xl block mb-2">📝</span>
                      <p>No reviews found for this product</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredReviews.map((review) => (
                        <div key={review.id} className="p-6 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex">{renderStars(review.rating)}</div>
                                {review.isVerifiedPurchase && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                                    Verified Purchase
                                  </span>
                                )}
                              </div>
                              {review.title && (
                                <h3 className="font-semibold text-gray-900 mb-1">{review.title}</h3>
                              )}
                              <p className="text-gray-600 text-sm mb-2">
                                {review.comment || 'No comment provided'}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>
                                  By: {review.user?.firstName 
                                    ? `${review.user.firstName} ${review.user.lastName || ''}` 
                                    : review.user?.email || 'Anonymous'}
                                </span>
                                <span>
                                  {new Date(review.createdAt).toLocaleDateString()}
                                </span>
                                {review.helpfulCount !== undefined && review.helpfulCount > 0 && (
                                  <span>{review.helpfulCount} found helpful</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteReview(review.id)}
                              className="ml-4 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
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
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
              <span className="text-5xl block mb-4">📋</span>
              <p className="text-lg">Select a product above to view its reviews</p>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
