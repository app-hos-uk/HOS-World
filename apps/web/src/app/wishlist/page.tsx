'use client';

import { useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { RouteGuard } from '@/components/RouteGuard';
import Image from 'next/image';
import Link from 'next/link';

interface WishlistItem {
  id: string;
  productId: string;
  addedAt?: string;
  product?: {
    id: string;
    name: string;
    price: number;
    currency?: string;
    stock?: number;
    status?: string;
    images?: Array<{ url: string } | string>;
    originalPrice?: number;
    discount?: number;
  };
}

/** API GET /wishlist returns `{ products: Product[] }`; map to rows the UI expects */
function normalizeWishlistProducts(products: unknown[]): WishlistItem[] {
  if (!Array.isArray(products)) return [];
  return products
    .filter(
      (p): p is { id: unknown } =>
        !!p && typeof p === 'object' && 'id' in p && (p as { id: unknown }).id != null,
    )
    .map((pRaw) => {
      const p = pRaw as Record<string, unknown>;
      const id = String(p.id);
      return {
        id,
        productId: id,
        product: {
          id,
          name: typeof p.name === 'string' ? p.name : 'Product',
          price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
          currency: typeof p.currency === 'string' ? p.currency : undefined,
          stock: p.stock != null ? Number(p.stock) : undefined,
          status: typeof p.status === 'string' ? p.status : undefined,
          images: Array.isArray(p.images) ? (p.images as Array<{ url: string } | string>) : undefined,
          originalPrice:
            p.rrp != null ? Number(p.rrp) : p.originalPrice != null ? Number(p.originalPrice) : undefined,
          discount:
            p.discountPercentage != null
              ? Number(p.discountPercentage)
              : p.discount != null
                ? Number(p.discount)
                : undefined,
        },
      };
    });
}

export default function WishlistPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [removingItem, setRemovingItem] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'price-low' | 'price-high'>('newest');

  useEffect(() => {
    fetchWishlist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getWishlist({ limit: 100 });
      if (response?.data) {
        const data = response.data as { products?: unknown[] } | unknown[];
        const raw = Array.isArray(data) ? data : data.products ?? [];
        setWishlistItems(normalizeWishlistProducts(raw));
      }
    } catch (err: any) {
      console.error('Error fetching wishlist:', err);
      toast.error(err.message || 'Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  // Sort items
  const sortedItems = useMemo(() => {
    const items = [...wishlistItems];
    switch (sortBy) {
      case 'price-low':
        return items.sort((a, b) => (a.product?.price || 0) - (b.product?.price || 0));
      case 'price-high':
        return items.sort((a, b) => (b.product?.price || 0) - (a.product?.price || 0));
      case 'newest':
      default:
        // API already returns newest first; preserve order unless user sorts by price
        return items;
    }
  }, [wishlistItems, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalValue = wishlistItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
    const inStock = wishlistItems.filter(item => (item.product?.stock || 0) > 0).length;
    const outOfStock = wishlistItems.filter(item => (item.product?.stock || 0) <= 0).length;
    const onSale = wishlistItems.filter(item => item.product?.discount && item.product.discount > 0).length;
    return { total: wishlistItems.length, totalValue, inStock, outOfStock, onSale };
  }, [wishlistItems]);

  const handleRemoveFromWishlist = async (productId: string) => {
    setRemovingItem(productId);
    try {
      await apiClient.removeFromWishlist(productId);
      setWishlistItems(items => items.filter(item => item.productId !== productId));
      toast.success('Removed from wishlist');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove from wishlist');
    } finally {
      setRemovingItem(null);
    }
  };

  const handleMoveToCart = async (productId: string) => {
    setAddingToCart(productId);
    try {
      await apiClient.addToCart(productId, 1);
      setWishlistItems(items => items.filter(item => item.productId !== productId));
      toast.success('Added to cart!');
    } catch (err: any) {
      const message = err.message || 'Failed to add to cart';
      if (message.toLowerCase().includes('variation') || message.toLowerCase().includes('option')) {
        toast.error('This product requires selecting options. Please visit the product page to add it to cart.');
      } else {
        toast.error(message);
      }
    } finally {
      setAddingToCart(null);
    }
  };

  const handleMoveAllToCart = async () => {
    const inStockItems = wishlistItems.filter(item => (item.product?.stock || 0) > 0);
    if (inStockItems.length === 0) {
      toast.error('No in-stock items to add');
      return;
    }

    let successCount = 0;
    const movedProductIds = new Set<string>();
    for (const item of inStockItems) {
      try {
        await apiClient.addToCart(item.productId, 1);
        movedProductIds.add(item.productId);
        successCount++;
      } catch (err) {
        console.error(`Failed to add ${item.product?.name} to cart:`, err);
      }
    }

    if (successCount > 0) {
      setWishlistItems((items) => items.filter((row) => !movedProductIds.has(row.productId)));
      toast.success(`Added ${successCount} item${successCount !== 1 ? 's' : ''} to cart!`);
    }
  };

  const handleShareWishlist = async () => {
    const productNames = wishlistItems
      .map(item => item.product?.name)
      .filter(Boolean)
      .join(', ');
    const shareText = `Check out my wishlist: ${productNames}`;
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Share link copied!');
    } catch (err) {
      console.error('Error sharing:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  const getStockStatus = (stock?: number) => {
    if (stock === undefined) return null;
    if (stock <= 0) return { text: 'Out of Stock', class: 'bg-red-500/15 text-red-300' };
    if (stock <= 5) return { text: `Only ${stock} left`, class: 'bg-orange-500/15 text-orange-300' };
    return { text: 'In Stock', class: 'bg-green-500/15 text-green-300' };
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          ) : (
          <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">My Wishlist</h1>
              <p className="text-hos-text-secondary mt-1">{stats.total} item{stats.total !== 1 ? 's' : ''} saved</p>
            </div>
            {wishlistItems.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleShareWishlist}
                  className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium text-sm"
                >
                  Share Wishlist
                </button>
                <button
                  onClick={handleMoveAllToCart}
                  className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium text-sm"
                >
                  Add All to Cart
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          {wishlistItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <h3 className="text-xs font-medium text-hos-text-muted uppercase">Total Value</h3>
                <p className="text-xl font-bold text-hos-gold mt-1">{formatPrice(stats.totalValue, 'USD')}</p>
              </div>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <h3 className="text-xs font-medium text-hos-text-muted uppercase">In Stock</h3>
                <p className="text-xl font-bold text-green-400 mt-1">{stats.inStock}</p>
              </div>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <h3 className="text-xs font-medium text-hos-text-muted uppercase">Out of Stock</h3>
                <p className="text-xl font-bold text-red-400 mt-1">{stats.outOfStock}</p>
              </div>
              <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                <h3 className="text-xs font-medium text-hos-text-muted uppercase">On Sale</h3>
                <p className="text-xl font-bold text-orange-400 mt-1">{stats.onSale}</p>
              </div>
            </div>
          )}

          {/* Sorting */}
          {wishlistItems.length > 0 && (
            <div className="flex justify-end mb-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary text-sm focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
              >
                <option value="newest">Newest Added</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          )}

          {wishlistItems.length === 0 ? (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">💜</div>
              <h2 className="text-xl font-semibold text-hos-text-secondary mb-2">Your wishlist is empty</h2>
              <p className="text-hos-text-secondary mb-6">Save items you love by clicking the heart icon on any product</p>
              <Link 
                href="/products" 
                className="inline-block px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
              >
                Browse Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedItems.map((item) => {
                const stockStatus = getStockStatus(item.product?.stock);
                const isOutOfStock = (item.product?.stock || 0) <= 0;
                const isAdding = addingToCart === item.productId;
                const isRemoving = removingItem === item.productId;

                return (
                  <div 
                    key={item.id} 
                    className={`bg-hos-bg-secondary border rounded-lg overflow-hidden transition-all hover:shadow-lg flex flex-col h-full ${
                      isOutOfStock ? 'opacity-75' : ''
                    }`}
                  >
                    <Link href={`/products/${item.productId}`}>
                      <div className="relative w-full h-48 bg-hos-bg-tertiary">
                        {(() => {
                          const firstImage = item.product?.images?.[0];
                          const imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;
                          return imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={item.product?.name || 'Product'}
                              fill
                              className={`object-cover ${isOutOfStock ? 'grayscale' : ''}`}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-hos-text-muted">No Image</span>
                            </div>
                          );
                        })()}
                        {/* Stock Badge */}
                        {stockStatus && (
                          <span className={`absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded-full ${stockStatus.class}`}>
                            {stockStatus.text}
                          </span>
                        )}
                        {/* Sale Badge */}
                        {item.product?.discount && item.product.discount > 0 && (
                          <span className="absolute top-2 right-2 px-2 py-1 text-xs font-medium rounded-full bg-red-600 text-white">
                            -{item.product.discount}%
                          </span>
                        )}
                      </div>
                    </Link>
                    <div className="p-4 flex flex-col flex-1">
                      <Link href={`/products/${item.productId}`}>
                        <h3 className="font-semibold text-lg mb-2 hover:text-hos-gold transition-colors line-clamp-2 min-h-[3.5rem]">
                          {item.product?.name || 'Product'}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 mb-4 min-h-[1.5rem]">
                        <p className="text-hos-gold font-bold">
                          {formatPrice(item.product?.price ?? 0, item.product?.currency || 'USD')}
                        </p>
                        {item.product?.originalPrice && item.product.originalPrice > (item.product?.price || 0) && (
                          <p className="text-hos-text-muted line-through text-sm">
                            {formatPrice(item.product.originalPrice, item.product?.currency || 'USD')}
                          </p>
                        )}
                      </div>
                      <div className="mt-auto">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMoveToCart(item.productId)}
                            disabled={isOutOfStock || isAdding}
                            className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                              isOutOfStock
                                ? 'bg-hos-bg-tertiary text-hos-text-muted cursor-not-allowed'
                                : 'bg-hos-gold text-[#1a1406] hover:bg-hos-gold-hover'
                            }`}
                          >
                            {isAdding ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : isOutOfStock ? (
                              'Out of Stock'
                            ) : (
                              'Add to Cart'
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoveFromWishlist(item.productId)}
                            disabled={isRemoving}
                            className="px-3 py-2 border border-hos-border rounded-lg hover:bg-red-500/10 hover:border-red-500/40 transition-colors text-sm flex items-center justify-center"
                            title="Remove from wishlist"
                          >
                            {isRemoving ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-hos-text-muted mt-3 min-h-[1rem]">
                          {item.addedAt ? `Added ${new Date(item.addedAt).toLocaleDateString()}` : '\u00A0'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
