'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SafeImage } from '@/components/SafeImage';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import { useDateTime } from '@/hooks/useDateTime';
import { DEFAULT_CURRENCY } from '@/lib/regionConfig';

interface OrderItemSummary {
  name: string;
  quantity: number;
  price: number;
  image?: string;
  variant?: string;
  sellerName?: string;
}

interface OrderSummary {
  id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  cardLast4?: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  taxAmount?: number;
  discountAmount?: number;
  currency?: string;
  items: OrderItemSummary[];
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    name?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  createdAt: string;
  loyaltyPointsEarned?: number;
  estimatedDelivery?: string | Date;
  trackingNumber?: string;
  trackingCode?: string;
}

function formatPaymentMethod(method?: string, last4?: string): string | null {
  if (!method && !last4) return null;
  const label = method
    ? method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Card';
  return last4 ? `${label} •••• ${last4}` : label;
}

function formatAddress(address?: OrderSummary['shippingAddress']): string[] {
  if (!address) return [];
  const name =
    address.name ||
    [address.firstName, address.lastName].filter(Boolean).join(' ').trim() ||
    '';
  return [
    name,
    address.addressLine1,
    address.addressLine2,
    [address.city, address.state, address.postalCode].filter(Boolean).join(', '),
    address.country,
    address.phone ? `Phone: ${address.phone}` : '',
  ].filter((line): line is string => Boolean(line && String(line).trim()));
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading order details...</p></div>}>
      <OrderConfirmationContent />
    </Suspense>
  );
}

function OrderConfirmationContent() {
  const { formatDate } = useDateTime();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const paidStatuses = ['paid', 'PAID'];
  const isPaid = order ? paidStatuses.includes(order.paymentStatus || '') : false;
  const isProcessing = order
    ? !isPaid && ['processing', 'PROCESSING', 'pending', 'PENDING'].includes(order.paymentStatus || '')
    : false;
  const hasTracking = Boolean(order?.trackingNumber || order?.trackingCode);
  const paymentLabel = formatPaymentMethod(order?.paymentMethod, order?.cardLast4);
  const addressLines = formatAddress(order?.shippingAddress);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const res = await apiClient.getOrder(orderId);
        const data = res?.data as any;
        if (data) {
          const addr = data.shippingAddress || {};
          setOrder({
            id: data.id,
            orderNumber: data.orderNumber || data.id?.slice(0, 8).toUpperCase(),
            status: data.status,
            paymentStatus: data.paymentStatus,
            paymentMethod: data.paymentMethod || data.payment?.method || data.cardBrand,
            cardLast4: data.cardLast4 || data.payment?.last4 || data.last4,
            total: Number(data.total) || 0,
            subtotal: data.subtotal != null ? Number(data.subtotal) : undefined,
            shippingCost:
              data.shippingCost != null || data.shippingAmount != null
                ? Number(data.shippingCost ?? data.shippingAmount)
                : undefined,
            taxAmount: data.tax != null || data.taxAmount != null
              ? Number(data.tax ?? data.taxAmount)
              : undefined,
            discountAmount:
              data.discountAmount != null || data.discount != null
                ? Number(data.discountAmount ?? data.discount)
                : undefined,
            currency: data.currency || DEFAULT_CURRENCY,
            items: (data.items || data.orderItems || []).map((item: any) => {
              const product = item.product || {};
              const image =
                item.image ||
                item.productImage ||
                product.images?.[0]?.url ||
                (typeof product.images?.[0] === 'string' ? product.images[0] : undefined);
              const variant =
                item.variantName ||
                item.variationLabel ||
                (item.selectedVariations
                  ? Object.values(item.selectedVariations).filter(Boolean).join(' / ')
                  : undefined);
              return {
                name: item.productName || product.name || item.name || 'Product',
                quantity: item.quantity || 1,
                price: Number(item.price ?? item.unitPrice ?? product.price ?? 0),
                image,
                variant: variant || undefined,
                sellerName: item.seller?.storeName || product.seller?.storeName || item.sellerName,
              };
            }),
            shippingAddress: {
              firstName: addr.firstName,
              lastName: addr.lastName,
              name: addr.name || addr.fullName,
              addressLine1: addr.addressLine1 || addr.line1 || addr.street,
              addressLine2: addr.addressLine2 || addr.line2,
              city: addr.city,
              state: addr.state || addr.region,
              postalCode: addr.postalCode || addr.zip || addr.zipCode,
              country: addr.country,
              phone: addr.phone || addr.phoneNumber,
            },
            createdAt: data.createdAt,
            loyaltyPointsEarned: data.loyaltyPointsEarned,
            estimatedDelivery: data.estimatedDeliveryAt || data.estimatedDelivery,
            trackingNumber: data.trackingNumber,
            trackingCode: data.trackingCode,
          });
        }
      } catch {
        // Order may not be accessible if guest
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  return (
    <div className="min-h-screen bg-hos-bg">
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-12 sm:py-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-hos-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="text-center space-y-10">
            {isPaid ? (
              <div className="w-20 h-20 bg-green-900/20 border-2 border-green-500/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-20 h-20 bg-yellow-900/20 border-2 border-yellow-500/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            )}

            <div>
              {isPaid ? (
                <>
                  <h1 className="text-3xl md:text-4xl font-display text-hos-text-secondary font-bold">
                    Order Confirmed!
                  </h1>
                  <p className="text-hos-text-secondary mt-3 text-base sm:text-lg">
                    Thank you for your purchase. Your order has been placed successfully.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl md:text-4xl font-display text-hos-text-secondary font-bold">
                    Payment Pending
                  </h1>
                  <p className="text-hos-text-secondary mt-3 text-base sm:text-lg">
                    Your order is awaiting payment confirmation. If you&apos;ve already paid, this page will update shortly.
                  </p>
                  {orderId && (
                    <Link
                      href={`/payment?orderId=${orderId}`}
                      className="inline-block mt-4 px-6 py-3 bg-hos-gold text-hos-bg rounded-lg font-semibold hover:bg-hos-gold-hover transition-colors"
                    >
                      Complete Payment
                    </Link>
                  )}
                </>
              )}
            </div>

            {order && (
              <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6 text-left space-y-6">
                <div className="flex justify-between items-start gap-4 border-b border-hos-border pb-4">
                  <div>
                    <p className="text-hos-text-secondary text-sm">Order Number</p>
                    <p className="text-hos-text-secondary font-mono font-bold text-base">#{order.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-hos-text-secondary text-sm">Order Total</p>
                    <p className="text-hos-gold font-bold text-xl">{formatPrice(order.total, order.currency || DEFAULT_CURRENCY)}</p>
                  </div>
                </div>

                {order.items.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-hos-text-secondary text-sm font-medium">Items ordered</p>
                    {order.items.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="relative w-14 h-14 bg-hos-bg rounded border border-hos-border flex-shrink-0 overflow-hidden">
                          {item.image ? (
                            <SafeImage
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-hos-text-muted text-xs">
                              N/A
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-hos-text-secondary text-base truncate font-medium">{item.name}</p>
                          <p className="text-hos-text-secondary/80 text-sm">
                            Qty: {item.quantity}
                            {item.variant ? ` · ${item.variant}` : ''}
                            {item.sellerName ? ` · ${item.sellerName}` : ''}
                          </p>
                          <p className="text-hos-text-secondary text-sm">
                            {formatPrice(item.price, order.currency || DEFAULT_CURRENCY)} each
                          </p>
                        </div>
                        <p className="text-hos-text-secondary text-sm font-medium">
                          {formatPrice(item.price * item.quantity, order.currency || DEFAULT_CURRENCY)}
                        </p>
                      </div>
                    ))}
                    {order.items.length > 5 && (
                      <p className="text-hos-text-secondary text-sm">+ {order.items.length - 5} more items</p>
                    )}
                  </div>
                )}

                <div className="space-y-2 border-t border-hos-border pt-4 text-sm">
                  {order.subtotal != null && (
                    <div className="flex justify-between">
                      <span className="text-hos-text-secondary">Subtotal</span>
                      <span className="text-hos-text-secondary">{formatPrice(order.subtotal, order.currency || DEFAULT_CURRENCY)}</span>
                    </div>
                  )}
                  {order.shippingCost != null && (
                    <div className="flex justify-between">
                      <span className="text-hos-text-secondary">Shipping</span>
                      <span className="text-hos-text-secondary">{formatPrice(order.shippingCost, order.currency || DEFAULT_CURRENCY)}</span>
                    </div>
                  )}
                  {order.taxAmount != null && order.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-hos-text-secondary">Tax</span>
                      <span className="text-hos-text-secondary">{formatPrice(order.taxAmount, order.currency || DEFAULT_CURRENCY)}</span>
                    </div>
                  )}
                  {order.discountAmount != null && order.discountAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-hos-text-secondary">Discount</span>
                      <span className="text-hos-text-secondary">−{formatPrice(order.discountAmount, order.currency || DEFAULT_CURRENCY)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 font-semibold">
                    <span className="text-hos-text-secondary">Total</span>
                    <span className="text-hos-gold">{formatPrice(order.total, order.currency || DEFAULT_CURRENCY)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-hos-border pt-4">
                  <div>
                    <p className="text-hos-text-secondary text-sm font-medium mb-1">Payment</p>
                    <p className="text-hos-text-secondary text-base">
                      {paymentLabel || 'Payment method on file'}
                    </p>
                    <p className="text-hos-text-secondary/80 text-sm mt-1">
                      Status:{' '}
                      {isPaid
                        ? 'Paid'
                        : isProcessing
                          ? 'Pending'
                          : order.paymentStatus || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-hos-text-secondary text-sm font-medium mb-1">Estimated Delivery</p>
                    <p className="text-hos-text-secondary text-base">
                      {order.estimatedDelivery
                        ? formatDate(order.estimatedDelivery, { month: 'short',
                            day: 'numeric',
                            year: 'numeric', })
                        : '1–3 business days after shipment'}
                    </p>
                  </div>
                </div>

                {addressLines.length > 0 && (
                  <div className="border-t border-hos-border pt-4">
                    <p className="text-hos-text-secondary text-sm font-medium mb-2">Shipping Address</p>
                    <div className="text-hos-text-secondary text-base space-y-0.5">
                      {addressLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}

                {order.loyaltyPointsEarned && order.loyaltyPointsEarned > 0 && (
                  <div className="bg-hos-gold/10 border border-hos-gold/20 rounded-lg p-3 text-center">
                    <p className="text-hos-gold text-sm font-medium">
                      You earned {order.loyaltyPointsEarned} loyalty points with this purchase!
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6 text-left">
              <h3 className="text-hos-text-secondary font-semibold mb-3 text-lg">What happens next?</h3>
              <ul className="text-hos-text-secondary text-base space-y-3">
                <li className="flex gap-2">
                  <span className="text-hos-gold">1.</span>
                  You&apos;ll receive a confirmation email with your order details.
                </li>
                <li className="flex gap-2">
                  <span className="text-hos-gold">2.</span>
                  The seller will prepare and ship your items (usually 1–3 business days).
                </li>
                <li className="flex gap-2">
                  <span className="text-hos-gold">3.</span>
                  You&apos;ll receive tracking information once your order ships.
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {orderId && (
                <Link
                  href={`/orders/${orderId}`}
                  className="px-6 py-3 bg-hos-gold text-hos-bg rounded-lg font-semibold hover:bg-hos-gold-hover transition-colors"
                >
                  View Order Details
                </Link>
              )}
              <Link
                href="/shop"
                className="px-6 py-3 border border-hos-border text-hos-text-secondary rounded-lg font-semibold hover:border-hos-gold hover:text-hos-gold transition-colors"
              >
                Continue Shopping
              </Link>
              {hasTracking ? (
                <Link
                  href="/track-order"
                  className="px-6 py-3 border border-hos-border text-hos-text-secondary rounded-lg font-semibold hover:border-hos-gold hover:text-hos-gold transition-colors"
                >
                  Track Shipment
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Tracking will be available once your order ships"
                  className="px-6 py-3 border border-hos-border text-hos-text-muted rounded-lg font-semibold opacity-50 cursor-not-allowed"
                >
                  Track Order
                </button>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
