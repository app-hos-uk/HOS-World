'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';

const api = apiClient as any;

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    images?: Array<{ url: string } | string>;
    slug?: string;
  };
}

interface OrderNote {
  id: string;
  content: string;
  internal: boolean;
  createdAt: string | Date;
  createdBy: string;
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  shippingAmount?: number;
  discount?: number;
  discountAmount?: number;
  tax?: number;
  currency?: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  billingAddress?: {
    firstName?: string;
    lastName?: string;
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items?: OrderItem[];
  trackingNumber?: string;
  trackingCode?: string;
  estimatedDelivery?: string | Date;
  notes?: OrderNote[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getOrder(orderId);
      if (response?.data) {
        setOrder(response.data);
      } else {
        setError('Order not found');
      }
    } catch (err: any) {
      console.error('Error fetching order:', err);
      setError(err.message || 'Failed to load order');
      toast.error(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-500/15 text-yellow-300';
      case 'CONFIRMED':
      case 'PROCESSING':
        return 'bg-hos-gold/20 text-hos-gold';
      case 'FULFILLED':
      case 'SHIPPED':
        return 'bg-hos-gold/20 text-hos-gold';
      case 'DELIVERED':
      case 'COMPLETED':
        return 'bg-green-500/15 text-green-300';
      case 'CANCELLED':
      case 'REFUNDED':
        return 'bg-red-500/15 text-red-300';
      default:
        return 'bg-hos-bg-tertiary text-white';
    }
  };

  const getProductImage = (item: OrderItem) => {
    const firstImage = item.product?.images?.[0];
    if (!firstImage) return null;
    return typeof firstImage === 'string' ? firstImage : firstImage.url;
  };

  const formatAddress = (address: any) => {
    if (!address) return null;
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  if (loading) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']}>
        <div className="min-h-screen bg-hos-bg-secondary">
          <Header />
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-hos-text-secondary">Loading order details...</p>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  if (error || !order) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']}>
        <div className="min-h-screen bg-hos-bg-secondary">
          <Header />
          <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">❌</div>
              <h1 className="text-xl font-bold text-red-300 mb-2">Order Not Found</h1>
              <p className="text-red-400 mb-4">{error || 'The order you are looking for does not exist.'}</p>
              <Link
                href="/orders"
                className="inline-block px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors"
              >
                Back to Orders
              </Link>
            </div>
          </main>
          <Footer />
        </div>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']}>
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/orders"
              className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium mb-4 inline-block"
            >
              ← Back to Orders
            </Link>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Order #{order.orderNumber || order.id.slice(0, 8)}
                </h1>
                <p className="text-hos-text-secondary mt-1">
                  Placed on {new Date(order.createdAt).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span className={`px-4 py-2 text-sm font-medium rounded-full ${getStatusColor(order.status)}`}>
                {order.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Items */}
              <div className="bg-hos-bg-secondary rounded-lg shadow border border-hos-border">
                <div className="p-4 sm:p-6 border-b border-hos-border">
                  <h2 className="text-lg font-semibold text-white">Order Items</h2>
                </div>
                <div className="divide-y">
                  {order.items?.map((item, index) => {
                    const imageUrl = getProductImage(item);
                    return (
                      <div key={item.id || index} className="p-4 sm:p-6">
                        <div className="flex gap-4">
                          {imageUrl ? (
                            <Link href={`/products/${item.productId}`}>
                              <Image
                                src={imageUrl}
                                alt={item.product?.name || 'Product'}
                                width={96}
                                height={96}
                                className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover hover:opacity-80 transition-opacity"
                              />
                            </Link>
                          ) : (
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-hos-bg-tertiary flex items-center justify-center flex-shrink-0">
                              <span className="text-hos-text-muted text-xs">No img</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/products/${item.productId}`}
                              className="font-medium text-white hover:text-hos-gold transition-colors block mb-1"
                            >
                              {item.product?.name || 'Product'}
                            </Link>
                            <p className="text-sm text-hos-text-muted">Quantity: {item.quantity}</p>
                            <p className="text-sm text-hos-text-muted">Unit Price: {formatPrice(item.price, order.currency || 'USD')}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-white">
                              {formatPrice(item.price * item.quantity, order.currency || 'USD')}
                            </p>
                            {['DELIVERED', 'COMPLETED'].includes(order.status.toUpperCase()) && (
                              <Link
                                href={`/products/${item.productId}`}
                                className="text-sm text-hos-gold hover:text-hos-gold-hover mt-2 inline-block"
                              >
                                Buy Again
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tracking Information */}
              {(order.trackingNumber || order.trackingCode) && (
                <div className="bg-hos-bg-secondary rounded-lg shadow border border-hos-border p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Tracking Information</h2>
                  <div className="bg-hos-gold/10 rounded-lg p-4">
                    <p className="text-sm text-hos-text-secondary mb-1">Tracking Number</p>
                    <p className="font-mono text-lg font-semibold text-hos-gold">{order.trackingNumber || order.trackingCode}</p>
                    {order.estimatedDelivery && (
                      <>
                        <p className="text-sm text-hos-text-secondary mt-3 mb-1">Estimated Delivery</p>
                        <p className="text-white">
                          {new Date(order.estimatedDelivery).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </>
                    )}
                    <Link
                      href={`/track-order?orderNumber=${order.orderNumber || order.id}`}
                      className="inline-block mt-4 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors text-sm font-medium"
                    >
                      Track Order
                    </Link>
                  </div>
                </div>
              )}

              {/* Order Notes */}
              {order.notes && order.notes.length > 0 && (
                <div className="bg-hos-bg-secondary rounded-lg shadow border border-hos-border p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Order Notes</h2>
                  <div className="space-y-3">
                    {order.notes.filter(note => !note.internal).map((note) => (
                      <div key={note.id} className="border-l-4 border-hos-border-accent pl-4 py-2">
                        <p className="text-hos-text-secondary">{note.content}</p>
                        <p className="text-xs text-hos-text-muted mt-1">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Order Summary */}
              <div className="bg-hos-bg-secondary rounded-lg shadow border border-hos-border p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Order Summary</h2>
                <div className="space-y-3">
                  {order.subtotal !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-hos-text-secondary">Subtotal</span>
                      <span className="text-white">{formatPrice(order.subtotal, order.currency || 'USD')}</span>
                    </div>
                  )}
                  {(order.shippingCost || order.shippingAmount) ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-hos-text-secondary">Shipping</span>
                      <span className="text-white">{formatPrice(order.shippingCost || order.shippingAmount || 0, order.currency || 'USD')}</span>
                    </div>
                  ) : null}
                  {order.tax !== undefined && order.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-hos-text-secondary">Tax</span>
                      <span className="text-white">{formatPrice(order.tax, order.currency || 'USD')}</span>
                    </div>
                  )}
                  {(order.discount || order.discountAmount) ? (
                    <div className="flex justify-between text-sm text-green-400">
                      <span>Discount</span>
                      <span>-{formatPrice(order.discount || order.discountAmount || 0, order.currency || 'USD')}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between font-bold text-base pt-3 border-t">
                    <span className="text-white">Total</span>
                    <span className="text-hos-gold">{formatPrice(order.total, order.currency || 'USD')}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="bg-hos-bg-secondary rounded-lg shadow border border-hos-border p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Shipping Address</h2>
                  <div className="text-sm text-hos-text-secondary space-y-1">
                    {order.shippingAddress.firstName && order.shippingAddress.lastName && (
                      <p className="font-medium">
                        {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                      </p>
                    )}
                    {order.shippingAddress.street && <p>{order.shippingAddress.street}</p>}
                    <p>
                      {[
                        order.shippingAddress.city,
                        order.shippingAddress.state,
                        order.shippingAddress.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {order.shippingAddress.country && <p>{order.shippingAddress.country}</p>}
                    {order.shippingAddress.phone && (
                      <p className="mt-2 text-hos-text-secondary">Phone: {order.shippingAddress.phone}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Billing Address */}
              {order.billingAddress && formatAddress(order.billingAddress) !== formatAddress(order.shippingAddress) && (
                <div className="bg-hos-bg-secondary rounded-lg shadow border border-hos-border p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Billing Address</h2>
                  <div className="text-sm text-hos-text-secondary space-y-1">
                    {order.billingAddress.firstName && order.billingAddress.lastName && (
                      <p className="font-medium">
                        {order.billingAddress.firstName} {order.billingAddress.lastName}
                      </p>
                    )}
                    {order.billingAddress.street && <p>{order.billingAddress.street}</p>}
                    <p>
                      {[
                        order.billingAddress.city,
                        order.billingAddress.state,
                        order.billingAddress.postalCode,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {order.billingAddress.country && <p>{order.billingAddress.country}</p>}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="bg-hos-bg-secondary rounded-lg shadow border border-hos-border p-4 sm:p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Actions</h2>
                <div className="space-y-3">
                  {(order.trackingNumber || order.trackingCode) && (
                    <Link
                      href={`/track-order?orderNumber=${order.orderNumber || order.id}`}
                      className="block w-full px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary text-center font-medium transition-colors"
                    >
                      Track Order
                    </Link>
                  )}
                  {['DELIVERED', 'COMPLETED'].includes(order.status.toUpperCase()) && (
                    <>
                      <Link
                        href={`/returns?orderId=${order.id}`}
                        className="block w-full px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary text-center font-medium transition-colors"
                      >
                        Request Return
                      </Link>
                      <button
                        onClick={async () => {
                          try {
                            const response = await api.reorderItems(orderId);
                            if (response?.data) {
                              const { itemsAdded, itemsUpdated } = response.data;
                              // Build an accurate toast message
                              const parts: string[] = [];
                              if (itemsAdded > 0) {
                                parts.push(`${itemsAdded} new item(s) added`);
                              }
                              if (itemsUpdated > 0) {
                                parts.push(`${itemsUpdated} existing item(s) updated`);
                              }
                              const message = parts.length > 0 
                                ? parts.join(', ') + ' in cart!' 
                                : 'No items were added to cart';
                              toast.success(message);
                              router.push('/cart');
                            }
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to reorder items');
                          }
                        }}
                        className="w-full px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium transition-colors"
                      >
                        Reorder Items
                      </button>
                    </>
                  )}
                  {['PENDING', 'CONFIRMED'].includes(order.status.toUpperCase()) && (
                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to cancel this order?')) return;
                        try {
                          await api.cancelOrder(orderId);
                          toast.success('Order cancelled successfully');
                          fetchOrder(); // Refresh order details
                        } catch (err: any) {
                          toast.error(err.message || 'Failed to cancel order');
                        }
                      }}
                      className="w-full px-4 py-2 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 font-medium transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
