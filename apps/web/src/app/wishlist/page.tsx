'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { RouteGuard } from '@/components/RouteGuard';
import Image from 'next/image';
import Link from 'next/link';

export default function WishlistPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleRemoveFromWishlist = async (productId: string) => {
    try {
      await apiClient.removeFromWishlist(productId);
      setWishlistItems(items => items.filter(item => item.productId !== productId));
      toast.success('Removed from wishlist');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove from wishlist');
    }
  };

  const handleMoveToCart = async (productId: string) => {
    try {
      await apiClient.addToCart(productId, 1);
      await apiClient.removeFromWishlist(productId);
      setWishlistItems(items => items.filter(item => item.productId !== productId));
      toast.success('Added to cart!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to cart');
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

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">My Wishlist</h1>

          {wishlistItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">Your wishlist is empty</p>
              <Link href="/products" className="text-purple-600 hover:text-purple-800 font-medium">
                Browse Products →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {wishlistItems.map((item) => (
                <div key={item.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  <Link href={`/products/${item.productId}`}>
                    <div className="relative w-full h-48 bg-gray-100">
                      {(() => {
                        const firstImage = item.product?.images?.[0];
                        const imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;
                        return imageUrl ? (
                          <Image
                            src={imageUrl}
                            alt={item.product.name || 'Product'}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-400">No Image</span>
                          </div>
                        );
                      })()}
                    </div>
                  </Link>
                  <div className="p-4">
                    <Link href={`/products/${item.productId}`}>
                      <h3 className="font-semibold text-lg mb-2 hover:text-purple-600 transition-colors">
                        {item.product?.name || 'Product'}
                      </h3>
                    </Link>
                    <p className="text-purple-600 font-bold mb-4">
                      {formatPrice(item.product?.price, item.product?.currency || 'GBP')}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMoveToCart(item.productId)}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                      >
                        Add to Cart
                      </button>
                      <button
                        onClick={() => handleRemoveFromWishlist(item.productId)}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        title="Remove from wishlist"
                      >
                        ❤️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
