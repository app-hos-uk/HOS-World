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

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  total: number;
  currency?: string;
  createdAt: string | Date;
  trackingNumber?: string;
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
  { key: 'SHIPPED', label: 'Shipped', icon: '📦', description: 'Order has been shipped' },
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

    try {
      const response = await apiClient.getOrder(numberToSearch);
      if (response?.data) {
        setOrder(response.data);
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
    const index = ORDER_STATUSES.findIndex(s => s.key === status);
    // Handle completed status
    if (status === 'COMPLETED') return ORDER_STATUSES.length - 1;
    return index >= 0 ? index : 0;
  };

  const currentStatusIndex = order ? getStatusIndex(order.status) : 0;

  const generateTrackingEvents = (order: Order): TrackingEvent[] => {
    const events: TrackingEvent[] = [];
    const statusIndex = getStatusIndex(order.status);
    const createdDate = new Date(order.createdAt);

    // Generate events based on current status
    for (let i = 0; i <= statusIndex && i < ORDER_STATUSES.length; i++) {
      const eventDate = new Date(createdDate);
      eventDate.setHours(eventDate.getHours() + i * 12); // Add 12 hours per stage

      events.push({
        date: eventDate.toISOString(),
        status: ORDER_STATUSES[i].key,
        description: ORDER_STATUSES[i].description,
        location: i >= 3 ? 'Distribution Center' : undefined,
      });
    }

    return events.reverse(); // Most recent first
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Track Your Order</h1>
          <p className="text-gray-600 mt-2">Enter your order number to see its current status</p>
        </div>

        {/* Search Form */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTrackOrder()}
                placeholder="Enter order number or ID"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={() => handleTrackOrder()}
                disabled={loading}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
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
            <p className="text-sm text-gray-500 mt-3">
              You can find your order number in your confirmation email or in{' '}
              <Link href="/orders" className="text-purple-600 hover:text-purple-700">
                My Orders
              </Link>
            </p>
          </div>
        </div>

        {/* Error State */}
        {error && searched && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg text-center">
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Order Found */}
        {order && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Order Header */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Order #{order.orderNumber || order.id.slice(0, 8)}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Placed on {new Date(order.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-purple-600">
                    {formatPrice(order.total, order.currency || 'GBP')}
                  </p>
                  {order.estimatedDelivery && (
                    <p className="text-sm text-gray-500">
                      Est. Delivery: {new Date(order.estimatedDelivery).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Progress Tracker */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-6">Order Progress</h3>
              
              {/* Handle cancelled/refunded status */}
              {['CANCELLED', 'REFUNDED'].includes(order.status) ? (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">
                    {order.status === 'CANCELLED' ? '❌' : '💸'}
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">
                    Order {order.status === 'CANCELLED' ? 'Cancelled' : 'Refunded'}
                  </h4>
                  <p className="text-gray-600 mt-2">
                    {order.status === 'CANCELLED' 
                      ? 'This order has been cancelled.'
                      : 'This order has been refunded.'}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  {/* Progress Line */}
                  <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-500"
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
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-200 text-gray-400'
                          }`}
                        >
                          {status.icon}
                        </div>
                        <p className={`mt-3 text-sm font-medium ${
                          index <= currentStatusIndex ? 'text-purple-600' : 'text-gray-400'
                        }`}>
                          {status.label}
                        </p>
                        <p className="text-xs text-gray-500 text-center max-w-[100px] hidden sm:block">
                          {status.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tracking Number */}
            {order.trackingNumber && (
              <div className="bg-purple-50 rounded-lg shadow p-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">Tracking Number</h3>
                    <p className="font-mono text-purple-600 mt-1">{order.trackingNumber}</p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(order.trackingNumber!);
                      toast.success('Tracking number copied!');
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Tracking History</h3>
              <div className="space-y-4">
                {generateTrackingEvents(order).map((event, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-purple-600' : 'bg-gray-300'
                      }`} />
                      {index < generateTrackingEvents(order).length - 1 && (
                        <div className="w-0.5 h-full bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className="font-medium text-gray-900">{event.description}</p>
                      <p className="text-sm text-gray-500">
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
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold text-gray-900 mb-3">Shipping Address</h3>
                <p className="text-gray-700">
                  {order.shippingAddress.street}<br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />
                  {order.shippingAddress.country}
                </p>
              </div>
            )}

            {/* Order Items */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Items in Order</h3>
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
                        <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No img</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.product?.name || 'Product'}</p>
                        <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-gray-900">
                        {formatPrice(item.price * item.quantity, order.currency || 'GBP')}
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
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                View All Orders
              </Link>
              <Link
                href="/help"
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Contact Support
              </Link>
            </div>
          </div>
        )}

        {/* No Search Yet */}
        {!searched && !order && !loading && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-gray-600">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    }>
      <TrackOrderContent />
    </Suspense>
  );
}
