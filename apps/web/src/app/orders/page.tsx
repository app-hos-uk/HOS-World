'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';
import { Modal } from '@/components/ui/Modal';

interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  product?: {
    id: string;
    name: string;
    images?: Array<{ url: string } | string>;
  };
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  shippingAmount?: number;
  discount?: number;
  discountAmount?: number;
  currency?: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items?: OrderItem[];
  trackingNumber?: string;
  trackingCode?: string;
  carrier?: string;
  trackingUrl?: string;
  estimatedDelivery?: string | Date;
}

export default function OrdersPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const allOrders: Order[] = [];
      let page = 1;
      const limit = 50;
      let hasMore = true;

      while (hasMore) {
        const response = await apiClient.getOrders({ page, limit });
        if (response?.data) {
          const pageData = Array.isArray(response.data) ? response.data : [];
          allOrders.push(...pageData);
          const pagination = (response as any).pagination;
          hasMore = pagination ? page < pagination.totalPages : pageData.length === limit;
          page++;
        } else {
          hasMore = false;
        }
      }

      allOrders.sort((a: Order, b: Order) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setOrders(allOrders);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      toast.error(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const normalizeStatus = (s: string) => (s || '').toLowerCase();

  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(o => normalizeStatus(o.status) === 'pending').length,
      processing: orders.filter(o => ['confirmed', 'processing'].includes(normalizeStatus(o.status))).length,
      shipped: orders.filter(o => normalizeStatus(o.status) === 'shipped').length,
      delivered: orders.filter(o => ['delivered', 'completed'].includes(normalizeStatus(o.status))).length,
      cancelled: orders.filter(o => ['cancelled', 'refunded'].includes(normalizeStatus(o.status))).length,
    };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!statusFilter) return orders;

    if (statusFilter === 'PROCESSING') {
      return orders.filter(o => ['confirmed', 'processing'].includes(normalizeStatus(o.status)));
    }
    if (statusFilter === 'DELIVERED') {
      return orders.filter(o => ['delivered', 'completed'].includes(normalizeStatus(o.status)));
    }
    if (statusFilter === 'CANCELLED') {
      return orders.filter(o => ['cancelled', 'refunded'].includes(normalizeStatus(o.status)));
    }
    return orders.filter(o => normalizeStatus(o.status) === statusFilter.toLowerCase());
  }, [orders, statusFilter]);

  const getPaymentBadge = (order: Order) => {
    const ps = (order.paymentStatus || '').toUpperCase();
    if (ps === 'PAID') return null;
    if (ps === 'PENDING' || !ps) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-500/15 text-orange-300">
          Payment pending
        </span>
      );
    }
    if (ps === 'REFUNDED') {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/15 text-red-300">
          Refunded
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-hos-bg-tertiary text-hos-text-secondary">
        {order.paymentStatus}
      </span>
    );
  };

  const isUnpaidOrder = (order: Order) =>
    !order.paymentStatus || order.paymentStatus.toUpperCase() !== 'PAID';

  const getStatusColor = (status: string) => {
    switch (normalizeStatus(status)) {
      case 'pending': return 'bg-yellow-500/15 text-yellow-300';
      case 'accepted':
      case 'confirmed':
      case 'processing': return 'bg-hos-gold/20 text-hos-gold';
      case 'fulfilled':
      case 'shipped': return 'bg-hos-gold/20 text-hos-gold';
      case 'delivered':
      case 'completed': return 'bg-green-500/15 text-green-300';
      case 'cancelled':
      case 'refunded': return 'bg-red-500/15 text-red-300';
      default: return 'bg-hos-bg-tertiary text-hos-text-secondary';
    }
  };

  const getProductImage = (item: OrderItem) => {
    const firstImage = item.product?.images?.[0];
    if (!firstImage) return null;
    return typeof firstImage === 'string' ? firstImage : firstImage.url;
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">My Orders</h1>
            <p className="text-hos-text-secondary mt-1">Track and manage your orders</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <button
              onClick={() => setStatusFilter('')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === '' ? 'ring-2 ring-hos-gold/50' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">All Orders</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">{stats.total}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'PENDING' ? 'ring-2 ring-hos-gold/50' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Pending</h3>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PROCESSING')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'PROCESSING' ? 'ring-2 ring-hos-gold/50' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Processing</h3>
              <p className="text-2xl font-bold text-hos-gold mt-1">{stats.processing}</p>
            </button>
            <button
              onClick={() => setStatusFilter('SHIPPED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'SHIPPED' ? 'ring-2 ring-hos-gold/50' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Shipped</h3>
              <p className="text-2xl font-bold text-hos-gold mt-1">{stats.shipped}</p>
            </button>
            <button
              onClick={() => setStatusFilter('DELIVERED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'DELIVERED' ? 'ring-2 ring-hos-gold/50' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Delivered</h3>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.delivered}</p>
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'CANCELLED' ? 'ring-2 ring-hos-gold/50' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Cancelled</h3>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.cancelled}</p>
            </button>
          </div>

          {/* Orders List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-hos-text-secondary mb-4">
                {orders.length === 0 ? "You haven't placed any orders yet" : "No orders match your filter"}
              </p>
              {orders.length === 0 && (
                <Link
                  href="/products"
                  className="inline-block px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
                >
                  Browse Products
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                  {/* Order Header */}
                  <div className="p-4 sm:p-6 border-b border-hos-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-semibold text-hos-text-secondary">
                            Order #{order.orderNumber || order.id.slice(0, 8)}
                          </h3>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          {getPaymentBadge(order)}
                        </div>
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
                        <p className="text-sm text-hos-text-muted">
                          {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="p-4 sm:p-6 bg-hos-bg-secondary">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2">
                      {order.items?.slice(0, 4).map((item, index) => {
                        const imageUrl = getProductImage(item);
                        return (
                          <div key={item.id || index} className="flex-shrink-0">
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
                          </div>
                        );
                      })}
                      {order.items && order.items.length > 4 && (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-hos-bg-tertiary flex items-center justify-center">
                          <span className="text-hos-text-secondary text-sm font-medium">+{order.items.length - 4}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Actions */}
                  <div className="p-4 sm:p-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => openOrderDetails(order)}
                      className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium text-sm"
                    >
                      View Details
                    </button>
                    {isUnpaidOrder(order) &&
                      !['cancelled', 'refunded'].includes(normalizeStatus(order.status)) && (
                      <Link
                        href={`/payment?orderId=${order.id}`}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium text-sm"
                      >
                        Complete Payment
                      </Link>
                    )}
                    {!['PENDING', 'CANCELLED'].includes(order.status?.toUpperCase()) && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const blob = await apiClient.downloadInvoice(order.id);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `invoice-${order.orderNumber || order.id}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to download invoice');
                          }
                        }}
                        className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium text-sm"
                      >
                        Download Invoice
                      </button>
                    )}
                    {(order.trackingNumber || order.trackingCode) && (
                      <Link
                        href={`/track-order?orderNumber=${order.orderNumber || order.id}`}
                        className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium text-sm"
                      >
                        Track Order
                      </Link>
                    )}
                    {normalizeStatus(order.status) === 'delivered' && (
                      <Link
                        href={`/returns?orderId=${order.id}`}
                        className="px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors font-medium text-sm"
                      >
                        Request Return
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results Count */}
          {!loading && orders.length > 0 && (
            <div className="text-sm text-hos-text-muted text-center mt-6">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          )}
        </main>
        <Footer />

        <Modal
          open={showDetailsModal && !!selectedOrder}
          onClose={() => setShowDetailsModal(false)}
          titleId="customer-order-modal-title"
        >
          {selectedOrder && (
            <>
              <div className="p-6 border-b border-hos-border sticky top-0 bg-hos-bg-secondary">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 id="customer-order-modal-title" className="text-xl font-bold text-hos-text-secondary">
                      Order #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                    </h2>
                    <p className="text-sm text-hos-text-muted mt-1">
                      Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDetailsModal(false)}
                    className="text-hos-text-muted hover:text-hos-text-secondary"
                    aria-label="Close order details"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-hos-text-muted">Status:</span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>

                {/* Tracking Info */}
                {(selectedOrder.trackingNumber || selectedOrder.trackingCode) && (
                  <div className="bg-hos-gold/10 rounded-lg p-4 space-y-2">
                    <h3 className="font-medium text-hos-text-secondary mb-2">Tracking Information</h3>
                    {selectedOrder.carrier && (
                      <p className="text-sm text-hos-text-secondary">
                        Carrier: <span className="font-medium">{selectedOrder.carrier}</span>
                      </p>
                    )}
                    <p className="text-sm text-hos-text-secondary">
                      Tracking Number: <span className="font-mono">{selectedOrder.trackingNumber || selectedOrder.trackingCode}</span>
                    </p>
                    {selectedOrder.trackingUrl && (
                      <a
                        href={selectedOrder.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-hos-gold hover:text-hos-gold-hover underline inline-block"
                      >
                        Track shipment
                      </a>
                    )}
                    {selectedOrder.estimatedDelivery && (
                      <p className="text-sm text-hos-text-secondary">
                        Estimated Delivery: {new Date(selectedOrder.estimatedDelivery).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Shipping Address */}
                {selectedOrder.shippingAddress && (
                  <div className="bg-hos-bg-secondary rounded-lg p-4">
                    <h3 className="font-medium text-hos-text-secondary mb-2">Shipping Address</h3>
                    <p className="text-sm text-hos-text-secondary">
                      {selectedOrder.shippingAddress.street}<br />
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}<br />
                      {selectedOrder.shippingAddress.country}
                    </p>
                  </div>
                )}

                {/* Order Items */}
                <div>
                  <h3 className="font-medium text-hos-text-secondary mb-3">Order Items</h3>
                  <div className="border rounded-lg divide-y">
                    {selectedOrder.items?.map((item, index) => {
                      const imageUrl = getProductImage(item);
                      return (
                        <div key={item.id || index} className="p-4 flex items-center gap-4">
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
                            <Link
                              href={`/products/${item.productId}`}
                              className="font-medium text-hos-text-secondary hover:text-hos-gold"
                            >
                              {item.product?.name || 'Product'}
                            </Link>
                            <p className="text-sm text-hos-text-muted">Qty: {item.quantity}</p>
                          </div>
                          <p className="font-medium text-hos-text-secondary">
                            {formatPrice(item.price * item.quantity, selectedOrder.currency || 'USD')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-hos-bg-secondary rounded-lg p-4">
                  <h3 className="font-medium text-hos-text-secondary mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.subtotal && (
                      <div className="flex justify-between">
                        <span className="text-hos-text-muted">Subtotal</span>
                        <span className="text-hos-text-secondary">{formatPrice(selectedOrder.subtotal, selectedOrder.currency || 'USD')}</span>
                      </div>
                    )}
                    {(selectedOrder.shippingCost || selectedOrder.shippingAmount) ? (
                      <div className="flex justify-between">
                        <span className="text-hos-text-muted">Shipping</span>
                        <span className="text-hos-text-secondary">{formatPrice(selectedOrder.shippingCost || selectedOrder.shippingAmount || 0, selectedOrder.currency || 'USD')}</span>
                      </div>
                    ) : null}
                    {(selectedOrder.discount || selectedOrder.discountAmount) ? (
                      <div className="flex justify-between text-green-400">
                        <span>Discount</span>
                        <span>-{formatPrice(selectedOrder.discount || selectedOrder.discountAmount || 0, selectedOrder.currency || 'USD')}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-bold text-base pt-2 border-t">
                      <span className="text-hos-text-secondary">Total</span>
                      <span className="text-hos-gold">{formatPrice(selectedOrder.total, selectedOrder.currency || 'USD')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-hos-bg-secondary flex gap-3">
                <Link
                  href={`/orders/${selectedOrder.id}`}
                  className="flex-1 px-4 py-2 border border-hos-border-accent text-hos-gold-hover rounded-lg hover:bg-hos-gold/10 text-center font-medium"
                >
                  View Full Details
                </Link>
                {normalizeStatus(selectedOrder.status) === 'delivered' && (
                  <Link
                    href={`/returns?orderId=${selectedOrder.id}`}
                    className="flex-1 px-4 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary text-center font-medium"
                  >
                    Request Return
                  </Link>
                )}
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </RouteGuard>
  );
}
