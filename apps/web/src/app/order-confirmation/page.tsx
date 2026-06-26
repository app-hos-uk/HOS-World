'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';

interface OrderSummary {
  id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number; image?: string }>;
  shippingAddress?: { city?: string; country?: string };
  createdAt: string;
  loyaltyPointsEarned?: number;
}

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { formatPrice } = useCurrency();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const paidStatuses = ['paid', 'PAID'];
  const confirmedStatuses = ['confirmed', 'CONFIRMED', 'processing', 'PROCESSING', 'fulfilled', 'FULFILLED', 'shipped', 'SHIPPED', 'delivered', 'DELIVERED'];
  const isPaid = order ? (paidStatuses.includes(order.paymentStatus || '') || confirmedStatuses.includes(order.status)) : false;

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
          setOrder({
            id: data.id,
            orderNumber: data.orderNumber || data.id?.slice(0, 8).toUpperCase(),
            status: data.status,
            paymentStatus: data.paymentStatus,
            total: data.total || 0,
            items: (data.items || data.orderItems || []).map((item: any) => ({
              name: item.productName || item.name || 'Product',
              quantity: item.quantity || 1,
              price: item.price || item.unitPrice || 0,
              image: item.image || item.productImage,
            })),
            shippingAddress: data.shippingAddress,
            createdAt: data.createdAt,
            loyaltyPointsEarned: data.loyaltyPointsEarned,
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
          <div className="text-center space-y-8">
            {/* Status Icon */}
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
                  <p className="text-hos-text-muted mt-2 text-lg">
                    Thank you for your purchase. Your order has been placed successfully.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-3xl md:text-4xl font-display text-hos-text-secondary font-bold">
                    Payment Pending
                  </h1>
                  <p className="text-hos-text-muted mt-2 text-lg">
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
              <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6 text-left space-y-4">
                <div className="flex justify-between items-center border-b border-hos-border pb-4">
                  <div>
                    <p className="text-hos-text-muted text-sm">Order Number</p>
                    <p className="text-hos-text-secondary font-mono font-bold">#{order.orderNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-hos-text-muted text-sm">Total</p>
                    <p className="text-hos-gold font-bold text-xl">{formatPrice(order.total)}</p>
                  </div>
                </div>

                {order.items.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-hos-text-muted text-sm font-medium">Items ordered</p>
                    {order.items.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-hos-bg rounded border border-hos-border flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-hos-text-secondary text-sm truncate">{item.name}</p>
                          <p className="text-hos-text-muted text-xs">Qty: {item.quantity}</p>
                        </div>
                        <p className="text-hos-text-secondary text-sm">{formatPrice(item.price * item.quantity)}</p>
                      </div>
                    ))}
                    {order.items.length > 5 && (
                      <p className="text-hos-text-muted text-xs">+ {order.items.length - 5} more items</p>
                    )}
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

            {/* What's Next */}
            <div className="bg-hos-bg-secondary border border-hos-border rounded-xl p-6 text-left">
              <h3 className="text-hos-text-secondary font-semibold mb-3">What happens next?</h3>
              <ul className="text-hos-text-muted text-sm space-y-2">
                <li className="flex gap-2">
                  <span className="text-hos-gold">1.</span>
                  You&apos;ll receive a confirmation email with your order details.
                </li>
                <li className="flex gap-2">
                  <span className="text-hos-gold">2.</span>
                  The seller will prepare and ship your items (usually 1-3 business days).
                </li>
                <li className="flex gap-2">
                  <span className="text-hos-gold">3.</span>
                  You&apos;ll receive tracking information once your order ships.
                </li>
              </ul>
            </div>

            {/* Actions */}
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
              <Link
                href="/track-order"
                className="px-6 py-3 border border-hos-border text-hos-text-secondary rounded-lg font-semibold hover:border-hos-gold hover:text-hos-gold transition-colors"
              >
                Track Order
              </Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
