'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SocialShare } from '@/components/SocialShare';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { SafeImage } from '@/components/SafeImage';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import Link from 'next/link';
import { trackViewItem, trackAddToCart } from '@/lib/analytics';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

/** Backend returns `{ reviews, pagination }` under `data`, not a bare array */
function extractProductReviews(payload: unknown): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload === 'object' && payload !== null && Array.isArray((payload as { reviews?: unknown }).reviews)) {
    return (payload as { reviews: any[] }).reviews;
  }
  return [];
}

export default function ProductDetailClient() {
  const params = useParams();
  const router = useRouter();
  const productIdOrSlug = params.id as string;
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const { isAuthenticated } = useAuth();
  const { addToCart: addToCartContext } = useCart();
  const [product, setProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistAnimating, setWishlistAnimating] = useState(false);
  const wishlistAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True when the current animation is for an add (so burst shows only on add, not on remove). */
  const wishlistIsAddAnimationRef = useRef(false);
  const viewedProductIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', title: '' });
  /** Selected variation per dimension (e.g. { Size: 'M', Color: 'Red' }) for add-to-cart */
  const [selectedVariations, setSelectedVariations] = useState<Record<string, string>>({});
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [deliveryEstimate, setDeliveryEstimate] = useState<string | null>(null);
  /** Track if user has navigation history to go back to */
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      setCanGoBack(true);
    }
  }, []);

  const handleGoBack = () => {
    if (canGoBack) {
      router.back();
    } else {
      router.push('/products');
    }
  };

  // Resolve product by UUID or slug, then load reviews/wishlist using product.id
  useEffect(() => {
    if (!productIdOrSlug) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setProduct(null);
      try {
        const response = isUuid(productIdOrSlug)
          ? await apiClient.getProduct(productIdOrSlug)
          : await apiClient.getProductBySlug(productIdOrSlug);
        if (!cancelled && response?.data) {
          setProduct(response.data);
          setSelectedImageIndex(0);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Error fetching product:', err);
          toast.error(err.message || 'Failed to load product');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdOrSlug]);

  useEffect(() => {
    setIsInWishlist(false);
  }, [productIdOrSlug]);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    const fetchReviews = async () => {
      try {
        setReviewsLoading(true);
        const response = await apiClient.getProductReviews(product.id);
        if (!cancelled) {
          const list = extractProductReviews(response?.data);
          setReviews(list);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Error fetching reviews:', err);
          setReviews([]);
        }
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    };
    fetchReviews();
    return () => { cancelled = true; };
  }, [product?.id]);

  useEffect(() => {
    if (!product?.id || viewedProductIdRef.current === product.id) return;
    viewedProductIdRef.current = product.id;
    trackViewItem(product);

    try {
      const MAX_RECENT = 12;
      const stored = localStorage.getItem('recentlyViewed');
      const items: Array<{ id: string; name: string; image: string; price: number; rrp?: number; averageRating?: number; vendor?: string }> = stored ? JSON.parse(stored) : [];
      const filtered = items.filter((i) => i.id !== product.id);
      const firstImage = product.images?.[0];
      const imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url || product.image || '';
      filtered.unshift({
        id: product.id,
        name: product.name || product.title || '',
        image: imageUrl,
        price: product.price ?? 0,
        rrp: product.rrp ?? product.compareAtPrice,
        averageRating: product.averageRating,
        vendor: product.seller?.storeName || product.vendor || '',
      });
      localStorage.setItem('recentlyViewed', JSON.stringify(filtered.slice(0, MAX_RECENT)));
    } catch { /* localStorage quota or parse error — non-critical */ }
  }, [product]);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    const loadRelated = async () => {
      setRelatedLoading(true);
      try {
        const categoryId = product.categoryId || product.categoryData?.id;
        const filters: Record<string, string | number> = { limit: 8, status: 'ACTIVE' };
        if (categoryId) filters.categoryId = categoryId;
        const response = await apiClient.getProducts(filters);
        if (!cancelled && response?.data?.data) {
          const items = response.data.data.filter((p: any) => p.id !== product.id).slice(0, 8);
          setRelatedProducts(items);
        }
      } catch {
        if (!cancelled) setRelatedProducts([]);
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    };
    loadRelated();
    return () => { cancelled = true; };
  }, [product?.id, product?.categoryId, product?.categoryData?.id]);

  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    const loadDeliveryEstimate = async () => {
      try {
        const response = await apiClient.getShippingOptions({
          cartItems: [{ productId: product.id, quantity: 1, price: product.price ?? 0 }],
          cartValue: product.price ?? 0,
          destination: { country: 'US', state: 'NY', city: 'New York', postalCode: '10001' },
        });
        if (!cancelled && response?.data?.length) {
          const days = response.data
            .map((opt: any) => opt.estimatedDays)
            .filter((d: number | null | undefined) => d != null && d > 0) as number[];
          if (days.length > 0) {
            const min = Math.min(...days);
            const max = Math.max(...days);
            setDeliveryEstimate(
              min === max
                ? `Estimated delivery: ${min} business day${min !== 1 ? 's' : ''}`
                : `Estimated delivery: ${min}–${max} business days`,
            );
          } else {
            setDeliveryEstimate('Estimated delivery: 3–7 business days');
          }
        } else if (!cancelled) {
          setDeliveryEstimate('Estimated delivery: 3–7 business days');
        }
      } catch {
        if (!cancelled) setDeliveryEstimate('Estimated delivery: 3–7 business days');
      }
    };
    loadDeliveryEstimate();
    return () => { cancelled = true; };
  }, [product?.id, product?.price]);

  useEffect(() => {
    if (!product?.id || !isAuthenticated) return;
    let cancelled = false;
    const check = async () => {
      try {
        const response = await apiClient.checkWishlistStatus(product.id);
        if (!cancelled) {
          const payload = response?.data;
          const inWishlist =
            typeof payload === 'object' && payload !== null && 'inWishlist' in payload
              ? Boolean((payload as { inWishlist?: boolean }).inWishlist)
              : false;
          setIsInWishlist(inWishlist);
        }
      } catch {
        if (!cancelled) setIsInWishlist(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [product?.id, isAuthenticated]);

  // Clear wishlist animation timeout on unmount to avoid setState on unmounted component
  useEffect(() => {
    return () => {
      if (wishlistAnimationTimeoutRef.current) {
        clearTimeout(wishlistAnimationTimeoutRef.current);
        wishlistAnimationTimeoutRef.current = null;
      }
    };
  }, []);

  const handleToggleWishlist = async () => {
    if (!isAuthenticated || !product?.id) {
      if (!isAuthenticated) toast.error('Please login to add items to wishlist');
      return;
    }

    if (wishlistAnimationTimeoutRef.current) {
      clearTimeout(wishlistAnimationTimeoutRef.current);
      wishlistAnimationTimeoutRef.current = null;
    }

    wishlistIsAddAnimationRef.current = !isInWishlist;
    setWishlistAnimating(true);
    wishlistAnimationTimeoutRef.current = setTimeout(() => {
      setWishlistAnimating(false);
      wishlistAnimationTimeoutRef.current = null;
    }, 600);

    try {
      if (isInWishlist) {
        await apiClient.removeFromWishlist(product.id);
        setIsInWishlist(false);
        toast.success('Removed from wishlist');
      } else {
        await apiClient.addToWishlist(product.id);
        setIsInWishlist(true);
        toast.success('Added to wishlist');
      }
    } catch (err: any) {
      if (wishlistAnimationTimeoutRef.current) {
        clearTimeout(wishlistAnimationTimeoutRef.current);
        wishlistAnimationTimeoutRef.current = null;
      }
      setWishlistAnimating(false);
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('not found in wishlist')) {
        setIsInWishlist(false);
      } else if (msg.toLowerCase().includes('already in wishlist')) {
        setIsInWishlist(true);
      }
      toast.error(msg || 'Failed to update wishlist');
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

    const hasVariations = product.variations && product.variations.length > 0;
    if (hasVariations) {
      const missing = (product.variations as any[]).find((v: any) => !selectedVariations[v.name]);
      if (missing) {
        toast.error(`Please select ${missing.name}`);
        return;
      }
    }

    try {
      setAddingToCart(true);
      await addToCartContext(
        product.id,
        quantity,
        hasVariations && Object.keys(selectedVariations).length > 0 ? selectedVariations : undefined
      );
      trackAddToCart(product, quantity);
      toast.success('Product added to cart!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated || !product?.id) {
      if (!isAuthenticated) toast.error('Please login to submit a review');
      return;
    }
    if (submittingReview) return;

    try {
      setSubmittingReview(true);
      await apiClient.createReview(product.id, {
        rating: reviewForm.rating,
        comment: reviewForm.comment,
        title: reviewForm.title,
      });
      toast.success('Review submitted successfully!');
      setShowReviewForm(false);
      setReviewForm({ rating: 5, comment: '', title: '' });
      // Refresh reviews
      const reviewsResponse = await apiClient.getProductReviews(product.id);
      setReviews(extractProductReviews(reviewsResponse?.data));
      // Refresh product to update rating
      const productResponse = isUuid(productIdOrSlug)
        ? await apiClient.getProduct(productIdOrSlug)
        : await apiClient.getProductBySlug(productIdOrSlug);
      if (productResponse?.data) {
        setProduct(productResponse.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="text-center py-12">
            <p className="text-hos-text-secondary">Product not found</p>
            <button
              onClick={handleGoBack}
              className="text-hos-gold hover:text-hos-gold-hover mt-4 inline-block"
            >
              ← Go Back
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="mb-6">
          <button
            onClick={handleGoBack}
            className="text-hos-gold hover:text-hos-gold-hover mb-4 inline-flex items-center gap-1 hover:gap-2 transition-all"
          >
            <span>←</span>
            <span>Go Back</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ProductImageGallery images={product.images} productName={product.name} />

          {/* Product Details */}
          <div>
            <h1 className="text-3xl font-bold mb-4 text-hos-text-primary">{product.name}</h1>
            
            {/* Rating Display */}
            <div className="mb-4 flex items-center gap-2">
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className={i < Math.round(product.averageRating || 0) ? 'text-yellow-400' : 'text-hos-text-muted'}>
                    ★
                  </span>
                ))}
              </div>
              <span className="text-hos-text-secondary">({product.reviewCount || reviews.length} reviews)</span>
            </div>

            {product.shortDescription && (
              <p className="text-hos-text-secondary mb-4">{product.shortDescription}</p>
            )}

            <div className="mb-6">
              <div className="text-3xl font-bold text-hos-gold mb-2">
                {formatPrice(product.price, product.currency || 'USD')}
              </div>
              {product.stock !== undefined && (
                <p className={`text-sm ${product.stock > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Out of Stock'}
                </p>
              )}
              {deliveryEstimate && (
                <p className="text-sm text-hos-text-secondary mt-2 flex items-center gap-1">
                  <span>🚚</span> {deliveryEstimate}
                </p>
              )}
            </div>

            {/* Variation selectors (e.g. Size, Color) */}
            {product.variations && product.variations.length > 0 && (
              <div className="mb-6 space-y-4">
                {product.variations.map((variation: any, varIdx: number) => (
                  <div key={varIdx}>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-2">{variation.name} *</label>
                    <div className="flex flex-wrap gap-2">
                      {(variation.options || []).map((opt: any, optIdx: number) => {
                        const value = typeof opt === 'object' && opt?.value != null ? opt.value : String(opt);
                        const optionPrice = typeof opt === 'object' && opt?.price != null ? opt.price : null;
                        const isSelected = selectedVariations[variation.name] === value;
                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => setSelectedVariations((prev) => ({ ...prev, [variation.name]: value }))}
                            className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'border-hos-gold bg-hos-gold/10 text-hos-gold ring-2 ring-hos-gold/50'
                                : 'border-hos-border hover:bg-hos-bg-tertiary'
                            }`}
                          >
                            {value}
                            {optionPrice != null && <span className="ml-1 text-hos-gold">({formatPrice(optionPrice, product.currency || 'USD')})</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-hos-text-secondary mb-2">Quantity</label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary"
                >
                  -
                </button>
                <span className="text-lg font-semibold">{quantity}</span>
                <button
                  onClick={() => {
                    const max = product.stock ?? 99;
                    setQuantity(Math.min(max, quantity + 1));
                  }}
                  disabled={quantity >= (product.stock ?? 99)}
                  className="px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={handleAddToCart}
                disabled={
                  addingToCart ||
                  (product.stock !== undefined && product.stock === 0) ||
                  (product.variations?.length
                    ? !(product.variations as any[]).every((v: any) => selectedVariations[v.name])
                    : false)
                }
                className="flex-1 px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingToCart ? 'Adding...' : 'Add to Cart'}
              </button>
              <button
                onClick={handleToggleWishlist}
                className={`group relative px-6 py-3 border rounded-lg font-medium transition-all duration-300 ${
                  isInWishlist
                    ? 'border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/15'
                    : 'border-hos-border hover:bg-hos-bg-tertiary'
                } ${wishlistAnimating ? 'scale-110' : 'scale-100'}`}
                title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <span
                  className={`inline-block text-xl transition-transform duration-300 ${
                    wishlistAnimating
                      ? 'animate-[heartBounce_0.6s_ease-in-out]'
                      : ''
                  }`}
                  style={{
                    display: 'inline-block',
                  }}
                >
                  {isInWishlist ? '❤️' : '🤍'}
                </span>
                {/* Burst particles only when this animation was for an add */}
                {wishlistAnimating && wishlistIsAddAnimationRef.current && (
                  <>
                    <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-red-300 opacity-40" />
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Send as Gift */}
            <button
              onClick={() => {
                handleAddToCart();
                sessionStorage.setItem('checkout_gift_mode', 'true');
                router.push('/checkout');
              }}
              disabled={
                addingToCart ||
                (product.stock !== undefined && product.stock === 0) ||
                (product.variations?.length
                  ? !(product.variations as any[]).every((v: any) => selectedVariations[v.name])
                  : false)
              }
              className="w-full mb-4 px-6 py-3 border-2 border-hos-gold/50 text-hos-gold rounded-lg hover:bg-hos-gold/10 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>🎁</span> Send as Gift
            </button>

            {/* Social Share */}
            <div className="mb-6">
              <SocialShare
                type="PRODUCT"
                itemId={product.id}
                itemName={product.name}
                itemImage={typeof product.images?.[0] === 'string' ? product.images[0] : product.images?.[0]?.url}
              />
            </div>

          </div>
        </div>

        {/* Specifications */}
        {product.attributes && product.attributes.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">Specifications</h2>
            <div className="bg-hos-bg-secondary rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {product.attributes.map((attr: any) => {
                    const label = attr.attribute?.name || 'Specification';
                    const value =
                      typeof attr.value === 'object' && attr.value?.value != null
                        ? attr.value.value
                        : attr.value != null
                          ? String(attr.value)
                          : '—';
                    return (
                      <tr key={attr.id || attr.attributeId} className="border-b border-hos-border last:border-0">
                        <td className="px-4 py-3 font-medium text-hos-text-primary w-1/3">{label}</td>
                        <td className="px-4 py-3 text-hos-text-secondary">{value}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Full Product Description */}
        {product.description && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">Product Details</h2>
            <div className="prose prose-invert max-w-none text-hos-text-secondary whitespace-pre-wrap">
              {product.description}
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
                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors"
              >
                Write a Review
              </button>
            )}
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="bg-hos-bg-secondary rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Write Your Review</h3>
              <form onSubmit={handleSubmitReview}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, rating })}
                        className={`text-2xl ${rating <= reviewForm.rating ? 'text-yellow-400' : 'text-hos-text-muted'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">Title</label>
                  <input
                    type="text"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg focus:outline-none focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-hos-text-secondary mb-2">Review</label>
                  <textarea
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg focus:outline-none focus:ring-2 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReviewForm(false)}
                    className="px-6 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Reviews List */}
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold"></div>
            </div>
          ) : reviews.length === 0 ? (
            <p className="text-hos-text-secondary text-center py-8">No reviews yet. Be the first to review this product!</p>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-hos-border pb-6">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-lg">{review.title || 'Review'}</h4>
                      <p className="text-sm text-hos-text-secondary">by {review.user?.email || 'Anonymous'}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-hos-text-muted'}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-hos-text-secondary">{review.comment}</p>
                  {review.createdAt && (
                    <p className="text-sm text-hos-text-muted mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Products */}
        {(relatedLoading || relatedProducts.length > 0) && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">You May Also Like</h2>
            {relatedLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {relatedProducts.map((related) => {
                  const img = related.images?.[0];
                  const imgUrl = typeof img === 'string' ? img : img?.url || '';
                  const href = related.slug ? `/products/${related.slug}` : `/products/${related.id}`;
                  return (
                    <Link
                      key={related.id}
                      href={href}
                      className="bg-hos-bg-secondary rounded-lg overflow-hidden hover:ring-2 hover:ring-hos-gold/40 transition-all"
                    >
                      <div className="relative aspect-square bg-hos-bg-tertiary">
                        {imgUrl ? (
                          <SafeImage src={imgUrl} alt={related.name} fill sizes="200px" className="object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-hos-text-muted text-sm">No image</div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium text-hos-text-primary line-clamp-2">{related.name}</p>
                        <p className="text-hos-gold font-semibold mt-1">
                          {formatPrice(related.price, related.currency || 'USD')}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Additional Product Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {product.category && (
            <div className="bg-hos-bg-secondary rounded-lg p-4">
              <h3 className="font-semibold mb-2">Category</h3>
              <p className="text-hos-text-secondary">{product.category}</p>
            </div>
          )}
          {product.fandom && (
            <div className="bg-hos-bg-secondary rounded-lg p-4">
              <h3 className="font-semibold mb-2">Fandom</h3>
              <p className="text-hos-text-secondary">{product.fandom}</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
