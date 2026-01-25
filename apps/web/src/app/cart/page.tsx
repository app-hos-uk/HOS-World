'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import Image from 'next/image';

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    stock?: number;
    images?: Array<{ url: string }>;
    estimatedDelivery?: string;
  };
}

interface Cart {
  id: string;
  items: CartItem[];
  discount?: number;
  shipping?: number;
  couponCode?: string;
}

export default function CartPage() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [removingCoupon, setRemovingCoupon] = useState(false);
  const [movingToWishlist, setMovingToWishlist] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCart();
      if (response?.data) {
        setCart(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching cart:', error);
      toast.error(error.message || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    if (!cart) {
      toast.error('No cart available');
      return;
    }

    try {
      setApplyingCoupon(true);
      const response = await apiClient.applyCoupon(cart.id, couponCode.trim());
      if (response?.data) {
        setCart(response.data);
        setCouponCode('');
        toast.success('Coupon applied successfully!');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = async () => {
    if (!cart) return;
    try {
      setRemovingCoupon(true);
      const response = await apiClient.removeCoupon(cart.id);
      if (response?.data) {
        setCart(response.data);
        toast.success('Coupon removed successfully');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove coupon');
    } finally {
      setRemovingCoupon(false);
    }
  };

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      toast.error('Quantity must be at least 1');
      return;
    }

    try {
      const response = await apiClient.updateCartItem(itemId, quantity);
      if (response?.data) {
        setCart(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      const response = await apiClient.removeCartItem(itemId);
      if (response?.data) {
        setCart(response.data);
        toast.success('Item removed from cart');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove item');
    }
  };

  const handleMoveToWishlist = async (item: CartItem) => {
    setMovingToWishlist(item.id);
    
    try {
      // Step 1: Add to wishlist first
      await apiClient.addToWishlist(item.productId);
      
      // Step 2: Remove from cart (only reached if wishlist add succeeded)
      try {
        await apiClient.removeCartItem(item.id);
        setCart(prev => prev ? {
          ...prev,
          items: prev.items.filter(i => i.id !== item.id)
        } : null);
        toast.success('Moved to wishlist');
      } catch (removeErr: any) {
        // Item was added to wishlist but couldn't be removed from cart
        // Inform user of partial success - item is in wishlist but still in cart
        toast.error('Added to wishlist, but failed to remove from cart. Please remove it manually.');
        console.error('Failed to remove cart item after adding to wishlist:', removeErr);
      }
    } catch (addErr: any) {
      // Failed to add to wishlist - no changes made to cart
      toast.error(addErr.message || 'Failed to add to wishlist');
    } finally {
      setMovingToWishlist(null);
    }
  };

  const handleCheckout = () => {
    // Use defensive check to match the pattern at line 126
    // Prevents crash if cart.items is undefined
    if (!cart || !cart.items || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    router.push('/checkout');
  };

  // Calculate cart stats
  const cartStats = useMemo(() => {
    if (!cart?.items) return { itemCount: 0, totalQuantity: 0, lowStockItems: 0 };
    return {
      itemCount: cart.items.length,
      totalQuantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      lowStockItems: cart.items.filter(item => 
        item.product?.stock !== undefined && item.product.stock > 0 && item.product.stock <= 5
      ).length,
    };
  }, [cart]);

  const getStockWarning = (item: CartItem) => {
    const stock = item.product?.stock;
    if (stock === undefined) return null;
    if (stock <= 0) return { text: 'Out of Stock', type: 'error' };
    if (stock < item.quantity) return { text: `Only ${stock} available`, type: 'warning' };
    if (stock <= 5) return { text: `Only ${stock} left in stock`, type: 'info' };
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <p className="text-sm sm:text-base">Loading cart...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 font-primary text-purple-900">Shopping Cart</h1>
          <div className="bg-gray-50 rounded-lg p-6 sm:p-8 text-center">
            <p className="text-base sm:text-lg text-gray-600 mb-4 sm:mb-6 font-secondary">Your cart is empty</p>
            <Link 
              href="/products" 
              className="inline-block px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 font-primary"
            >
              Browse Products
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const discount = cart.discount || 0;
  const shipping = cart.shipping || 0;
  const total = Math.max(0, subtotal - discount + shipping);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 font-primary text-purple-900">Shopping Cart</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              {cart.items.map((item: CartItem) => {
                const stockWarning = getStockWarning(item);
                const isMoving = movingToWishlist === item.id;
                
                return (
                  <div key={item.id} className="flex flex-col sm:flex-row gap-4 py-4 sm:py-6 border-b border-gray-200 last:border-b-0">
                    {/* Product Image */}
                    <div className="flex-shrink-0 relative">
                      {item.product?.images?.[0]?.url ? (
                        <Image
                          src={item.product.images[0].url}
                          alt={item.product.name || 'Product'}
                          width={100}
                          height={100}
                          className="rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No Image</span>
                        </div>
                      )}
                    </div>

                    {/* Product Details */}
                    <div className="flex-1">
                      <Link href={`/products/${item.productId}`} className="hover:text-purple-700">
                        <h3 className="font-semibold text-base sm:text-lg mb-1">{item.product?.name || 'Product'}</h3>
                      </Link>
                      <p className="text-sm text-gray-600 mb-2">{formatPrice(item.price)} each</p>
                      
                      {/* Stock Warning */}
                      {stockWarning && (
                        <p className={`text-xs mb-2 ${
                          stockWarning.type === 'error' ? 'text-red-600' :
                          stockWarning.type === 'warning' ? 'text-orange-600' :
                          'text-yellow-600'
                        }`}>
                          ⚠️ {stockWarning.text}
                        </p>
                      )}
                      
                      {/* Quantity Controls */}
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <div className="flex items-center">
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-l border border-gray-300 hover:bg-gray-100 flex items-center justify-center disabled:opacity-50"
                            disabled={item.quantity <= 1}
                          >
                            −
                          </button>
                          <span className="w-12 h-8 flex items-center justify-center border-t border-b border-gray-300 font-medium bg-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-r border border-gray-300 hover:bg-gray-100 flex items-center justify-center disabled:opacity-50"
                            disabled={
                              // Disable if: at/over stock limit, OR at maximum quantity (99)
                              (item.product?.stock != null && item.quantity >= item.product.stock) ||
                              item.quantity >= 99
                            }
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => handleMoveToWishlist(item)}
                            disabled={isMoving}
                            className="text-purple-600 hover:text-purple-700 text-sm flex items-center gap-1 disabled:opacity-50"
                          >
                            {isMoving ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600"></div>
                            ) : (
                              '💜'
                            )}
                            <span className="hidden sm:inline">Save for Later</span>
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Item Total */}
                    <div className="text-right">
                      <p className="font-semibold text-base sm:text-lg text-purple-600">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Coupon Code Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mt-6">
              <h2 className="text-lg font-semibold mb-4">Have a coupon code?</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={applyingCoupon || removingCoupon || !!cart.couponCode}
                />
                {cart.couponCode ? (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 font-medium">Applied: {cart.couponCode}</span>
                    <button
                      onClick={handleRemoveCoupon}
                      disabled={removingCoupon}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {removingCoupon ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleApplyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    className="px-6 py-2 bg-purple-700 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
                  >
                    {applyingCoupon ? 'Applying...' : 'Apply'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    Items ({cartStats.itemCount})
                  </span>
                  <span className="text-gray-600">
                    {cartStats.totalQuantity} unit{cartStats.totalQuantity !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount {cart.couponCode ? `(${cart.couponCode})` : ''}</span>
                    <span className="font-semibold">-{formatPrice(discount)}</span>
                  </div>
                )}
                
                {shipping > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-medium">{formatPrice(shipping)}</span>
                  </div>
                )}
              </div>

              {discount > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-green-800">
                    <span className="font-semibold">You saved {formatPrice(discount)}</span>
                    {cart.couponCode && ` with coupon ${cart.couponCode}`}!
                  </p>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-purple-600">{formatPrice(total)}</span>
                </div>
              </div>

              {cartStats.lowStockItems > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ {cartStats.lowStockItems} item{cartStats.lowStockItems !== 1 ? 's' : ''} in your cart {cartStats.lowStockItems !== 1 ? 'have' : 'has'} limited stock
                  </p>
                </div>
              )}

              <button
                onClick={handleCheckout}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300"
              >
                Proceed to Checkout
              </button>

              <Link
                href="/products"
                className="block text-center mt-4 text-purple-700 hover:text-purple-600"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
