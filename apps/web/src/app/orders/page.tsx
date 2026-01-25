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
  total: number;
  subtotal?: number;
  shippingCost?: number;
  discount?: number;
  currency?: string;
  createdAt: string;
  updatedAt?: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items?: OrderItem[];
  trackingNumber?: string;
  estimatedDelivery?: string;
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
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getOrders();
      if (response?.data) {
        const orderData = Array.isArray(response.data) ? response.data : [];
        // Sort by most recent first
        orderData.sort((a: Order, b: Order) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(orderData);
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      toast.error(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'PENDING').length,
      processing: orders.filter(o => ['CONFIRMED', 'PROCESSING'].includes(o.status)).length,
      shipped: orders.filter(o => o.status === 'SHIPPED').length,
      delivered: orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status)).length,
      cancelled: orders.filter(o => ['CANCELLED', 'REFUNDED'].includes(o.status)).length,
    };
  }, [orders]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!statusFilter) return orders;
    
    if (statusFilter === 'PROCESSING') {
      return orders.filter(o => ['CONFIRMED', 'PROCESSING'].includes(o.status));
    }
    if (statusFilter === 'DELIVERED') {
      return orders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status));
    }
    if (statusFilter === 'CANCELLED') {
      return orders.filter(o => ['CANCELLED', 'REFUNDED'].includes(o.status));
    }
    return orders.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
      case 'PROCESSING': return 'bg-blue-100 text-blue-800';
      case 'SHIPPED': return 'bg-purple-100 text-purple-800';
      case 'DELIVERED':
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED':
      case 'REFUNDED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Orders</h1>
            <p className="text-gray-600 mt-1">Track and manage your orders</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <button
              onClick={() => setStatusFilter('')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === '' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">All Orders</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'PENDING' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Pending</h3>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PROCESSING')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'PROCESSING' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Processing</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.processing}</p>
            </button>
            <button
              onClick={() => setStatusFilter('SHIPPED')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'SHIPPED' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Shipped</h3>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.shipped}</p>
            </button>
            <button
              onClick={() => setStatusFilter('DELIVERED')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'DELIVERED' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Delivered</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.delivered}</p>
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                statusFilter === 'CANCELLED' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Cancelled</h3>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.cancelled}</p>
            </button>
          </div>

          {/* Orders List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-gray-600 mb-4">
                {orders.length === 0 ? "You haven't placed any orders yet" : "No orders match your filter"}
              </p>
              {orders.length === 0 && (
                <Link
                  href="/products"
                  className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Browse Products
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Order Header */}
                  <div className="p-4 sm:p-6 border-b border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Order #{order.orderNumber || order.id.slice(0, 8)}
                          </h3>
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
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
                        <p className="text-sm text-gray-500">
                          {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Items Preview */}
                  <div className="p-4 sm:p-6 bg-gray-50">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2">
                      {order.items?.slice(0, 4).map((item, index) => {
                        const imageUrl = getProductImage(item);
                        return (
                          <div key={item.id || index} className="flex-shrink-0">
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={item.product?.name || 'Product'}
                                className="w-16 h-16 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                                <span className="text-gray-400 text-xs">No img</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {order.items && order.items.length > 4 && (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-600 text-sm font-medium">+{order.items.length - 4}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Actions */}
                  <div className="p-4 sm:p-6 flex flex-wrap gap-3">
                    <button
                      onClick={() => openOrderDetails(order)}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                    >
                      View Details
                    </button>
                    {order.trackingNumber && (
                      <Link
                        href={`/track-order?orderNumber=${order.orderNumber || order.id}`}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                      >
                        Track Order
                      </Link>
                    )}
                    {['DELIVERED', 'COMPLETED'].includes(order.status) && (
                      <Link
                        href="/returns"
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
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
            <div className="text-sm text-gray-500 text-center mt-6">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          )}
        </main>
        <Footer />

        {/* Order Details Modal */}
        {showDetailsModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b sticky top-0 bg-white">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Order #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
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
                  <span className="text-sm text-gray-500">Status:</span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                </div>

                {/* Tracking Info */}
                {selectedOrder.trackingNumber && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Tracking Information</h3>
                    <p className="text-sm text-gray-700">
                      Tracking Number: <span className="font-mono">{selectedOrder.trackingNumber}</span>
                    </p>
                    {selectedOrder.estimatedDelivery && (
                      <p className="text-sm text-gray-700 mt-1">
                        Estimated Delivery: {new Date(selectedOrder.estimatedDelivery).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Shipping Address */}
                {selectedOrder.shippingAddress && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Shipping Address</h3>
                    <p className="text-sm text-gray-700">
                      {selectedOrder.shippingAddress.street}<br />
                      {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} {selectedOrder.shippingAddress.postalCode}<br />
                      {selectedOrder.shippingAddress.country}
                    </p>
                  </div>
                )}

                {/* Order Items */}
                <div>
                  <h3 className="font-medium text-gray-900 mb-3">Order Items</h3>
                  <div className="border rounded-lg divide-y">
                    {selectedOrder.items?.map((item, index) => {
                      const imageUrl = getProductImage(item);
                      return (
                        <div key={item.id || index} className="p-4 flex items-center gap-4">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={item.product?.name || 'Product'}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-400 text-xs">No img</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <Link
                              href={`/products/${item.productId}`}
                              className="font-medium text-gray-900 hover:text-purple-600"
                            >
                              {item.product?.name || 'Product'}
                            </Link>
                            <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          </div>
                          <p className="font-medium text-gray-900">
                            {formatPrice(item.price * item.quantity, selectedOrder.currency || 'GBP')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.subtotal && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-gray-900">{formatPrice(selectedOrder.subtotal, selectedOrder.currency || 'GBP')}</span>
                      </div>
                    )}
                    {selectedOrder.shippingCost !== undefined && selectedOrder.shippingCost > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Shipping</span>
                        <span className="text-gray-900">{formatPrice(selectedOrder.shippingCost, selectedOrder.currency || 'GBP')}</span>
                      </div>
                    )}
                    {selectedOrder.discount !== undefined && selectedOrder.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-{formatPrice(selectedOrder.discount, selectedOrder.currency || 'GBP')}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-base pt-2 border-t">
                      <span className="text-gray-900">Total</span>
                      <span className="text-purple-600">{formatPrice(selectedOrder.total, selectedOrder.currency || 'GBP')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex gap-3">
                {['DELIVERED', 'COMPLETED'].includes(selectedOrder.status) && (
                  <Link
                    href="/returns"
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-center font-medium"
                  >
                    Request Return
                  </Link>
                )}
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
