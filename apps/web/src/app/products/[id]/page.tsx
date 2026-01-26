'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AIChatInterface } from '@/components/AIChatInterface';
import { SocialShare } from '@/components/SocialShare';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import Link from 'next/link';

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', title: '' });

  useEffect(() => {
    if (productId) {
      fetchProduct();
      fetchReviews();
      if (isAuthenticated) {
        checkWishlistStatus();
      }
    }
  }, [productId, isAuthenticated]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProduct(productId);
      // #region agent log
      console.log('[DEBUG] fetchProduct response:', {hasData:!!response?.data,dataType:typeof response?.data,imagesType:typeof response?.data?.images,imagesIsArray:Array.isArray(response?.data?.images),imagesLength:response?.data?.images?.length});
      // #endregion
      if (response?.data) {
        setProduct(response.data);
      }
    } catch (err: any) {
      // #region agent log
      console.log('[DEBUG] fetchProduct error:', {error:err?.message});
      // #endregion
      console.error('Error fetching product:', err);
      toast.error(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const response = await apiClient.getProductReviews(productId);
      // #region agent log
      console.log('[DEBUG] fetchReviews response:', {hasData:!!response?.data,dataType:typeof response?.data,isArray:Array.isArray(response?.data)});
      // #endregion
      // FIX: Ensure data is an array before setting
      if (response?.data && Array.isArray(response.data)) {
        setReviews(response.data);
      } else {
        setReviews([]);
      }
    } catch (err: any) {
      // #region agent log
      console.log('[DEBUG] fetchReviews error:', {error:err?.message});
      // #endregion
      console.error('Error fetching reviews:', err);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const checkWishlistStatus = async () => {
    try {
      const response = await apiClient.checkWishlistStatus(productId);
      // Backend returns { inWishlist: boolean }
      setIsInWishlist(response?.data?.inWishlist || false);
    } catch (err) {
      setIsInWishlist(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to add items to wishlist');
      return;
    }

    try {
      if (isInWishlist) {
        await apiClient.removeFromWishlist(productId);
        setIsInWishlist(false);
        toast.success('Removed from wishlist');
      } else {
        await apiClient.addToWishlist(productId);
        setIsInWishlist(true);
        toast.success('Added to wishlist');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update wishlist');
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

    try {
      setAddingToCart(true);
      await apiClient.addToCart(product.id, quantity);
      toast.success('Product added to cart!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error('Please login to submit a review');
      return;
    }

    try {
      await apiClient.createReview(productId, {
        rating: reviewForm.rating,
        comment: reviewForm.comment,
        title: reviewForm.title,
      });
      toast.success('Review submitted successfully!');
      setShowReviewForm(false);
      setReviewForm({ rating: 5, comment: '', title: '' });
      fetchReviews();
      fetchProduct(); // Refresh product to update rating
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="text-center py-12">
            <p className="text-gray-600">Product not found</p>
            <Link href="/products" className="text-purple-600 hover:text-purple-800 mt-4 inline-block">
              ← Back to Products
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="mb-6">
          <Link href="/products" className="text-purple-600 hover:text-purple-800 mb-4 inline-block">
            ← Back to Products
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Product Images */}
          <div>
            {product.images && product.images.length > 0 ? (
              <div className="relative w-full h-96 mb-4">
                <Image
                  src={typeof product.images[0] === 'string' ? product.images[0] : product.images[0]?.url || product.images[0]}
                  alt={product.name}
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            ) : (
              <div className="w-full h-96 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-400">No Image</span>
              </div>
            )}
            {/* #region agent log */}
            {(() => { console.log('[DEBUG] render:images', {hasProduct:!!product,imagesType:typeof product?.images,imagesIsArray:Array.isArray(product?.images),imagesLength:product?.images?.length}); return null; })()}
            {/* #endregion */}
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.slice(1, 5).map((image: any, index: number) => {
                  const imageUrl = typeof image === 'string' ? image : image?.url || image;
                  return (
                    <div key={index} className="relative w-full h-20">
                      <Image
                        src={imageUrl}
                        alt={`${product.name} ${index + 2}`}
                        fill
                        className="object-cover rounded-lg"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div>
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            
            {/* Rating Display */}
            <div className="mb-4 flex items-center gap-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={i < Math.round(product.averageRating || 0) ? 'text-yellow-400' : 'text-gray-300'}>
                    ★
                  </span>
                ))}
              </div>
              <span className="text-gray-600">({product.reviewCount || reviews.length} reviews)</span>
            </div>

            {product.description && (
              <p className="text-gray-600 mb-4">{product.description}</p>
            )}

            <div className="mb-6">
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {formatPrice(product.price, product.currency || 'GBP')}
              </div>
              {product.stock !== undefined && (
                <p className={`text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Out of Stock'}
                </p>
              )}
            </div>

            {/* Quantity Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  -
                </button>
                <span className="text-lg font-semibold">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || (product.stock !== undefined && product.stock === 0)}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingToCart ? 'Adding...' : 'Add to Cart'}
              </button>
              <button
                onClick={handleToggleWishlist}
                className={`px-6 py-3 border rounded-lg transition-colors font-medium ${
                  isInWishlist
                    ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
                title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                {isInWishlist ? '❤️' : '🤍'}
              </button>
            </div>

            {/* Social Share */}
            <div className="mb-6">
              <SocialShare
                type="PRODUCT"
                itemId={product.id}
                itemName={product.name}
                itemImage={typeof product.images?.[0] === 'string' ? product.images[0] : product.images?.[0]?.url}
              />
            </div>

            {/* AI Chat Toggle */}
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              {showAIChat ? 'Hide' : 'Ask AI About This Product'}
            </button>
          </div>
        </div>

        {/* AI Chat Interface - Note: Requires characterId, using product context for now */}
        {showAIChat && (
          <div className="mb-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">AI Product Assistant</h3>
              <p className="text-gray-600 mb-4">
                Ask questions about this product, get recommendations, or learn more about its features.
              </p>
              {/* Note: AIChatInterface requires characterId - would need to fetch user's character or use a default */}
              <p className="text-sm text-gray-500">
                AI chat feature requires character selection. Please select a character in your profile to use this feature.
              </p>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div className="mt-12 border-t pt-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Customer Reviews</h2>
            {isAuthenticated && (
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Write a Review
              </button>
            )}
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Write Your Review</h3>
              <form onSubmit={handleSubmitReview}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, rating })}
                        className={`text-2xl ${rating <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                  <input
                    type="text"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Review</label>
                  <textarea
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Submit Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Reviews List */}
          {/* #region agent log */}
          {(() => { console.log('[DEBUG] render:reviews', {reviewsType:typeof reviews,reviewsIsArray:Array.isArray(reviews),reviewsLength:reviews?.length,reviewsLoading}); return null; })()}
          {/* #endregion */}
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No reviews yet. Be the first to review this product!</p>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-lg">{review.title || 'Review'}</h4>
                      <p className="text-sm text-gray-600">by {review.user?.email || 'Anonymous'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-700">{review.comment}</p>
                  {review.createdAt && (
                    <p className="text-sm text-gray-500 mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Additional Product Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {product.category && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Category</h3>
              <p className="text-gray-600">{product.category}</p>
            </div>
          )}
          {product.fandom && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Fandom</h3>
              <p className="text-gray-600">{product.fandom}</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
