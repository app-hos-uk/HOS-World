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
import { useDateTime } from '@/hooks/useDateTime';
import { DEFAULT_CURRENCY } from '@/lib/regionConfig';

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
  paymentMethod?: string;
  total: number;
  subtotal?: number;
  tax?: number;
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
  estimatedDeliveryAt?: string | Date;
  deliveredAt?: string | Date;
}

type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

const SORT_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  highest: 'Highest price',
  lowest: 'Lowest price',
};

const ORDERS_PER_PAGE = 10;

/**
 * Active fulfillment statuses where Track is useful even before a tracking code
 * is attached (common for wholesale marketplace orders). Refunded/returned are
 * excluded — Track only appears for those when a tracking code already exists.
 */
const TRACKABLE_STATUSES = [
  'processing',
  'fulfilled',
  'shipped',
  'delivered',
  'completed',
];

export default function OrdersPage() {
  const { formatDate, formatDateTime } = useDateTime();
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [currentPage, setCurrentPage] = useState(1);
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

  const isUnpaidOrder = (order: Order) =>
    !order.paymentStatus || order.paymentStatus.toUpperCase() !== 'PAID';

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

  const statusFilteredOrders = useMemo(() => {
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
    if (statusFilter === 'UNPAID') {
      return orders.filter(
        o =>
          isUnpaidOrder(o) && !['cancelled', 'refunded'].includes(normalizeStatus(o.status)),
      );
    }
    if (statusFilter === 'REFUNDED') {
      return orders.filter(
        o =>
          normalizeStatus(o.status) === 'refunded' ||
          (o.paymentStatus || '').toUpperCase() === 'REFUNDED',
      );
    }
    return orders.filter(o => normalizeStatus(o.status) === statusFilter.toLowerCase());
  }, [orders, statusFilter]);

  const filteredOrders = useMemo(() => {
    const tokens = searchTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
    // Every token must appear somewhere in the order, so "crown ring" still matches
    // "Golden Crown Ring" and word order does not matter.
    const matched =
      tokens.length === 0
        ? statusFilteredOrders
        : statusFilteredOrders.filter(order => {
            const haystack = [
              order.orderNumber || '',
              order.id,
              order.status || '',
              order.paymentStatus || '',
              ...(order.items || []).flatMap(item => [
                item.product?.name || '',
                (item as any).productName || '',
              ]),
              ...(order.items || []).map(
                item => (item.product as any)?.seller?.storeName || '',
              ),
            ]
              .join(' ')
              .toLowerCase();
            return tokens.every(token => haystack.includes(token));
          });

    const sorted = [...matched];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'highest':
          return Number(b.total || 0) - Number(a.total || 0);
        case 'lowest':
          return Number(a.total || 0) - Number(b.total || 0);
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    return sorted;
  }, [statusFilteredOrders, searchTerm, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const sliceStart = (safePage - 1) * ORDERS_PER_PAGE;
  const pagedOrders = filteredOrders.slice(sliceStart, sliceStart + ORDERS_PER_PAGE);
  const showingFrom = filteredOrders.length === 0 ? 0 : sliceStart + 1;
  const showingTo = Math.min(sliceStart + ORDERS_PER_PAGE, filteredOrders.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, sortBy]);

  const getPaymentBadge = (order: Order) => {
    const ps = (order.paymentStatus || '').toUpperCase();
    const orderStatus = normalizeStatus(order.status);
    const isClosed = ['cancelled', 'refunded'].includes(orderStatus);

    if (ps === 'REFUNDED') {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-500/15 text-red-300">
          Refunded
        </span>
      );
    }

    // "Payment pending" is misleading once an order is cancelled — the payment will
    // never be taken, or a refund is already under way.
    if (isClosed) {
      if (ps === 'PAID') {
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-500/15 text-orange-300">
            Refund in progress
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-hos-bg-tertiary text-hos-text-secondary">
          Cancelled before payment
        </span>
      );
    }

    if (ps === 'PAID') return null;
    if (ps === 'PENDING' || !ps) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-orange-500/15 text-orange-300">
          Payment pending
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-hos-bg-tertiary text-hos-text-secondary">
        {order.paymentStatus}
      </span>
    );
  };

  /** An invoice only exists once money has actually been taken. */
  const hasInvoice = (order: Order) =>
    (order.paymentStatus || '').toUpperCase() === 'PAID' &&
    !['pending', 'cancelled'].includes(normalizeStatus(order.status));

  const canTrackOrder = (order: Order) => {
    const hasTrackingCode = Boolean(order.trackingNumber || order.trackingCode);
    if (hasTrackingCode) return true;

    // Without a tracking code, only offer Track during active fulfillment —
    // not when the order/payment has already been returned or refunded.
    const status = normalizeStatus(order.status);
    const payment = (order.paymentStatus || '').toLowerCase();
    if (['returned', 'refunded'].includes(status) || payment === 'refunded') {
      return false;
    }
    return TRACKABLE_STATUSES.includes(status);
  };

  /**
   * The most meaningful date for the order's current stage: when it was delivered,
   * when it was cancelled/refunded, or otherwise the delivery estimate.
   */
  const getDeliveryEstimate = (order: Order) => {
    const status = normalizeStatus(order.status);
    const isClosed = ['cancelled', 'refunded'].includes(status);
    const raw = isClosed
      ? (order as any).cancelledAt || order.updatedAt
      : order.deliveredAt || order.estimatedDeliveryAt || order.estimatedDelivery;
    if (!raw) return null;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;

    let label = 'Estimated delivery';
    if (isClosed) {
      label = status === 'refunded' ? 'Refunded on' : 'Cancelled on';
    } else if (order.deliveredAt) {
      label = 'Delivered';
    }

    return {
      label,
      value: formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' }),
    };
  };

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

          {/* Search, filter and sort */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4 mb-6 flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="flex-1">
              <label htmlFor="order-search" className="sr-only">
                Search orders
              </label>
              <input
                id="order-search"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by order number or product name..."
                className="w-full px-4 py-2 rounded-lg bg-hos-bg-primary border border-hos-border text-hos-text-secondary placeholder-hos-text-muted focus:outline-none focus:border-hos-gold focus:ring-2 focus:ring-hos-gold/40"
              />
            </div>
            <div className="flex gap-3">
              <div>
                <label htmlFor="order-status-filter" className="sr-only">
                  Filter by status
                </label>
                <select
                  id="order-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-hos-bg-primary border border-hos-border text-hos-text-secondary focus:outline-none focus:border-hos-gold"
                >
                  <option value="">All Orders</option>
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="UNPAID">Pending Payment</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
              </div>
              <div>
                <label htmlFor="order-sort" className="sr-only">
                  Sort orders
                </label>
                <select
                  id="order-sort"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 rounded-lg bg-hos-bg-primary border border-hos-border text-hos-text-secondary focus:outline-none focus:border-hos-gold"
                >
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
              {pagedOrders.map((order) => {
                const delivery = getDeliveryEstimate(order);
                return (
                <div key={order.id} className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                  {/* Order Header */}
                  <div className="p-4 sm:p-6 border-b border-hos-border">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-hos-text-secondary">
                          Order #{order.orderNumber || order.id.slice(0, 8)}
                        </h3>
                        {/* Badges sit on their own row so spacing stays uniform
                            regardless of order-number length. */}
                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          {getPaymentBadge(order)}
                        </div>
                        <p className="text-sm text-hos-text-muted mt-2">
                          Placed on {formatDate(order.createdAt, { day: 'numeric',
                            month: 'long',
                            year: 'numeric', })}
                        </p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <p className="text-xl font-bold text-hos-gold">
                          {formatPrice(order.total, order.currency || DEFAULT_CURRENCY)}
                        </p>
                        <p className="text-sm text-hos-text-muted">
                          {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                        </p>
                        {order.paymentMethod && (
                          <p className="text-sm text-hos-text-muted mt-1">
                            Paid by {order.paymentMethod}
                          </p>
                        )}
                        {delivery && (
                          <p className="text-sm text-hos-text-muted mt-1">
                            {delivery.label}: {delivery.value}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="p-4 sm:p-6 bg-hos-bg-secondary space-y-3">
                    {order.items?.slice(0, 3).map((item, index) => {
                      const imageUrl = getProductImage(item);
                      return (
                        <div key={item.id || index} className="flex items-center gap-4">
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={item.product?.name || 'Product'}
                              width={56}
                              height={56}
                              className="rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-lg bg-hos-bg-tertiary flex items-center justify-center shrink-0">
                              <span className="text-hos-text-muted text-xs">No img</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/products/${item.productId}`}
                              className="block truncate font-medium text-hos-text-secondary hover:text-hos-gold"
                            >
                              {item.product?.name || 'Product'}
                            </Link>
                            <p className="text-sm text-hos-text-muted">Qty: {item.quantity}</p>
                          </div>
                          <p className="shrink-0 text-sm font-medium text-hos-text-secondary">
                            {formatPrice(item.price * item.quantity, order.currency || DEFAULT_CURRENCY)}
                          </p>
                        </div>
                      );
                    })}
                    {order.items && order.items.length > 3 && (
                      <p className="text-sm text-hos-text-muted">
                        + {order.items.length - 3} more item
                        {order.items.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Order Actions */}
                  <div className="p-4 sm:p-6 flex flex-wrap gap-3 border-t border-hos-border">
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
                    {hasInvoice(order) && (
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
                    {canTrackOrder(order) && (
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
                );
              })}
            </div>
          )}

          {/* Results count and pagination */}
          {!loading && filteredOrders.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-hos-text-muted">
                Showing {showingFrom}–{showingTo} of {filteredOrders.length} order
                {filteredOrders.length !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-1.5 text-sm rounded-md border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-hos-text-muted">
                    Page {safePage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-1.5 text-sm rounded-md border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
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
                      Placed on {formatDateTime(selectedOrder.createdAt)}
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
                {canTrackOrder(selectedOrder) && (
                  <div className="bg-hos-gold/10 rounded-lg p-4 space-y-2">
                    <h3 className="font-medium text-hos-text-secondary mb-2">Tracking Information</h3>
                    {selectedOrder.carrier && (
                      <p className="text-sm text-hos-text-secondary">
                        Carrier: <span className="font-medium">{selectedOrder.carrier}</span>
                      </p>
                    )}
                    {selectedOrder.trackingNumber || selectedOrder.trackingCode ? (
                      <p className="text-sm text-hos-text-secondary">
                        Tracking Number: <span className="font-mono">{selectedOrder.trackingNumber || selectedOrder.trackingCode}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-hos-text-muted">
                        A tracking number will appear here once your parcel is handed to the carrier.
                      </p>
                    )}
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
                    {(() => {
                      const delivery = getDeliveryEstimate(selectedOrder);
                      return delivery ? (
                        <p className="text-sm text-hos-text-secondary">
                          {delivery.label}: {delivery.value}
                        </p>
                      ) : null;
                    })()}
                    <Link
                      href={`/track-order?orderNumber=${selectedOrder.orderNumber || selectedOrder.id}`}
                      className="text-sm text-hos-gold hover:text-hos-gold-hover underline inline-block"
                    >
                      Open tracking page
                    </Link>
                  </div>
                )}

                {/* Payment */}
                <div className="bg-hos-bg-secondary rounded-lg p-4">
                  <h3 className="font-medium text-hos-text-secondary mb-2">Payment</h3>
                  <div className="space-y-1 text-sm text-hos-text-secondary">
                    <p>
                      <span className="text-hos-text-muted">Status: </span>
                      {selectedOrder.paymentStatus || 'Pending'}
                    </p>
                    <p>
                      <span className="text-hos-text-muted">Method: </span>
                      {selectedOrder.paymentMethod || 'Not recorded'}
                    </p>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="bg-hos-bg-secondary rounded-lg p-4">
                  <h3 className="font-medium text-hos-text-secondary mb-2">Shipping Address</h3>
                  {selectedOrder.shippingAddress ? (
                    <p className="text-sm text-hos-text-secondary">
                      {selectedOrder.shippingAddress.street}<br />
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}<br />
                      {selectedOrder.shippingAddress.country}
                    </p>
                  ) : (
                    <p className="text-sm text-hos-text-muted">
                      No shipping address recorded for this order.
                    </p>
                  )}
                </div>

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
                            {formatPrice(item.price * item.quantity, selectedOrder.currency || DEFAULT_CURRENCY)}
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
                        <span className="text-hos-text-secondary">{formatPrice(selectedOrder.subtotal, selectedOrder.currency || DEFAULT_CURRENCY)}</span>
                      </div>
                    )}
                    {(selectedOrder.shippingCost || selectedOrder.shippingAmount) ? (
                      <div className="flex justify-between">
                        <span className="text-hos-text-muted">Shipping</span>
                        <span className="text-hos-text-secondary">{formatPrice(selectedOrder.shippingCost || selectedOrder.shippingAmount || 0, selectedOrder.currency || DEFAULT_CURRENCY)}</span>
                      </div>
                    ) : null}
                    {selectedOrder.tax ? (
                      <div className="flex justify-between">
                        <span className="text-hos-text-muted">Tax</span>
                        <span className="text-hos-text-secondary">{formatPrice(selectedOrder.tax, selectedOrder.currency || DEFAULT_CURRENCY)}</span>
                      </div>
                    ) : null}
                    {(selectedOrder.discount || selectedOrder.discountAmount) ? (
                      <div className="flex justify-between text-green-400">
                        <span>Discount</span>
                        <span>-{formatPrice(selectedOrder.discount || selectedOrder.discountAmount || 0, selectedOrder.currency || DEFAULT_CURRENCY)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-bold text-base pt-2 border-t">
                      <span className="text-hos-text-secondary">Total</span>
                      <span className="text-hos-gold">{formatPrice(selectedOrder.total, selectedOrder.currency || DEFAULT_CURRENCY)}</span>
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
