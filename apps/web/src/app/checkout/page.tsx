'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteGuard } from '@/components/RouteGuard';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import type { ApiResponse } from '@hos-marketplace/shared-types';

interface StockIssue {
  productId: string;
  productName: string;
  requested: number;
  available: number;
  type: 'out_of_stock' | 'insufficient' | 'low_stock';
}

export default function CheckoutPage() {
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const { refreshCart } = useCart();
  const toast = useToast();
  const [cart, setCart] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [shippingAddressId, setShippingAddressId] = useState<string>('');
  const [billingAddressId, setBillingAddressId] = useState<string>('');
  const [shippingOptions, setShippingOptions] = useState<any[]>([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState<string>('');
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);

  useEffect(() => {
    loadCheckoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (shippingAddressId && cart?.items?.length > 0) {
      calculateShipping();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingAddressId, cart]);

  useEffect(() => {
    if (cart && shippingCost > 0) {
      calculateTax();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, shippingCost]);

  const loadCheckoutData = async () => {
    try {
      setLoading(true);
      const [cartResponse, addressesResponse] = await Promise.all([
        apiClient.getCart().catch((err) => {
          console.error('Error fetching cart:', err);
          toast.error('Failed to load cart. Please try again.');
          throw err;
        }),
        apiClient.get<ApiResponse<any[]>>('/addresses').catch(() => ({ data: [] } as ApiResponse<any[]>)),
      ]);

      if (cartResponse?.data) {
        setCart(cartResponse.data);
        
        // Check stock availability for all cart items
        const issues: StockIssue[] = [];
        for (const item of cartResponse.data.items || []) {
          const stock = item.product?.stock;
          if (stock !== undefined) {
            if (stock <= 0) {
              issues.push({
                productId: item.productId,
                productName: item.product?.name || 'Unknown Product',
                requested: item.quantity,
                available: 0,
                type: 'out_of_stock',
              });
            } else if (stock < item.quantity) {
              issues.push({
                productId: item.productId,
                productName: item.product?.name || 'Unknown Product',
                requested: item.quantity,
                available: stock,
                type: 'insufficient',
              });
            } else if (stock <= 5) {
              issues.push({
                productId: item.productId,
                productName: item.product?.name || 'Unknown Product',
                requested: item.quantity,
                available: stock,
                type: 'low_stock',
              });
            }
          }
        }
        setStockIssues(issues);
        
        // Show warning if critical stock issues
        const criticalIssues = issues.filter(i => i.type !== 'low_stock');
        if (criticalIssues.length > 0) {
          toast.error(`${criticalIssues.length} item(s) have stock issues. Please update your cart.`);
        }
      }

      if (addressesResponse?.data) {
        setAddresses(addressesResponse.data);
        if (addressesResponse.data.length > 0 && !shippingAddressId) {
          const defaultAddress = addressesResponse.data.find((a: any) => a.isDefault) || addressesResponse.data[0];
          setShippingAddressId(defaultAddress.id);
          setBillingAddressId(defaultAddress.id);
        }
      }

      // Validate cart has items
      if (!cartResponse?.data || !cartResponse.data.items || cartResponse.data.items.length === 0) {
        toast.error('Your cart is empty');
        router.push('/cart');
        return;
      }
    } catch (error: any) {
      console.error('Error loading checkout data:', error);
      let errorMessage = error.message || 'Failed to load checkout data';
      if (
        errorMessage.includes('Internal server error') ||
        errorMessage.includes('500') ||
        errorMessage.includes('temporarily unavailable')
      ) {
        errorMessage =
          'Checkout is temporarily unavailable. Please try again in a moment or contact support.';
      }
      toast.error(errorMessage);
      // Only redirect if it's not a cart error (cart error already handled)
      if (!errorMessage.includes('cart')) {
        router.push('/cart');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateShipping = async () => {
    if (!shippingAddressId || !cart?.items?.length) return;

    try {
      const address = addresses.find((a: any) => a.id === shippingAddressId);
      if (!address) {
        console.warn('Shipping address not found');
        return;
      }

      const response = await apiClient.getShippingOptions({
        cartItems: cart.items.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        cartValue: cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
        destination: {
          country: address.country,
          state: address.state,
          city: address.city,
          postalCode: address.postalCode,
        },
      });

      if (response?.data) {
        setShippingOptions(response.data);
        if (response.data.length > 0 && !selectedShippingMethod) {
          setSelectedShippingMethod(response.data[0].id);
          setShippingCost(response.data[0].rate || 0);
        } else if (response.data.length === 0) {
          // No shipping options available - set cost to 0
          setShippingCost(0);
        }
      }
    } catch (error: any) {
      console.error('Error calculating shipping:', error);
      // Set shipping cost to 0 if calculation fails (shipping might not be configured)
      setShippingCost(0);
      setShippingOptions([]);
      // Don't show error toast - shipping might not be configured
    }
  };

  const calculateTax = async () => {
    if (!cart?.items?.length || !shippingAddressId) return;

    try {
      const address = addresses.find((a: any) => a.id === shippingAddressId);
      if (!address) return;

      const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
      const discount = cart.discount || 0;
      const totalBeforeTax = subtotal - discount + shippingCost;

      const taxPromises = cart.items
        .filter((item: any) => item.product?.taxClassId)
        .map((item: any) =>
          apiClient.calculateTax({
            amount: item.price * item.quantity,
            taxClassId: item.product.taxClassId,
            location: {
              country: address.country,
              state: address.state,
              city: address.city,
              postalCode: address.postalCode,
            },
          })
        );

      const taxResults = await Promise.allSettled(taxPromises);
      const totalTax = taxResults.reduce(
        (sum, result) => sum + (result.status === 'fulfilled' ? (result.value?.data?.tax || 0) : 0),
        0
      );

      setTaxAmount(totalTax);
    } catch (error: any) {
      console.error('Error calculating tax:', error);
    }
  };

  // Check for critical stock issues that prevent checkout
  const hasCriticalStockIssues = useMemo(() => {
    return stockIssues.some(issue => issue.type === 'out_of_stock' || issue.type === 'insufficient');
  }, [stockIssues]);

  const getStockIssueForItem = (productId: string): StockIssue | undefined => {
    return stockIssues.find(issue => issue.productId === productId);
  };

  const handleCreateOrder = async () => {
    if (!shippingAddressId) {
      toast.error('Please select a shipping address');
      return;
    }

    if (!selectedShippingMethod && shippingOptions.length > 0) {
      toast.error('Please select a shipping method');
      return;
    }

    if (!cart || !cart.items || cart.items.length === 0) {
      toast.error('Your cart is empty');
      router.push('/cart');
      return;
    }

    // Prevent order creation if stock issues exist
    if (hasCriticalStockIssues) {
      toast.error('Please resolve stock issues before placing order');
      return;
    }

    try {
      setCreatingOrder(true);
      // Note: paymentMethod is optional at order creation stage; payment is handled on payment page
      const orderResponse = await apiClient.createOrder({
        shippingAddressId,
        billingAddressId: billingAddressId || shippingAddressId,
      });

      if (orderResponse?.data) {
        // Refresh cart context to clear the header cart badge (cart is cleared on backend)
        await refreshCart();
        toast.success('Order created successfully!');
        router.push(`/payment?orderId=${orderResponse.data.id}`);
      } else {
        throw new Error('Order creation failed - no data returned');
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      const errorMessage = error.message || 'Failed to create order';
      toast.error(errorMessage);
      // Check if it's a stock-related error and update issues
      if (errorMessage.toLowerCase().includes('stock') || errorMessage.toLowerCase().includes('insufficient')) {
        // Reload cart to get fresh stock data
        loadCheckoutData();
      }
    } finally {
      setCreatingOrder(false);
    }
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN', 'INFLUENCER']}>
        <div className="min-h-screen bg-white">
          <Header />
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            <p className="text-sm sm:text-base">Loading checkout...</p>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN', 'INFLUENCER']}>
        <div className="min-h-screen bg-white">
          <Header />
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Checkout</h1>
            <div className="bg-gray-50 rounded-lg p-6 sm:p-8 text-center">
              <p className="text-base sm:text-lg text-gray-600 mb-4 sm:mb-6">Your cart is empty</p>
              <Link
                href="/products"
                className="inline-block px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300"
              >
                Browse Products
              </Link>
            </div>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
  const discount = cart.discount || 0;
  const total = subtotal - discount + shippingCost + taxAmount;

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN', 'INFLUENCER']}>
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 font-primary text-purple-900">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <section aria-label="Shipping Address" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
              {addresses.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-4">No addresses found. Please add a shipping address to continue.</p>
                  <Link
                    href="/profile?tab=addresses&action=add&returnUrl=/checkout"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Address
                  </Link>
                  <p className="text-xs text-gray-500 mt-2">You will be redirected to your profile to add an address, then return here to complete checkout.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address: any) => (
                    <label
                      key={address.id}
                      className={`flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        shippingAddressId === address.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="shippingAddress"
                        value={address.id}
                        checked={shippingAddressId === address.id}
                        onChange={(e) => {
                          setShippingAddressId(e.target.value);
                          if (!billingAddressId) {
                            setBillingAddressId(e.target.value);
                          }
                        }}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{address.fullName}</p>
                        <p className="text-sm text-gray-600">{address.street}</p>
                        <p className="text-sm text-gray-600">
                          {address.city}, {address.state} {address.postalCode}
                        </p>
                        <p className="text-sm text-gray-600">{address.country}</p>
                      </div>
                    </label>
                  ))}
                  <Link
                    href="/profile?tab=addresses&action=add&returnUrl=/checkout"
                    className="block text-center text-purple-700 hover:text-purple-600 text-sm"
                  >
                    + Add New Address
                  </Link>
                </div>
              )}
            </section>

            {/* Shipping Method */}
            {shippingAddressId && shippingOptions.length > 0 && (
              <section aria-label="Shipping Method" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                <h2 className="text-lg font-semibold mb-4">Shipping Method</h2>
                <div className="space-y-3">
                  {shippingOptions.map((option: any) => (
                    <label
                      key={option.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedShippingMethod === option.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="shippingMethod"
                          value={option.id}
                          checked={selectedShippingMethod === option.id}
                          onChange={(e) => {
                            setSelectedShippingMethod(e.target.value);
                            setShippingCost(option.rate || 0);
                          }}
                          className="mr-3"
                        />
                        <div>
                          <p className="font-medium">{option.name}</p>
                          {option.description && (
                            <p className="text-sm text-gray-600">{option.description}</p>
                          )}
                        </div>
                      </div>
                      <p className="font-semibold">{formatPrice(option.rate || 0)}</p>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {/* Order Items */}
            <section aria-label="Order Items" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Order Items</h2>
              
              {/* Stock Issues Warning Banner */}
              {hasCriticalStockIssues && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="text-red-500 text-xl" aria-hidden="true">⚠️</span>
                    <div>
                      <p className="font-medium text-red-800">Stock Issues Detected</p>
                      <p className="text-sm text-red-600 mt-1">
                        Some items in your cart have stock availability issues. 
                        Please <Link href="/cart" className="underline font-medium">return to your cart</Link> to update quantities.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                {cart.items.map((item: any) => {
                  const stockIssue = getStockIssueForItem(item.productId);
                  return (
                    <div 
                      key={item.id} 
                      className={`flex justify-between items-start py-3 border-b last:border-b-0 ${
                        stockIssue && stockIssue.type !== 'low_stock' ? 'bg-red-50 -mx-2 px-2 rounded' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.product?.name || 'Product'}</p>
                        <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        
                        {/* Stock Warning */}
                        {stockIssue && (
                          <p className={`text-xs mt-1 ${
                            stockIssue.type === 'out_of_stock' ? 'text-red-600 font-medium' :
                            stockIssue.type === 'insufficient' ? 'text-orange-600 font-medium' :
                            'text-yellow-600'
                          }`}>
                            {stockIssue.type === 'out_of_stock' && '❌ Out of Stock'}
                            {stockIssue.type === 'insufficient' && `⚠️ Only ${stockIssue.available} available (you requested ${stockIssue.requested})`}
                            {stockIssue.type === 'low_stock' && `⚡ Low stock (${stockIssue.available} remaining)`}
                          </p>
                        )}
                      </div>
                      <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Order Review & Summary */}
          <div className="lg:col-span-1">
            <section aria-label="Order Review" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Order Review</h2>

              {/* Selected Shipping Address Summary */}
              {shippingAddressId && (() => {
                const selectedAddress = addresses.find((a: any) => a.id === shippingAddressId);
                return selectedAddress ? (
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Ship to</p>
                    <p className="text-sm font-medium">{selectedAddress.fullName}</p>
                    <p className="text-xs text-gray-600">{selectedAddress.street}</p>
                    <p className="text-xs text-gray-600">
                      {selectedAddress.city}, {selectedAddress.state} {selectedAddress.postalCode}
                    </p>
                    <p className="text-xs text-gray-600">{selectedAddress.country}</p>
                  </div>
                ) : null;
              })()}

              {/* Cart Items Summary */}
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Items ({cart.items.length})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cart.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="truncate text-gray-800">{item.product?.name || 'Product'}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium whitespace-nowrap">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-gray-200 pt-3 space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span>{shippingCost > 0 ? formatPrice(shippingCost) : 'Free'}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span>{taxAmount > 0 ? formatPrice(taxAmount) : formatPrice(0)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="border-t-2 border-purple-200 pt-3 mb-4">
                <div className="flex justify-between font-bold text-lg text-purple-900">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              {/* Review Confirmation Separator */}
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Review &amp; Confirm
                  </span>
                </div>
              </div>

              {/* Readiness Checklist */}
              <div className="space-y-1.5 mb-4 text-xs">
                <div className="flex items-center gap-2">
                  {shippingAddressId ? (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>
                  )}
                  <span className={shippingAddressId ? 'text-gray-700' : 'text-gray-400'}>Shipping address selected</span>
                </div>
                <div className="flex items-center gap-2">
                  {!hasCriticalStockIssues ? (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  )}
                  <span className={!hasCriticalStockIssues ? 'text-gray-700' : 'text-red-500'}>All items in stock</span>
                </div>
                {shippingOptions.length > 0 && (
                  <div className="flex items-center gap-2">
                    {selectedShippingMethod ? (
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>
                    )}
                    <span className={selectedShippingMethod ? 'text-gray-700' : 'text-gray-400'}>Shipping method selected</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateOrder}
                disabled={creatingOrder || !shippingAddressId || (shippingOptions.length > 0 && !selectedShippingMethod) || hasCriticalStockIssues}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingOrder ? 'Creating Order...' : hasCriticalStockIssues ? 'Stock Issues - Update Cart' : 'Place Order'}
              </button>
              
              {hasCriticalStockIssues && (
                <p role="alert" className="text-center mt-2 text-sm text-red-600">
                  Please resolve stock issues to continue
                </p>
              )}

              <Link
                href="/cart"
                className="block text-center mt-4 text-purple-700 hover:text-purple-600"
              >
                Back to Cart
              </Link>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
    </RouteGuard>
  );
}
