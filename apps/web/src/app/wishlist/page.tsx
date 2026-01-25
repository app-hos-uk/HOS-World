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
  }, []);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getWishlist();
      if (response?.data) {
        setWishlistItems(response.data);
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
        return items.sort((a, b) => 
          new Date(b.addedAt || 0).getTime() - new Date(a.addedAt || 0).getTime()
        );
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
      await apiClient.removeFromWishlist(productId);
      setWishlistItems(items => items.filter(item => item.productId !== productId));
      toast.success('Added to cart!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to cart');
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
    for (const item of inStockItems) {
      try {
        await apiClient.addToCart(item.productId, 1);
        await apiClient.removeFromWishlist(item.productId);
        successCount++;
      } catch (err) {
        console.error(`Failed to add ${item.product?.name} to cart:`, err);
      }
    }

    if (successCount > 0) {
      setWishlistItems(items => items.filter(item => (item.product?.stock || 0) <= 0));
      toast.success(`Added ${successCount} item${successCount !== 1 ? 's' : ''} to cart!`);
    }
  };

  const handleShareWishlist = async () => {
    const wishlistUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My Wishlist',
          text: 'Check out my wishlist!',
          url: wishlistUrl,
        });
      } else {
        await navigator.clipboard.writeText(wishlistUrl);
        toast.success('Wishlist link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const getStockStatus = (stock?: number) => {
    if (stock === undefined) return null;
    if (stock <= 0) return { text: 'Out of Stock', class: 'bg-red-100 text-red-800' };
    if (stock <= 5) return { text: `Only ${stock} left`, class: 'bg-orange-100 text-orange-800' };
    return { text: 'In Stock', class: 'bg-green-100 text-green-800' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
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

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Wishlist</h1>
              <p className="text-gray-600 mt-1">{stats.total} item{stats.total !== 1 ? 's' : ''} saved</p>
            </div>
            {wishlistItems.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleShareWishlist}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                >
                  Share Wishlist
                </button>
                <button
                  onClick={handleMoveAllToCart}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                >
                  Add All to Cart
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          {wishlistItems.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase">Total Value</h3>
                <p className="text-xl font-bold text-purple-600 mt-1">{formatPrice(stats.totalValue, 'GBP')}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase">In Stock</h3>
                <p className="text-xl font-bold text-green-600 mt-1">{stats.inStock}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase">Out of Stock</h3>
                <p className="text-xl font-bold text-red-600 mt-1">{stats.outOfStock}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-xs font-medium text-gray-500 uppercase">On Sale</h3>
                <p className="text-xl font-bold text-orange-600 mt-1">{stats.onSale}</p>
              </div>
            </div>
          )}

          {/* Sorting */}
          {wishlistItems.length > 0 && (
            <div className="flex justify-end mb-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="newest">Newest Added</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
              </select>
            </div>
          )}

          {wishlistItems.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">💜</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Your wishlist is empty</h2>
              <p className="text-gray-600 mb-6">Save items you love by clicking the heart icon on any product</p>
              <Link 
                href="/products" 
                className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
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
                    className={`bg-white border rounded-lg overflow-hidden transition-all hover:shadow-lg ${
                      isOutOfStock ? 'opacity-75' : ''
                    }`}
                  >
                    <Link href={`/products/${item.productId}`}>
                      <div className="relative w-full h-48 bg-gray-100">
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
                              <span className="text-gray-400">No Image</span>
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
                    <div className="p-4">
                      <Link href={`/products/${item.productId}`}>
                        <h3 className="font-semibold text-lg mb-2 hover:text-purple-600 transition-colors line-clamp-2">
                          {item.product?.name || 'Product'}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2 mb-4">
                        <p className="text-purple-600 font-bold">
                          {formatPrice(item.product?.price, item.product?.currency || 'GBP')}
                        </p>
                        {item.product?.originalPrice && item.product.originalPrice > (item.product?.price || 0) && (
                          <p className="text-gray-400 line-through text-sm">
                            {formatPrice(item.product.originalPrice, item.product.currency || 'GBP')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleMoveToCart(item.productId)}
                          disabled={isOutOfStock || isAdding}
                          className={`flex-1 px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center justify-center gap-2 ${
                            isOutOfStock
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'bg-purple-600 text-white hover:bg-purple-700'
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
                          className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors text-sm flex items-center justify-center"
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
                      {item.addedAt && (
                        <p className="text-xs text-gray-400 mt-3">
                          Added {new Date(item.addedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
