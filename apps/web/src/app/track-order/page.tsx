'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';

interface TrackingEvent {
  date: string;
  status: string;
  location?: string;
  description: string;
}

interface LiveTrackingEvent {
  timestamp: string | Date;
  statusDescription: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  total: number;
  currency?: string;
  createdAt: string | Date;
  trackingNumber?: string;
  trackingCode?: string;
  carrier?: string;
  trackingUrl?: string;
  estimatedDelivery?: string | Date;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items?: Array<{
    id: string;
    quantity: number;
    price: number;
    product?: {
      name: string;
      images?: Array<{ url: string } | string>;
    };
  }>;
}

const ORDER_STATUSES = [
  { key: 'PENDING', label: 'Order Placed', icon: '📋', description: 'Your order has been received' },
  { key: 'CONFIRMED', label: 'Confirmed', icon: '✅', description: 'Order confirmed by seller' },
  { key: 'PROCESSING', label: 'Processing', icon: '⚙️', description: 'Your order is being prepared' },
  { key: 'FULFILLED', label: 'Packed', icon: '📦', description: 'Order has been packed and ready for shipping' },
  { key: 'SHIPPED', label: 'Shipped', icon: '🚚', description: 'Order is on the way' },
  { key: 'DELIVERED', label: 'Delivered', icon: '🎉', description: 'Order delivered successfully' },
];

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderNumber') || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [liveTrackingEvents, setLiveTrackingEvents] = useState<LiveTrackingEvent[]>([]);

  useEffect(() => {
    const urlOrderNumber = searchParams.get('orderNumber');
    if (urlOrderNumber) {
      setOrderNumber(urlOrderNumber);
      handleTrackOrder(urlOrderNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTrackOrder = async (searchOrderNumber?: string) => {
    const numberToSearch = searchOrderNumber || orderNumber;
    if (!numberToSearch.trim()) {
      setError('Please enter an order number');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);
    setLiveTrackingEvents([]);

    try {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        numberToSearch,
      );
      if (isUUID) {
        setError(
          'Order IDs are private. Sign in to view your orders, or track using your order number (e.g. HOS-...).',
        );
        setLoading(false);
        return;
      }
      const response = await apiClient.trackOrderByNumber(numberToSearch);
      if (response?.data) {
        const raw = response.data as unknown as {
          orderNumber: string;
          status: string;
          total: number;
          currency?: string;
          createdAt: string | Date;
          trackingCode?: string;
          carrier?: string;
          trackingUrl?: string;
          estimatedDelivery?: string | Date;
          items?: Array<{ quantity: number; productName?: string }>;
        };
        setOrder({
          id: raw.orderNumber,
          orderNumber: raw.orderNumber,
          status: raw.status,
          total: raw.total,
          currency: raw.currency,
          createdAt: raw.createdAt,
          trackingCode: raw.trackingCode,
          carrier: raw.carrier,
          trackingUrl: raw.trackingUrl,
          estimatedDelivery: raw.estimatedDelivery,
          items: (raw.items || []).map((it, idx) => ({
            id: `${raw.orderNumber}-item-${idx}-${it.productName || 'unknown'}`,
            quantity: it.quantity,
            price: 0,
            product: { name: it.productName || 'Item' },
          })),
        });

        if (raw.trackingCode) {
          try {
            const trackingRes = await apiClient.getPublicLiveTracking(numberToSearch);
            const events = Array.isArray(trackingRes?.data?.events) ? trackingRes.data.events : [];
            if (events.length > 0) {
              setLiveTrackingEvents(events);
            }
          } catch {
            // Fall back to synthetic timeline
          }
        }
      } else {
        setError('Order not found. Please check the order number and try again.');
      }
    } catch (err: any) {
      console.error('Error tracking order:', err);
      setError('Order not found. Please check the order number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status: string) => {
    const upper = (status || '').toUpperCase();
    const index = ORDER_STATUSES.findIndex(s => s.key === upper);
    // COMPLETED maps to DELIVERED (the last status in the timeline)
    if (upper === 'COMPLETED') return ORDER_STATUSES.length - 1;
    return index >= 0 ? index : 0;
  };

  const currentStatusIndex = order ? getStatusIndex(order.status) : 0;

  const generateTrackingEvents = (trackedOrder: Order): TrackingEvent[] => {
    const events: TrackingEvent[] = [];
    const statusIndex = getStatusIndex(trackedOrder.status);
    const createdDate = new Date(trackedOrder.createdAt);

    for (let i = 0; i <= statusIndex && i < ORDER_STATUSES.length; i++) {
      const eventDate = new Date(createdDate);
      eventDate.setHours(eventDate.getHours() + i * 12);

      const statusKey = ORDER_STATUSES[i].key;
      let location: string | undefined;
      if (statusKey === 'FULFILLED') {
        location = 'Warehouse';
      } else if (statusKey === 'SHIPPED' || statusKey === 'DELIVERED') {
        location = 'Distribution Center';
      }

      events.push({
        date: eventDate.toISOString(),
        status: statusKey,
        description: ORDER_STATUSES[i].description,
        location,
      });
    }

    return events.reverse();
  };

  const formatLiveEventLocation = (event: LiveTrackingEvent) => {
    const parts = [event.location, event.city, event.state, event.country].filter(Boolean);
    return parts.join(', ');
  };

  const timelineEvents = order
    ? liveTrackingEvents.length > 0
      ? liveTrackingEvents.map((event) => ({
          date: String(event.timestamp),
          description: event.statusDescription,
          location: formatLiveEventLocation(event) || undefined,
        }))
      : generateTrackingEvents(order)
    : [];

  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-hos-text-secondary">Track Your Order</h1>
          <p className="text-hos-text-secondary mt-2">Enter your order number to see its current status</p>
        </div>

        {/* Search Form */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
                placeholder="Enter order number (e.g. HOS-...)"
                className="flex-1 px-4 py-3 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
              />
              <button
                onClick={() => handleTrackOrder()}
                disabled={loading}
                className="px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Tracking...
                  </span>
                ) : (
                  'Track'
                )}
              </button>
            </div>
            <p className="text-sm text-hos-text-muted mt-3">
              You can find your order number in your confirmation email or in{' '}
              <Link href="/orders" className="text-hos-gold hover:text-hos-gold-hover">
                My Orders
              </Link>
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && searched && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-lg text-center">
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Order Found */}
        {order && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Order Header */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-hos-text-secondary">
                    Order #{order.orderNumber || order.id.slice(0, 8)}
                  </h2>
                  <p className="text-sm text-hos-text-muted mt-1">
                    Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-hos-gold">
                    {formatPrice(order.total, order.currency || 'USD')}
                  </p>
                  {order.estimatedDelivery && (
                    <p className="text-sm text-hos-text-muted">
                      Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Tracker */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="font-semibold text-hos-text-secondary mb-6">Order Progress</h3>
              
              {/* Handle cancelled/refunded status */}
              {['cancelled', 'refunded'].includes((order.status || '').toLowerCase()) ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">
                    {order.status.toLowerCase() === 'cancelled' ? '❌' : '💸'}
                  </div>
                  <h4 className="text-xl font-bold text-hos-text-secondary">
                    Order {order.status.toLowerCase() === 'cancelled' ? 'Cancelled' : 'Refunded'}
                  </h4>
                  <p className="text-hos-text-secondary mt-2">
                    {order.status.toLowerCase() === 'cancelled'
                      ? 'This order has been cancelled.'
                      : 'This order has been refunded.'}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-8 left-0 right-0 h-1 bg-hos-bg-tertiary">
                    <div 
                      className="h-full bg-hos-gold transition-all duration-500"
                      style={{ width: `${(currentStatusIndex / (ORDER_STATUSES.length - 1)) * 100}%` }}
                    />
                  </div>

                  {/* Status Steps */}
                  <div className="relative flex justify-between">
                    {ORDER_STATUSES.map((status, index) => (
                      <div key={status.key} className="flex flex-col items-center">
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl z-10 transition-all ${
                            index <= currentStatusIndex
                              ? 'bg-hos-gold text-[#1a1406]'
                              : 'bg-hos-bg-tertiary text-hos-text-muted'
                          }`}
                        >
                          {status.icon}
                        </div>
                        <p className={`mt-3 text-sm font-medium ${
                          index <= currentStatusIndex ? 'text-hos-gold' : 'text-hos-text-muted'
                        }`}>
                          {status.label}
                        </p>
                        <p className="text-xs text-hos-text-muted text-center max-w-[100px] hidden sm:block">
                          {status.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tracking Number */}
            {(order.trackingNumber || order.trackingCode) && (
              <div className="bg-hos-gold/10 rounded-lg shadow p-6 space-y-3">
                {order.carrier && (
                  <div>
                    <h3 className="font-semibold text-hos-text-secondary">Carrier</h3>
                    <p className="text-hos-text-secondary mt-1">{order.carrier}</p>
                  </div>
                )}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-semibold text-hos-text-secondary">Tracking Number</h3>
                    <p className="font-mono text-hos-gold mt-1">{order.trackingNumber || order.trackingCode}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText((order.trackingNumber || order.trackingCode)!);
                      toast.success('Tracking number copied!');
                    }}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium text-sm"
                  >
                    Copy
                  </button>
                </div>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm text-hos-gold hover:text-hos-gold-hover underline"
                  >
                    Open carrier tracking page
                  </a>
                )}
                {order.estimatedDelivery && (
                  <p className="text-sm text-hos-text-secondary">
                    Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="font-semibold text-hos-text-secondary mb-4">
                {liveTrackingEvents.length > 0 ? 'Live Tracking History' : 'Tracking History'}
              </h3>
              <div className="space-y-4">
                {timelineEvents.map((event, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-hos-gold' : 'bg-hos-bg-tertiary'
                      }`} />
                      {index < timelineEvents.length - 1 && (
                        <div className="w-0.5 h-full bg-hos-bg-tertiary mt-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="font-medium text-hos-text-secondary">{event.description}</p>
                      <p className="text-sm text-hos-text-muted">
                        {new Date(event.date).toLocaleString()}
                        {event.location && ` • ${event.location}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Address */}
            {order.shippingAddress && (
              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h3 className="font-semibold text-hos-text-secondary mb-3">Shipping Address</h3>
                <p className="text-hos-text-secondary">
                  {order.shippingAddress.street}<br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
                  {order.shippingAddress.country}
                </p>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h3 className="font-semibold text-hos-text-secondary mb-4">Items in Order</h3>
              <div className="divide-y">
                {order.items?.map((item, index) => {
                  const firstImage = item.product?.images?.[0];
                  const imageUrl = firstImage 
                    ? (typeof firstImage === 'string' ? firstImage : firstImage.url)
                    : null;

                  return (
                    <div key={item.id || index} className="py-4 flex items-center gap-4">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.product?.name || 'Product'}
                          width={64}
                          height={64}
                          className="rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-hos-bg-tertiary flex items-center justify-center">
                          <span className="text-hos-text-muted text-xs">No img</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-hos-text-secondary">{item.product?.name || 'Product'}</p>
                        <p className="text-sm text-hos-text-muted">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-hos-text-secondary">
                        {formatPrice(item.price * item.quantity, order.currency || 'USD')}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                href="/orders"
                className="px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
              >
                View All Orders
              </Link>
              <Link
                href="/help"
                className="px-6 py-3 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium"
              >
                Contact Support
              </Link>
            </div>
          </div>
        )}

        {/* No Search Yet */}
        {!searched && !order && !loading && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-hos-text-secondary">
                Enter your order number above to track its progress
              </p>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-hos-bg-secondary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
      </div>
    }>
      <TrackOrderContent />
    </Suspense>
  );
}
