'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import Image from 'next/image';

export default function CartPage() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [removingCoupon, setRemovingCoupon] = useState(false);

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

  const handleCheckout = () => {
    // Use defensive check to match the pattern at line 126
    // Prevents crash if cart.items is undefined
    if (!cart || !cart.items || cart.items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    router.push('/checkout');
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
              {cart.items.map((item: any) => (
                <div key={item.id} className="flex flex-col sm:flex-row gap-4 py-4 sm:py-6 border-b border-gray-200 last:border-b-0">
                  {/* Product Image */}
                  <div className="flex-shrink-0">
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
                      <h3 className="font-semibold text-base sm:text-lg mb-2">{item.product?.name || 'Product'}</h3>
                    </Link>
                    <p className="text-sm text-gray-600 mb-2">{formatPrice(item.price)} each</p>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 mt-4">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                        disabled={item.quantity <= 1}
                      >
                        −
                      </button>
                      <span className="w-12 text-center font-medium">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
                      >
                        +
                      </button>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="ml-auto text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Item Total */}
                  <div className="text-right">
                    <p className="font-semibold text-base sm:text-lg">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
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
