'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { RouteGuard } from '@/components/RouteGuard';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCurrency } from '@/contexts/CurrencyContext';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

function PaymentContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const router = useRouter();

  const [klarnaReturn, setKlarnaReturn] = useState<{ status: string; klarnaOrderId?: string } | null>(null);

  useEffect(() => {
    const klarnaOrderId = searchParams.get('klarna_order_id');
    const paymentStatus = searchParams.get('payment_status');

    if (klarnaOrderId || paymentStatus) {
      const status = paymentStatus || 'pending';
      setKlarnaReturn({ status, klarnaOrderId: klarnaOrderId || undefined });

      if (status === 'completed' || status === 'success') {
        toast.success('Klarna payment completed successfully!');
        const redirectOrderId = orderId || searchParams.get('order_id');
        if (redirectOrderId) {
          const timer = setTimeout(() => router.push(`/orders/${redirectOrderId}`), 3000);
          return () => clearTimeout(timer);
        }
      } else if (status === 'cancelled' || status === 'failed') {
        toast.error(`Klarna payment ${status}. Please try again.`);
      } else {
        toast.info?.('Klarna payment is being processed. You will be notified once confirmed.') ??
          toast.success('Klarna payment is being processed.');
      }
      setLoading(false);
      return;
    }

    if (orderId) {
      fetchOrder();
    } else {
      setError('Order ID is required');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getOrder(orderId!);
      if (response?.data) {
        setOrder(response.data);
      } else {
        setError('Order not found');
      }
    } catch (err: any) {
      console.error('Error fetching order:', err);
      const errorMessage = err.message || 'Failed to load order details';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600">Loading order details...</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (klarnaReturn) {
    const isSuccess = klarnaReturn.status === 'completed' || klarnaReturn.status === 'success';
    const isFailed = klarnaReturn.status === 'cancelled' || klarnaReturn.status === 'failed';
    const isPending = !isSuccess && !isFailed;
    const redirectOrderId = orderId || searchParams.get('order_id');

    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-2xl mx-auto text-center">
            {isSuccess ? (
              <>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-green-700">Payment Successful</h1>
                <p className="text-gray-600 mb-2">Your Klarna payment has been processed successfully.</p>
                {klarnaReturn.klarnaOrderId && (
                  <p className="text-sm text-gray-500 mb-6">Klarna Reference: {klarnaReturn.klarnaOrderId}</p>
                )}
                <p className="text-sm text-gray-500 mb-6">Redirecting to your order details...</p>
                {redirectOrderId && (
                  <Link
                    href={`/orders/${redirectOrderId}`}
                    className="px-6 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-600 transition-colors inline-block"
                  >
                    View Order
                  </Link>
                )}
              </>
            ) : isPending ? (
              <>
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-yellow-700">Payment Processing</h1>
                <p className="text-gray-600 mb-2">Your Klarna payment is being processed. You will be notified once it is confirmed.</p>
                {klarnaReturn.klarnaOrderId && (
                  <p className="text-sm text-gray-500 mb-6">Klarna Reference: {klarnaReturn.klarnaOrderId}</p>
                )}
                <div className="flex gap-4 justify-center">
                  {redirectOrderId && (
                    <Link
                      href={`/orders/${redirectOrderId}`}
                      className="px-6 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-600 transition-colors inline-block"
                    >
                      View Order
                    </Link>
                  )}
                  <Link
                    href="/orders"
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    View My Orders
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-red-700">Payment {klarnaReturn.status === 'cancelled' ? 'Cancelled' : 'Failed'}</h1>
                <p className="text-gray-600 mb-6">
                  {klarnaReturn.status === 'cancelled'
                    ? 'You cancelled the Klarna payment. You can try again or choose a different payment method.'
                    : 'The Klarna payment could not be completed. Please try again or choose a different payment method.'}
                </p>
                <div className="flex gap-4 justify-center">
                  {redirectOrderId && (
                    <Link
                      href={`/payment?orderId=${redirectOrderId}`}
                      className="px-6 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                      Try Again
                    </Link>
                  )}
                  <Link
                    href="/orders"
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    View My Orders
                  </Link>
                </div>
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 text-red-600">Order Not Found</h1>
            <p className="text-gray-600 mb-6">{error || 'The order you are looking for does not exist or has been removed.'}</p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/orders"
                className="px-6 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                View My Orders
              </Link>
              <Link
                href="/products"
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 font-primary text-purple-900">Complete Payment</h1>
        
        {/* Seller Information - Revealed at Payment Page */}
        {order.seller && (
          <div className="bg-gray-50 border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Seller Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-sm text-gray-600">Store Name</p>
                <p className="font-medium">{order.seller.storeName}</p>
              </div>
              {order.seller.location && (
                <div>
                  <p className="text-sm text-gray-600">Location</p>
                  <p className="font-medium">{order.seller.location.city}, {order.seller.location.country}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-white border rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Order Summary</h2>
          <div className="space-y-2">
            {order.items?.map((item: any, index: number) => (
              <div key={index} className="flex justify-between">
                <span>{item.product?.name || 'Product'} x {item.quantity}</span>
                <span>{formatPrice(item.price * item.quantity, order.currency || 'GBP')}</span>
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4">
            <div className="flex justify-between mb-2">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotal || 0, order.currency || 'GBP')}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between mb-2 text-green-600">
                <span>Discount</span>
                <span>-{formatPrice(order.discount, order.currency || 'GBP')}</span>
              </div>
            )}
            {order.shipping > 0 && (
              <div className="flex justify-between mb-2">
                <span>Shipping</span>
                <span>{formatPrice(order.shipping, order.currency || 'GBP')}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between mb-2">
                <span>Tax</span>
                <span>{formatPrice(order.tax, order.currency || 'GBP')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>{formatPrice(order.total, order.currency || 'GBP')}</span>
            </div>
            {order.currency && order.currency !== 'GBP' && (
              <p className="text-xs text-gray-500 mt-2">
                Original amount: £{typeof order.total === 'number' ? order.total.toFixed(2) : '0.00'} GBP
              </p>
            )}
          </div>
        </div>

        {/* Payment Form */}
        <PaymentForm order={order} />
      </main>
      <Footer />
    </div>
  );
}

function PaymentForm({ order }: { order: any }) {
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null);
  const [validatingGiftCard, setValidatingGiftCard] = useState(false);
  const [giftCardApplied, setGiftCardApplied] = useState(false);
  const [giftCardRedeemedAmount, setGiftCardRedeemedAmount] = useState<number>(0);
  // Track redeemed gift card codes to prevent duplicate redemptions
  // Use array instead of Set for React immutability compatibility
  const [redeemedGiftCardCodes, setRedeemedGiftCardCodes] = useState<string[]>(() => []);
  const [processing, setProcessing] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState<string | null>(null);
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvc: '' });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    loadPaymentProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPaymentProviders = async () => {
    try {
      setLoadingProviders(true);
      const response = await apiClient.getPaymentProviders();
      if (response?.data && response.data.length > 0) {
        setAvailableProviders(response.data);
        // Default to first available provider
        setSelectedProvider(response.data[0]);
      } else {
        // Fallback to default providers if API doesn't return any
        setAvailableProviders(['stripe', 'klarna']);
        setSelectedProvider('stripe');
        toast.error('No payment providers available. Using default options.');
      }
    } catch (err: any) {
      console.error('Error loading payment providers:', err);
      // Fallback to default providers
      setAvailableProviders(['stripe', 'klarna']);
      setSelectedProvider('stripe');
      toast.error('Failed to load payment providers. Using default options.');
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleValidateGiftCard = async () => {
    if (!giftCardCode.trim()) {
      toast.error('Please enter a gift card code');
      return;
    }

    const normalizedCode = giftCardCode.trim().toUpperCase();

    // Check if this gift card code has already been redeemed for this order
    // Use array includes() instead of Set.has() for immutability compatibility
    if (redeemedGiftCardCodes.includes(normalizedCode)) {
      toast.error('This gift card has already been redeemed for this order. Please use a different gift card.');
      return;
    }

    try {
      setValidatingGiftCard(true);
      const response = await apiClient.validateGiftCard(normalizedCode);
      if (response?.data) {
        const balance = response.data.balance || 0;
        if (balance <= 0) {
          toast.error('This gift card has no balance');
          return;
        }
        setGiftCardBalance(balance);
        setGiftCardApplied(true);
        toast.success('Gift card validated and applied');
      } else {
        toast.error('Invalid gift card code');
      }
    } catch (err: any) {
      console.error('Gift card validation error:', err);
      const errorMessage = err.message || 'Failed to validate gift card';
      toast.error(errorMessage);
    } finally {
      setValidatingGiftCard(false);
    }
  };

  const handleRemoveGiftCard = () => {
    // Prevent removal during payment processing or gift card validation
    if (processing || validatingGiftCard) {
      toast.error('Cannot remove gift card while payment is being processed.');
      return;
    }

    // If a gift card has already been redeemed, warn the user that the redemption cannot be undone
    // The redeemed amount should remain because it represents a completed transaction on the backend
    if (giftCardRedeemedAmount > 0) {
      toast.error('Cannot remove gift card: A redemption has already been processed. The redeemed amount will remain applied to your order.');
      return;
    }
    
    // Only clear UI state if no redemption has occurred
    setGiftCardCode('');
    setGiftCardBalance(null);
    setGiftCardApplied(false);
    // Note: giftCardRedeemedAmount is not cleared here because if it's > 0, 
    // it represents a completed redemption that cannot be undone
  };

  const calculateTotal = () => {
    // IMPORTANT: This function must use the same calculation logic as handlePayment() to ensure
    // the displayed amount matches the actual payment amount. Both functions calculate:
    // 1. Start with order total
    // 2. Subtract already-redeemed gift card amounts
    // 3. If a gift card is applied, subtract the redemption amount (min of balance and remaining total)
    
    // Start with order total
    let total = order.total || 0;
    
    // Subtract any already-redeemed gift card amount (from previous redemptions)
    // This matches the initial value of totalRedeemedAmount in handlePayment()
    total = Math.max(0, total - giftCardRedeemedAmount);
    
    // If gift card is still applied (not yet redeemed in this session), calculate the redemption amount
    // This must match the logic in calculateGiftCardRedemptionAmount() which is used in handlePayment()
    if (giftCardApplied && giftCardBalance !== null && giftCardBalance !== undefined) {
      // Calculate remaining total after previous redemptions (same as calculateGiftCardRedemptionAmount)
      const remainingTotal = Math.max(0, (order.total || 0) - giftCardRedeemedAmount);
      // Calculate the redemption amount (same logic as calculateGiftCardRedemptionAmount)
      const redemptionAmount = Math.min(giftCardBalance, remainingTotal);
      // Subtract the redemption amount from the remaining total
      total = Math.max(0, total - redemptionAmount);
    }
    
    return total;
  };

  const calculateGiftCardRedemptionAmount = () => {
    if (!giftCardApplied || giftCardBalance === null || giftCardBalance === undefined) {
      return 0;
    }
    // Calculate remaining order total after previous redemptions
    const remainingTotal = Math.max(0, (order.total || 0) - giftCardRedeemedAmount);
    // Return the minimum of gift card balance and remaining total
    return Math.min(giftCardBalance, remainingTotal);
  };

  const handlePayment = async () => {
    setPaymentError(null);

    if (!order?.id) {
      toast.error('Order not found');
      return;
    }

    if (!selectedProvider || availableProviders.length === 0) {
      if (availableProviders.length === 0) {
        toast.error('No payment methods available. Please contact support or refresh the page.');
      } else {
        toast.error('Please select a payment method');
      }
      return;
    }

    try {
      setProcessing(true);
      const giftCardRedemptionAmount = calculateGiftCardRedemptionAmount();
      
      // Track redeemed amount in local variable to avoid React setState async issues
      let totalRedeemedAmount = giftCardRedeemedAmount;
      
      // If gift card is applied, redeem it first
      if (giftCardApplied && giftCardBalance !== null && giftCardBalance !== undefined && giftCardRedemptionAmount > 0) {
        try {
          const normalizedCode = giftCardCode.trim().toUpperCase();
          
          await apiClient.redeemGiftCard({
            code: normalizedCode,
            orderId: order.id,
            amount: giftCardRedemptionAmount,
          });
          
          // Mark this gift card code as redeemed to prevent duplicate redemptions
          // Use immutable array update to ensure React can track state changes
          setRedeemedGiftCardCodes(prev => {
            // Check if already in array to prevent duplicates
            if (prev.includes(normalizedCode)) {
              return prev; // Return same array if already exists (no change)
            }
            return [...prev, normalizedCode]; // Create new array with added code
          });
          
          // Calculate the new redeemed amount and balance immediately (before state updates)
          totalRedeemedAmount = giftCardRedeemedAmount + giftCardRedemptionAmount;
          const newBalance = giftCardBalance - giftCardRedemptionAmount;
          
          // Update state (async, but we'll use calculated values directly)
          setGiftCardRedeemedAmount(totalRedeemedAmount);
          
          if (newBalance <= 0) {
            // Gift card fully used, clear it
            setGiftCardBalance(null);
            setGiftCardApplied(false);
            setGiftCardCode('');
          } else {
            // Partial redemption, update balance and clear applied flag
            // This prevents re-redemption on payment retry since the redemption is already processed
            setGiftCardBalance(newBalance);
            setGiftCardApplied(false);
            setGiftCardCode(''); // Clear code input to match full redemption behavior and improve UX
          }
          
          // Calculate final amount using the new values directly (not from state, which is async)
          // This avoids the React setState async issue
          const finalAmountAfterRedemption = Math.max(0, (order.total || 0) - totalRedeemedAmount);
          
          // If gift card fully covers the order
          if (finalAmountAfterRedemption <= 0) {
            toast.success('Payment successful with gift card!');
            setProcessing(false); // Reset processing state before redirect
            router.push(`/orders/${order.id}`);
            return;
          }
          
          // If partial coverage, continue to payment for remaining amount
          toast.success(`Gift card applied: ${formatPrice(giftCardRedemptionAmount, order.currency || 'GBP')} deducted`);
        } catch (err: any) {
          console.error('Gift card redemption error:', err);
          const errorMessage = err.message || 'Gift card redemption failed';
          toast.error(errorMessage);
          // Reset gift card state to prevent reapplication on retry
          setGiftCardApplied(false);
          setGiftCardBalance(null);
          setGiftCardCode('');
          setProcessing(false);
          return;
        }
      }

      // Calculate final amount using local variable (not state) to avoid React setState async issues
      // This ensures we use the most up-to-date redeemed amount
      const finalAmount = Math.max(0, (order.total || 0) - totalRedeemedAmount);

      // Create payment intent for remaining amount (if any)
      if (finalAmount > 0) {
        try {
          const response = await apiClient.createPaymentIntent({
            orderId: order.id,
            paymentMethod: selectedProvider,
            amount: finalAmount,
            currency: order.currency || 'GBP',
          });

          if (!response?.data) {
            throw new Error('Failed to create payment intent');
          }

          // Handle different payment providers
          if (selectedProvider === 'klarna') {
            // Redirect to Klarna checkout
            if (response.data.checkoutUrl) {
              window.location.href = response.data.checkoutUrl;
              // Return immediately after redirect to prevent execution from continuing
              // This prevents error toasts from showing if redirect is delayed or fails
              return;
            } else if (response.data.clientSecret) {
              // Some Klarna implementations use client secret
              // In a real implementation, you'd initialize Klarna SDK here
              toast.error('Klarna checkout URL not available. Please contact support.');
              setProcessing(false);
              return; // Exit early to prevent fallthrough to generic payment handler
            } else {
              toast.error('Klarna checkout URL not available');
              setProcessing(false);
              return; // Exit early to prevent fallthrough to generic payment handler
            }
          } else if (selectedProvider === 'stripe') {
            if (response.data.clientSecret) {
              setStripeClientSecret(response.data.clientSecret);
              setStripePaymentIntentId(response.data.paymentIntentId);
              setCardDetails({ number: '', expiry: '', cvc: '' });
              setProcessing(false);
              return;
            } else {
              toast.error('Stripe client secret not available. Please contact support.');
              setProcessing(false);
              return;
            }
          } else {
            // Generic provider handling for other payment providers
            if (response.data.clientSecret) {
              // In a real implementation, you'd initialize the provider's SDK here
              toast.error(`${selectedProvider} payment integration not fully implemented. Please contact support.`);
              setProcessing(false); // Reset processing state when provider not fully implemented
              return;
            } else {
              toast.error('Payment setup failed. Please try again or contact support.');
              setProcessing(false); // Reset processing state on payment setup failure
              return;
            }
          }
        } catch (err: any) {
          console.error('Payment intent creation error:', err);
          const errorMessage = err.message || 'Failed to create payment intent';
          setPaymentError(errorMessage);
          toast.error(errorMessage);
          setProcessing(false);
          return;
        }
      } else {
        // This should only be reached if no gift card was applied but finalAmount is 0
        // (i.e., gift card fully covered the order, or order total is 0)
        toast.success('Payment successful!');
        router.push(`/orders/${order.id}`);
      }
    } catch (err: any) {
      console.error('Payment processing error:', err);
      const errorMessage = err.message || 'Payment processing failed';
      setPaymentError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const handleStripeConfirm = async () => {
    if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvc) {
      toast.error('Please fill in all card details');
      return;
    }

    if (cardDetails.number.replace(/\s/g, '').length < 16) {
      toast.error('Please enter a valid card number');
      return;
    }

    if (!/^\d{2}\s?\/\s?\d{2}$/.test(cardDetails.expiry.trim())) {
      toast.error('Please enter a valid expiry date (MM/YY)');
      return;
    }

    if (cardDetails.cvc.length < 3) {
      toast.error('Please enter a valid CVC');
      return;
    }

    try {
      setProcessing(true);
      const confirmResponse = await apiClient.confirmPayment({
        orderId: order.id,
        paymentIntentId: stripePaymentIntentId!,
      });
      if (confirmResponse?.data) {
        toast.success('Payment successful!');
        setStripeClientSecret(null);
        setStripePaymentIntentId(null);
        router.push(`/orders/${order.id}`);
        return;
      } else {
        throw new Error('Payment confirmation failed');
      }
    } catch (confirmErr: any) {
      console.error('Payment confirmation error:', confirmErr);
      const errorMessage = confirmErr.message || 'Payment confirmation failed. Please try again or contact support.';
      setPaymentError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return digits.slice(0, 2) + '/' + digits.slice(2);
    }
    return digits;
  };

  const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
      stripe: 'Credit/Debit Card (Stripe)',
      klarna: 'Klarna (Pay in Installments)',
      'gift-card': 'Gift Card',
    };
    return names[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const getProviderDescription = (provider: string) => {
    const descriptions: Record<string, string> = {
      stripe: 'Card payment will be processed securely through Stripe. You will be redirected to complete the payment.',
      klarna: 'Pay in installments with Klarna. You will be redirected to Klarna\'s secure checkout.',
      'gift-card': 'Use a gift card to pay for your order.',
    };
    return descriptions[provider] || `Pay securely with ${provider}.`;
  };

  if (loadingProviders) {
    return (
      <div className="bg-white border rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading payment options...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-lg p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Payment Details</h2>
      
      {/* Payment Provider Selection */}
      {availableProviders.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {availableProviders.map((provider) => (
              <label
                key={provider}
                className={`flex items-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedProvider === provider ? 'border-purple-500 bg-purple-50' : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="paymentProvider"
                  value={provider}
                  checked={selectedProvider === provider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="mr-2"
                />
                <span className="font-medium">{getProviderDisplayName(provider)}</span>
              </label>
            ))}
          </div>
          {selectedProvider && (
            <p className="mt-2 text-sm text-gray-600">{getProviderDescription(selectedProvider)}</p>
          )}
        </div>
      )}

      {/* Gift Card Input */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">Gift Card (Optional)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={giftCardCode}
            onChange={(e) => setGiftCardCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={giftCardApplied || validatingGiftCard}
          />
          {!giftCardApplied ? (
            <button
              type="button"
              onClick={handleValidateGiftCard}
              disabled={validatingGiftCard || !giftCardCode.trim()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validatingGiftCard ? 'Validating...' : 'Apply'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRemoveGiftCard}
              disabled={processing || validatingGiftCard}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove
            </button>
          )}
        </div>
        {giftCardApplied && giftCardBalance !== null && (
          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-800">
              Gift card applied: {formatPrice(giftCardBalance, order.currency || 'GBP')} available
            </p>
          </div>
        )}
      </div>

      {/* Order Total with Gift Card Discount */}
      {(giftCardApplied || giftCardRedeemedAmount > 0) && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex justify-between text-sm mb-2">
            <span>Original Order Total:</span>
            <span>{formatPrice(order.total, order.currency || 'GBP')}</span>
          </div>
          {giftCardRedeemedAmount > 0 && (
            <div className="flex justify-between text-sm mb-2 text-green-700">
              <span>Previously Redeemed Gift Cards:</span>
              <span>-{formatPrice(giftCardRedeemedAmount, order.currency || 'GBP')}</span>
            </div>
          )}
          {giftCardApplied && giftCardBalance !== null && giftCardBalance !== undefined && giftCardBalance > 0 && (
            <div className="flex justify-between text-sm mb-2 text-green-700">
              <span>Gift Card Applied (Not Yet Redeemed):</span>
              <span>-{formatPrice(Math.min(giftCardBalance, Math.max(0, (order.total || 0) - giftCardRedeemedAmount)), order.currency || 'GBP')}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg pt-2 border-t border-blue-300">
            <span>Amount to Pay:</span>
            <span>{formatPrice(calculateTotal(), order.currency || 'GBP')}</span>
          </div>
        </div>
      )}

      {availableProviders.length === 0 && !loadingProviders && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 text-center font-medium">
            No payment methods available. Please contact support or refresh the page.
          </p>
        </div>
      )}

      {/* Stripe Card Details Form */}
      {stripeClientSecret && selectedProvider === 'stripe' && (
        <div className="mb-4 p-4 border border-purple-200 bg-purple-50 rounded-lg">
          <h3 className="text-sm font-semibold text-purple-900 mb-3">Enter Card Details</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Card Number</label>
              <input
                type="text"
                value={cardDetails.number}
                onChange={(e) => setCardDetails(prev => ({ ...prev, number: formatCardNumber(e.target.value) }))}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                disabled={processing}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
                <input
                  type="text"
                  value={cardDetails.expiry}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, expiry: formatExpiry(e.target.value) }))}
                  placeholder="MM/YY"
                  maxLength={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                  disabled={processing}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CVC</label>
                <input
                  type="text"
                  value={cardDetails.cvc}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  placeholder="123"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-mono"
                  disabled={processing}
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleStripeConfirm}
            disabled={processing || !cardDetails.number || !cardDetails.expiry || !cardDetails.cvc}
            className="w-full mt-4 bg-purple-600 text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing Payment...' : `Pay ${formatPrice(calculateTotal(), order?.currency || 'GBP')}`}
          </button>
        </div>
      )}

      {/* Payment Error with Retry */}
      {paymentError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Payment Failed</p>
              <p className="text-sm text-red-600 mt-1">{paymentError}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setPaymentError(null);
              setStripeClientSecret(null);
              setStripePaymentIntentId(null);
              setCardDetails({ number: '', expiry: '', cvc: '' });
            }}
            className="w-full mt-3 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
          >
            Retry Payment
          </button>
        </div>
      )}

      {!stripeClientSecret && !paymentError && (
        <button
          onClick={handlePayment}
          disabled={processing || loadingProviders || availableProviders.length === 0 || !selectedProvider}
          className="w-full bg-purple-600 text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? 'Processing...' : loadingProviders ? 'Loading payment methods...' : availableProviders.length === 0 ? 'No Payment Methods Available' : !selectedProvider ? 'Select a Payment Method' : `Complete Payment - ${formatPrice(calculateTotal(), order?.currency || 'GBP')}`}
        </button>
      )}
    </div>
  );
}

export default function PaymentPage() {
  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'SELLER', 'B2C_SELLER', 'WHOLESALER', 'ADMIN', 'INFLUENCER']}>
      <Suspense fallback={
        <div className="min-h-screen bg-white">
          <Header />
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-gray-600">Loading...</p>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      }>
        <PaymentContent />
      </Suspense>
    </RouteGuard>
  );
}
