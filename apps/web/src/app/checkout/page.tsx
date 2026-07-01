'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, getOrCreateGuestCartSessionId, clearGuestCartSessionId, markLoginSuccess, setFrontendSessionCookie, GUEST_CHECKOUT_ACCOUNT_KEY } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { trackBeginCheckout } from '@/lib/analytics';
import { getInfluencerReferral } from '@/lib/referralAttribution';

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
  const { isAuthenticated, loading: authLoading, refreshUser } = useAuth();
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
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [calculatingTax, setCalculatingTax] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  /**1=Address, 2=Shipping, 3=Review items, 4=Confirm & place order */
  const [checkoutStep, setCheckoutStep] = useState(1);
  const checkoutTrackedRef = useRef(false);
  const [isGift, setIsGift] = useState(false);
  const [giftDetails, setGiftDetails] = useState({
    recipientName: '',
    recipientEmail: '',
    recipientPhone: '',
    giftMessage: '',
    giftWrapping: false,
    hidePrice: true,
    senderName: '',
  });
  const [guestCartLoading, setGuestCartLoading] = useState(true);
  const [guestSubmitting, setGuestSubmitting] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [showGuestForm, setShowGuestForm] = useState(true);
  const [guestForm, setGuestForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    phone: '',
    gdprConsent: false,
  });
  const checkoutSteps = useMemo(
    () => [
      { id: 1, label: 'Address' },
      { id: 2, label: 'Shipping' },
      { id: 3, label: 'Review' },
      { id: 4, label: 'Confirm' },
    ],
    [],
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    loadCheckoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) {
      setGuestCartLoading(false);
      return;
    }

    const verifyGuestCart = async () => {
      try {
        const sid = getOrCreateGuestCartSessionId();
        const response = await apiClient.getGuestCart(sid);
        if (!response?.data?.items?.length) {
          toast.error('Your cart is empty');
          router.push('/cart');
        }
      } catch {
        toast.error('Unable to load your basket');
        router.push('/cart');
      } finally {
        setGuestCartLoading(false);
      }
    };

    void verifyGuestCart();
  }, [authLoading, isAuthenticated, router, toast]);

  useEffect(() => {
    if (shippingAddressId && cart?.items?.length > 0) {
      calculateShipping();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingAddressId, cart]);

  /** Promotion-based free shipping overrides quoted carrier rates; re-quote when it is cleared. */
  useEffect(() => {
    if (cart?.promotionFreeShipping) {
      setShippingCost(0);
    } else if (shippingAddressId && cart?.items?.length) {
      void calculateShipping();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.promotionFreeShipping, cart?.id, shippingAddressId]);

  useEffect(() => {
    if (cart && shippingAddressId) {
      calculateTax();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, shippingCost, shippingAddressId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const giftFlag = sessionStorage.getItem('checkout_gift_mode');
      if (giftFlag === 'true') {
        setIsGift(true);
        sessionStorage.removeItem('checkout_gift_mode');
      }
    }
  }, []);

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

        if (cartResponse.data.items?.length && !checkoutTrackedRef.current) {
          checkoutTrackedRef.current = true;
          trackBeginCheckout(cartResponse.data);
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

    setCalculatingShipping(true);
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
          setSelectedShippingMethod(response.data[0].method?.id || response.data[0].id);
          setShippingCost(response.data[0].rate || 0);
        } else if (response.data.length > 0 && selectedShippingMethod) {
          const stillValid = response.data.find(
            (o: any) => (o.method?.id || o.id) === selectedShippingMethod,
          );
          if (stillValid) {
            setShippingCost(stillValid.rate || 0);
          } else {
            setSelectedShippingMethod(response.data[0].method?.id || response.data[0].id);
            setShippingCost(response.data[0].rate || 0);
          }
        } else if (response.data.length === 0) {
          // No shipping options available — clear selection so submit does not send a stale method id
          setSelectedShippingMethod('');
          setShippingCost(0);
        }
      }
    } catch (error: any) {
      console.error('Error calculating shipping:', error);
      setSelectedShippingMethod('');
      setShippingCost(0);
      setShippingOptions([]);
    } finally {
      setCalculatingShipping(false);
    }
  };

  const calculateTax = async () => {
    if (!cart?.items?.length || !shippingAddressId) return;

    setCalculatingTax(true);
    try {
      const address = addresses.find((a: any) => a.id === shippingAddressId);
      if (!address) return;

      const taxPromises = cart.items.map((item: any) => {
        const lineTotal = item.price * item.quantity;
        if (item.product?.taxClassId) {
          return apiClient.calculateTax({
            amount: lineTotal,
            taxClassId: item.product.taxClassId,
            location: {
              country: address.country,
              state: address.state,
              city: address.city,
              postalCode: address.postalCode,
            },
          }).then((res: any) => res?.data?.tax || 0);
        }
        const taxRate = item.product?.taxRate || 0;
        return Promise.resolve(lineTotal * taxRate);
      });

      const taxResults = await Promise.allSettled(taxPromises);
      const totalTax = taxResults.reduce((sum: number, result, idx) => {
        if (result.status === 'fulfilled') {
          return sum + (result.value || 0);
        }
        const item = cart.items[idx];
        const lineTotal = item.price * item.quantity;
        const fallback = lineTotal * (item.product?.taxRate || 0);
        return sum + fallback;
      }, 0);

      setTaxAmount(Number(totalTax.toFixed(2)));
    } catch (error: any) {
      console.error('Error calculating tax:', error);
    } finally {
      setCalculatingTax(false);
    }
  };

  // Check for critical stock issues that prevent checkout
  const hasCriticalStockIssues = useMemo(() => {
    return stockIssues.some(issue => issue.type === 'out_of_stock' || issue.type === 'insufficient');
  }, [stockIssues]);

  const getStockIssueForItem = (productId: string): StockIssue | undefined => {
    return stockIssues.find(issue => issue.productId === productId);
  };

  const isSubmittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  );
  const orderNavTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (orderNavTimeoutRef.current) clearTimeout(orderNavTimeoutRef.current);
    };
  }, []);

  const goNextStep = () => {
    if (checkoutStep === 1 && !shippingAddressId) {
      toast.error('Please select a shipping address');
      return;
    }
    if (checkoutStep === 2 && shippingOptions.length > 0 && !selectedShippingMethod) {
      toast.error('Please select a shipping method');
      return;
    }
    if (checkoutStep === 3 && hasCriticalStockIssues) {
      toast.error('Please resolve stock issues before continuing');
      return;
    }
    if (checkoutStep === 3 && isGift && !giftDetails.recipientName.trim()) {
      toast.error('Please enter the recipient name for your gift');
      return;
    }
    setCheckoutStep((s) => Math.min(4, s + 1));
  };

  const goPrevStep = () => {
    setCheckoutStep((s) => Math.max(1, s - 1));
  };

  const isCalculating = calculatingShipping || calculatingTax;

  const handleGuestCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError(null);

    if (!guestForm.gdprConsent) {
      setGuestError('Please accept the privacy notice to continue.');
      return;
    }

    if (!guestForm.country) {
      setGuestError('Please select your country.');
      return;
    }

    try {
      setGuestSubmitting(true);
      const guestSessionId = getOrCreateGuestCartSessionId();
      const response = await apiClient.guestCheckout({
        email: guestForm.email.trim(),
        firstName: guestForm.firstName.trim(),
        lastName: guestForm.lastName.trim(),
        street: guestForm.street.trim(),
        city: guestForm.city.trim(),
        state: guestForm.state.trim() || undefined,
        postalCode: guestForm.postalCode.trim(),
        country: guestForm.country,
        phone: guestForm.phone.trim() || undefined,
        guestSessionId,
        gdprConsent: true,
      });

      if (!response?.data?.user) {
        throw new Error('Guest checkout failed');
      }

      clearGuestCartSessionId();
      setFrontendSessionCookie();
      markLoginSuccess();
      sessionStorage.setItem(GUEST_CHECKOUT_ACCOUNT_KEY, 'true');

      await refreshUser();
      toast.success('Account created. Continue checkout below.');
    } catch (error: any) {
      const message = error.message || 'Failed to continue as guest';
      if (message.toLowerCase().includes('already exists')) {
        setGuestError(message);
        setShowGuestForm(false);
      } else {
        setGuestError(message);
      }
    } finally {
      setGuestSubmitting(false);
    }
  };

  const handleCreateOrder = async () => {
    if (isSubmittingRef.current) return;

    if (isCalculating) {
      toast.error('Please wait for shipping and tax calculations to finish');
      return;
    }

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

    if (hasCriticalStockIssues) {
      toast.error('Please resolve stock issues before placing order');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setCreatingOrder(true);
      let referralCode: string | undefined;
      let visitorId: string | undefined;
      const influencerRef = getInfluencerReferral();
      if (influencerRef) {
        referralCode = influencerRef.referralCode;
        visitorId = influencerRef.visitorId;
      }

      const effectiveShipping = cart.promotionFreeShipping ? 0 : shippingCost;
      const orderResponse = await apiClient.createOrder({
        shippingAddressId,
        billingAddressId: billingAddressId || shippingAddressId,
        shippingMethodId: selectedShippingMethod || undefined,
        shippingCost: effectiveShipping ?? undefined,
        referralCode,
        visitorId,
        idempotencyKey: idempotencyKeyRef.current,
        ...(isGift
          ? {
              isGift: true,
              giftDetails: {
                recipientName: giftDetails.recipientName,
                recipientEmail: giftDetails.recipientEmail || undefined,
                recipientPhone: giftDetails.recipientPhone || undefined,
                giftMessage: giftDetails.giftMessage || undefined,
                giftWrapping: giftDetails.giftWrapping,
                hidePrice: giftDetails.hidePrice,
                senderName: giftDetails.senderName || undefined,
              },
            }
          : {}),
      });

      if (orderResponse?.data) {
        idempotencyKeyRef.current =
          typeof crypto !== 'undefined' ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
        await refreshCart();
        const isGuestCheckoutAccount =
          typeof window !== 'undefined' &&
          sessionStorage.getItem(GUEST_CHECKOUT_ACCOUNT_KEY) === 'true';
        if (isGuestCheckoutAccount) {
          sessionStorage.removeItem(GUEST_CHECKOUT_ACCOUNT_KEY);
          toast.success('Account created — check your email to set a password and track orders anytime.', { id: 'guest-account-created' });
        } else {
          toast.success('Order placed! Redirecting to payment...', { id: 'order-created' });
        }
        setFrontendSessionCookie();
        router.push(`/payment?orderId=${orderResponse.data.id}`);
        orderNavTimeoutRef.current = setTimeout(() => {
          setCreatingOrder(false);
          isSubmittingRef.current = false;
        }, 8000);
      } else {
        throw new Error('Order creation failed - no data returned');
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      const errorMessage = error.message || 'Failed to create order';
      toast.error(errorMessage);
      if (errorMessage.toLowerCase().includes('stock') || errorMessage.toLowerCase().includes('insufficient')) {
        loadCheckoutData();
      }
      setCreatingOrder(false);
      isSubmittingRef.current = false;
    }
  };

  if (authLoading || (isAuthenticated && loading) || (!isAuthenticated && guestCartLoading)) {
    return (
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <p className="text-sm sm:text-base">Loading checkout...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!isAuthenticated) {
    const signInHref = '/login?returnUrl=/checkout';
    const stashCheckoutEmailForLogin = () => {
      try {
        const trimmed = guestForm.email.trim();
        if (trimmed) sessionStorage.setItem('hos_checkout_email', trimmed);
      } catch {
        /* ignore */
      }
    };

    return (
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 font-primary text-hos-gold">Checkout</h1>
              <p className="text-hos-text-secondary">
                Sign in to your account or continue as a guest. Your basket is saved.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-6">
                <h2 className="text-lg font-semibold text-hos-text-secondary mb-2">Already have an account?</h2>
                <p className="text-sm text-hos-text-muted mb-4">
                  Sign in to use saved addresses and complete your purchase faster.
                </p>
                <div className="flex flex-col gap-3">
                  <Link
                    href={signInHref}
                    onClick={stashCheckoutEmailForLogin}
                    className="px-6 py-3 btn-gold text-center"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/login?register=1&returnUrl=/checkout"
                    className="px-6 py-3 border border-hos-border rounded-lg text-hos-text-secondary hover:bg-hos-bg-tertiary text-center transition-colors"
                  >
                    Create Account
                  </Link>
                </div>
              </div>

              <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-hos-text-secondary">Continue as Guest</h2>
                  {!showGuestForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowGuestForm(true);
                        setGuestError(null);
                      }}
                      className="text-sm text-hos-gold hover:text-hos-gold-hover"
                    >
                      Use a different email
                    </button>
                  )}
                </div>

                {guestError && !showGuestForm && (
                  <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                    {guestError}
                  </div>
                )}

                {showGuestForm ? (
                  <form onSubmit={handleGuestCheckout} className="space-y-4">
                    {guestError && (
                      <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                        {guestError}
                      </div>
                    )}

                    <div>
                      <label htmlFor="guest-email" className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Email *
                      </label>
                      <input
                        id="guest-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={guestForm.email}
                        onChange={(e) => setGuestForm({ ...guestForm, email: e.target.value })}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="guest-first-name" className="block text-sm font-medium text-hos-text-secondary mb-1">
                          First name *
                        </label>
                        <input
                          id="guest-first-name"
                          type="text"
                          autoComplete="given-name"
                          required
                          value={guestForm.firstName}
                          onChange={(e) => setGuestForm({ ...guestForm, firstName: e.target.value })}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        />
                      </div>
                      <div>
                        <label htmlFor="guest-last-name" className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Last name *
                        </label>
                        <input
                          id="guest-last-name"
                          type="text"
                          autoComplete="family-name"
                          required
                          value={guestForm.lastName}
                          onChange={(e) => setGuestForm({ ...guestForm, lastName: e.target.value })}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="guest-street" className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Street address *
                      </label>
                      <input
                        id="guest-street"
                        type="text"
                        autoComplete="street-address"
                        required
                        value={guestForm.street}
                        onChange={(e) => setGuestForm({ ...guestForm, street: e.target.value })}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="guest-city" className="block text-sm font-medium text-hos-text-secondary mb-1">
                          City *
                        </label>
                        <input
                          id="guest-city"
                          type="text"
                          autoComplete="address-level2"
                          required
                          value={guestForm.city}
                          onChange={(e) => setGuestForm({ ...guestForm, city: e.target.value })}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        />
                      </div>
                      <div>
                        <label htmlFor="guest-state" className="block text-sm font-medium text-hos-text-secondary mb-1">
                          State / Province
                        </label>
                        <input
                          id="guest-state"
                          type="text"
                          autoComplete="address-level1"
                          value={guestForm.state}
                          onChange={(e) => setGuestForm({ ...guestForm, state: e.target.value })}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="guest-postal" className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Postal code *
                        </label>
                        <input
                          id="guest-postal"
                          type="text"
                          autoComplete="postal-code"
                          required
                          value={guestForm.postalCode}
                          onChange={(e) => setGuestForm({ ...guestForm, postalCode: e.target.value })}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        />
                      </div>
                      <div>
                        <label htmlFor="guest-country" className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Country *
                        </label>
                        <select
                          id="guest-country"
                          autoComplete="country-name"
                          required
                          value={guestForm.country}
                          onChange={(e) => setGuestForm({ ...guestForm, country: e.target.value })}
                          className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        >
                          <option value="">Select country</option>
                          <option value="United States">United States</option>
                          <option value="United Arab Emirates">United Arab Emirates</option>
                          <option value="Germany">Germany</option>
                          <option value="France">France</option>
                          <option value="Italy">Italy</option>
                          <option value="Spain">Spain</option>
                          <option value="Netherlands">Netherlands</option>
                          <option value="Belgium">Belgium</option>
                          <option value="Austria">Austria</option>
                          <option value="Portugal">Portugal</option>
                          <option value="Ireland">Ireland</option>
                          <option value="Greece">Greece</option>
                          <option value="Finland">Finland</option>
                          <option value="Saudi Arabia">Saudi Arabia</option>
                          <option value="Kuwait">Kuwait</option>
                          <option value="Qatar">Qatar</option>
                          <option value="Bahrain">Bahrain</option>
                          <option value="Oman">Oman</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="guest-phone" className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Phone (optional)
                      </label>
                      <input
                        id="guest-phone"
                        type="tel"
                        autoComplete="tel"
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm({ ...guestForm, phone: e.target.value })}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                      />
                    </div>

                    <label className="flex items-start gap-2 text-sm text-hos-text-secondary">
                      <input
                        type="checkbox"
                        checked={guestForm.gdprConsent}
                        onChange={(e) => setGuestForm({ ...guestForm, gdprConsent: e.target.checked })}
                        className="mt-1 rounded border-hos-border text-hos-gold"
                        required
                      />
                      <span>
                        I acknowledge the privacy notice and agree to account creation so I can complete checkout and receive order updates.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={guestSubmitting}
                      className="w-full px-6 py-3 btn-gold disabled:opacity-50"
                    >
                      {guestSubmitting ? 'Creating account...' : 'Continue to Checkout'}
                    </button>
                  </form>
                ) : (
                  <p className="text-sm text-hos-text-muted">
                    This email is already registered. Use Sign In on the left to access your saved basket and addresses.
                  </p>
                )}
              </div>
            </div>

            <Link
              href="/cart"
              className="inline-block mt-8 text-sm text-hos-gold-hover hover:text-hos-gold"
            >
              ← Back to Basket
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">Checkout</h1>
          <div className="bg-hos-bg-secondary rounded-lg p-6 sm:p-8 text-center">
            <p className="text-base sm:text-lg text-hos-text-secondary mb-4 sm:mb-6">Your cart is empty</p>
            <Link
              href="/products"
              className="inline-block px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-hos-gold hover:bg-hos-gold text-[#1a1406] font-semibold rounded-lg transition-all duration-300"
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
  const effectiveShippingCost = cart.promotionFreeShipping ? 0 : shippingCost;
  const total = subtotal - discount + effectiveShippingCost + taxAmount;

  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 font-primary text-hos-gold">Checkout</h1>

        <nav aria-label="Checkout steps" className="mb-8">
          <ol className="flex flex-wrap gap-2 sm:gap-4 items-center">
            {checkoutSteps.map((s, idx) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-semibold ${
                    checkoutStep === s.id
                      ? 'bg-hos-gold text-[#1a1406]'
                      : checkoutStep > s.id
                        ? 'bg-green-500/10 text-white'
                        : 'bg-hos-bg-tertiary text-hos-text-secondary'
                  }`}
                >
                  {s.id}
                </span>
                <span className={checkoutStep === s.id ? 'font-semibold text-hos-gold' : 'text-hos-text-secondary'}>
                  {s.label}
                </span>
                {idx < checkoutSteps.length - 1 && (
                  <span className="hidden sm:inline text-hos-text-muted mx-1" aria-hidden>
                    /
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div
          className={`grid grid-cols-1 gap-6 sm:gap-8 ${
            checkoutStep === 4 ? '' : 'lg:grid-cols-3'
          }`}
        >
          {/* Checkout Form */}
          <div className={`space-y-6 ${checkoutStep === 4 ? 'hidden' : 'lg:col-span-2'}`}>
            {/* Shipping Address */}
            {checkoutStep === 1 && (
            <section aria-label="Shipping Address" className="bg-hos-bg-secondary rounded-lg shadow-sm border border-hos-border p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Shipping Address</h2>
              {addresses.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-hos-text-secondary mb-4">No addresses found. Please add a shipping address to continue.</p>
                  <Link
                    href="/profile?tab=addresses&action=add&returnUrl=/checkout"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Address
                  </Link>
                  <p className="text-xs text-hos-text-muted mt-2">You will be redirected to your profile to add an address, then return here to complete checkout.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((address: any) => (
                    <label
                      key={address.id}
                      className={`flex items-start p-3 border rounded-lg cursor-pointer hover:bg-hos-bg-tertiary ${
                        shippingAddressId === address.id ? 'border-hos-gold bg-hos-gold/10' : 'border-hos-border'
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
                        <p className="text-sm text-hos-text-secondary">{address.street}</p>
                        <p className="text-sm text-hos-text-secondary">
                          {address.city}, {address.state} {address.postalCode}
                        </p>
                        <p className="text-sm text-hos-text-secondary">{address.country}</p>
                      </div>
                    </label>
                  ))}
                  <Link
                    href="/profile?tab=addresses&action=add&returnUrl=/checkout"
                    className="block text-center text-hos-gold-hover hover:text-hos-gold text-sm"
                  >
                    + Add New Address
                  </Link>
                </div>
              )}
            </section>
            )}

            {/* Shipping Method */}
            {checkoutStep === 2 && shippingAddressId && shippingOptions.length > 0 && (
              <section aria-label="Shipping Method" className="bg-hos-bg-secondary rounded-lg shadow-sm border border-hos-border p-4 sm:p-6">
                <h2 className="text-lg font-semibold mb-4">Shipping Method</h2>
                <div className="space-y-3">
                  {shippingOptions.map((option: any) => {
                    const methodId = option.method?.id || option.id;
                    const methodName = option.method?.name || option.name;
                    const methodDesc = option.method?.description || option.description;
                    return (
                    <label
                      key={methodId}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-hos-bg-tertiary ${
                        selectedShippingMethod === methodId ? 'border-hos-gold bg-hos-gold/10' : 'border-hos-border'
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="radio"
                          name="shippingMethod"
                          value={methodId}
                          checked={selectedShippingMethod === methodId}
                          onChange={(e) => {
                            setSelectedShippingMethod(e.target.value);
                            setShippingCost(option.rate || 0);
                          }}
                          className="mr-3"
                        />
                        <div>
                          <p className="font-medium">{methodName}</p>
                          {methodDesc && (
                            <p className="text-sm text-hos-text-secondary">{methodDesc}</p>
                          )}
                        </div>
                      </div>
                      <p className="font-semibold">{formatPrice(option.rate || 0)}</p>
                    </label>
                    );
                  })}
                </div>
              </section>
            )}
            {checkoutStep === 2 && shippingAddressId && shippingOptions.length === 0 && (
              <section className="bg-hos-bg-secondary rounded-lg shadow-sm border border-hos-border p-4 sm:p-6">
                <h2 className="text-lg font-semibold mb-2">Shipping Method</h2>
                <p className="text-sm text-hos-text-secondary">No shipping options are required or available for this order. Continue to review.</p>
              </section>
            )}

            {/* Order Items */}
            {checkoutStep === 3 && (
            <section aria-label="Order Items" className="bg-hos-bg-secondary rounded-lg shadow-sm border border-hos-border p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">Order Items</h2>
              
              {/* Stock Issues Warning Banner */}
              {hasCriticalStockIssues && (
                <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <span className="text-red-500 text-xl" aria-hidden="true">⚠️</span>
                    <div>
                      <p className="font-medium text-red-300">Stock Issues Detected</p>
                      <p className="text-sm text-red-400 mt-1">
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
                        stockIssue && stockIssue.type !== 'low_stock' ? 'bg-red-500/10 -mx-2 px-2 rounded' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{item.product?.name || 'Product'}</p>
                        <p className="text-sm text-hos-text-secondary">Quantity: {item.quantity}</p>
                        
                        {/* Stock Warning */}
                        {stockIssue && (
                          <p className={`text-xs mt-1 ${
                            stockIssue.type === 'out_of_stock' ? 'text-red-400 font-medium' :
                            stockIssue.type === 'insufficient' ? 'text-orange-400 font-medium' :
                            'text-yellow-400'
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
            )}

            {/* Gifting Option - shown at Review step */}
            {checkoutStep === 3 && (
              <section aria-label="Gift Options" className="bg-hos-bg-secondary rounded-lg shadow-sm border border-hos-border p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isGift}
                      onChange={(e) => setIsGift(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-hos-bg-tertiary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-hos-gold/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-hos-gold"></div>
                  </label>
                  <div>
                    <span className="font-medium text-hos-text-primary">🎁 Sending as a Gift</span>
                    <p className="text-xs text-hos-text-muted">Send this order to a friend or loved one</p>
                  </div>
                </div>

                {isGift && (
                  <div className="space-y-4 border-t border-hos-border pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Recipient Name <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={giftDetails.recipientName}
                          onChange={(e) => setGiftDetails((prev) => ({ ...prev, recipientName: e.target.value }))}
                          placeholder="Enter recipient's name"
                          className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-primary placeholder-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                          Your Name (Sender)
                        </label>
                        <input
                          type="text"
                          value={giftDetails.senderName}
                          onChange={(e) => setGiftDetails((prev) => ({ ...prev, senderName: e.target.value }))}
                          placeholder="From..."
                          className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-primary placeholder-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Recipient Email</label>
                        <input
                          type="email"
                          value={giftDetails.recipientEmail}
                          onChange={(e) => setGiftDetails((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                          placeholder="recipient@email.com"
                          className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-primary placeholder-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Recipient Phone</label>
                        <input
                          type="tel"
                          value={giftDetails.recipientPhone}
                          onChange={(e) => setGiftDetails((prev) => ({ ...prev, recipientPhone: e.target.value }))}
                          placeholder="+971 xxx xxx xxxx"
                          className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-primary placeholder-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">Gift Message</label>
                      <textarea
                        value={giftDetails.giftMessage}
                        onChange={(e) => setGiftDetails((prev) => ({ ...prev, giftMessage: e.target.value }))}
                        placeholder="Write a personal message for the recipient..."
                        rows={3}
                        maxLength={500}
                        className="w-full px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-hos-text-primary placeholder-hos-text-muted focus:outline-none focus:ring-2 focus:ring-hos-gold/50 resize-none"
                      />
                      <p className="text-xs text-hos-text-muted mt-1">{giftDetails.giftMessage.length}/500</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={giftDetails.hidePrice}
                          onChange={(e) => setGiftDetails((prev) => ({ ...prev, hidePrice: e.target.checked }))}
                          className="w-4 h-4 rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                        />
                        <span className="text-sm text-hos-text-secondary">Hide price from recipient</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={giftDetails.giftWrapping}
                          onChange={(e) => setGiftDetails((prev) => ({ ...prev, giftWrapping: e.target.checked }))}
                          className="w-4 h-4 rounded border-hos-border text-hos-gold focus:ring-hos-gold/50"
                        />
                        <span className="text-sm text-hos-text-secondary">Add gift wrapping</span>
                      </label>
                    </div>
                  </div>
                )}
              </section>
            )}

            {checkoutStep < 4 && (
              <div className="flex flex-wrap gap-3 justify-between pt-2">
                <button
                  type="button"
                  onClick={goPrevStep}
                  disabled={checkoutStep === 1}
                  className="px-5 py-2.5 border border-hos-border rounded-lg text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goNextStep}
                  className="px-5 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold font-medium"
                >
                  {checkoutStep === 3 ? 'Continue to confirm' : 'Continue'}
                </button>
              </div>
            )}
          </div>

          {/* Order Review & Summary */}
          <div className={checkoutStep === 4 ? 'max-w-lg mx-auto w-full lg:col-span-3' : 'lg:col-span-1'}>
            <section aria-label="Order Review" className="bg-hos-bg-secondary rounded-lg shadow-sm border border-hos-border p-4 sm:p-6 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">Order Review</h2>

              {/* Selected Shipping Address Summary */}
              {shippingAddressId && (() => {
                const selectedAddress = addresses.find((a: any) => a.id === shippingAddressId);
                return selectedAddress ? (
                  <div className="mb-4 p-3 bg-hos-bg-secondary rounded-lg border border-hos-border">
                    <p className="text-xs font-medium text-hos-text-muted uppercase tracking-wide mb-1">Ship to</p>
                    <p className="text-sm font-medium">{selectedAddress.fullName}</p>
                    <p className="text-xs text-hos-text-secondary">{selectedAddress.street}</p>
                    <p className="text-xs text-hos-text-secondary">
                      {selectedAddress.city}, {selectedAddress.state} {selectedAddress.postalCode}
                    </p>
                    <p className="text-xs text-hos-text-secondary">{selectedAddress.country}</p>
                  </div>
                ) : null;
              })()}

              {/* Selected Shipping Method */}
              {selectedShippingMethod && shippingOptions.length > 0 && (() => {
                const selected = shippingOptions.find((o: any) => o.id === selectedShippingMethod || o.methodId === selectedShippingMethod);
                return selected ? (
                  <div className="mb-4 p-3 bg-hos-bg-secondary rounded-lg border border-hos-border">
                    <p className="text-xs font-medium text-hos-text-muted uppercase tracking-wide mb-1">Shipping</p>
                    <p className="text-sm font-medium text-hos-text-secondary">{selected.name || selected.label || 'Selected method'}</p>
                    {selected.estimatedDays && (
                      <p className="text-xs text-hos-text-muted mt-0.5">{selected.estimatedDays} business days</p>
                    )}
                    <p className="text-xs text-hos-gold mt-1">
                      {effectiveShippingCost > 0 ? formatPrice(effectiveShippingCost) : 'Free'}
                    </p>
                  </div>
                ) : null;
              })()}

              {/* Cart Items Summary */}
              <div className="mb-4">
                <p className="text-xs font-medium text-hos-text-muted uppercase tracking-wide mb-2">
                  Items ({cart.items.length})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cart.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="truncate text-hos-text-secondary">{item.product?.name || 'Product'}</p>
                        <p className="text-xs text-hos-text-muted">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium whitespace-nowrap">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-hos-border pt-3 space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-hos-text-secondary">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Discount</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-hos-text-secondary">Shipping</span>
                  <span>{effectiveShippingCost > 0 ? formatPrice(effectiveShippingCost) : 'Free'}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-hos-text-secondary">Tax</span>
                  <span>{taxAmount > 0 ? formatPrice(taxAmount) : formatPrice(0)}</span>
                </div>
              </div>

              {/* Total */}
              <div className="border-t-2 border-hos-border-accent pt-3 mb-4">
                <div className="flex justify-between font-bold text-lg text-hos-gold">
                  <span>Total</span>
                  <span>{formatPrice(total)}</span>
                </div>
              </div>

              {/* Review Confirmation Separator */}
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-hos-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-hos-bg-secondary px-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
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
                    <svg className="w-4 h-4 text-hos-text-muted flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>
                  )}
                  <span className={shippingAddressId ? 'text-hos-text-secondary' : 'text-hos-text-muted'}>Shipping address selected</span>
                </div>
                <div className="flex items-center gap-2">
                  {!hasCriticalStockIssues ? (
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  )}
                  <span className={!hasCriticalStockIssues ? 'text-hos-text-secondary' : 'text-red-500'}>All items in stock</span>
                </div>
                {shippingOptions.length > 0 && (
                  <div className="flex items-center gap-2">
                    {selectedShippingMethod ? (
                      <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-4 h-4 text-hos-text-muted flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>
                    )}
                    <span className={selectedShippingMethod ? 'text-hos-text-secondary' : 'text-hos-text-muted'}>Shipping method selected</span>
                  </div>
                )}
              </div>

              {checkoutStep === 4 && (
                <button
                  type="button"
                  onClick={goPrevStep}
                  className="w-full mb-3 px-6 py-2.5 border border-hos-border rounded-lg text-hos-text-secondary hover:bg-hos-bg-tertiary"
                >
                  Back to review
                </button>
              )}

              <button
                onClick={handleCreateOrder}
                disabled={
                  creatingOrder ||
                  checkoutStep !== 4 ||
                  !shippingAddressId ||
                  (shippingOptions.length > 0 && !selectedShippingMethod) ||
                  hasCriticalStockIssues
                }
                className="w-full px-6 py-3 btn-gold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutStep !== 4
                  ? 'Complete steps above to place order'
                  : creatingOrder
                    ? 'Creating Order...'
                    : hasCriticalStockIssues
                      ? 'Stock Issues - Update Cart'
                      : 'Place Order'}
              </button>

              {checkoutStep === 4 && (
                <p className="text-xs text-hos-text-muted mt-3 text-center">
                  Secure checkout · Billing address matches shipping unless updated in profile
                </p>
              )}
              
              {hasCriticalStockIssues && (
                <p role="alert" className="text-center mt-2 text-sm text-red-400">
                  Please resolve stock issues to continue
                </p>
              )}

              <Link
                href="/cart"
                className="block text-center mt-4 text-hos-gold-hover hover:text-hos-gold"
              >
                Back to Cart
              </Link>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
