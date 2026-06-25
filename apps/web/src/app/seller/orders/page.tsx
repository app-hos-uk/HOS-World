'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import Image from 'next/image';
import { StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PortalMobileCard } from '@/components/ui/PortalMobileCard';
import { useCurrency } from '@/contexts/CurrencyContext';

interface OrderItem {
  id: string;
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
  product?: {
    name: string;
    images?: Array<string | { url?: string }>;
  };
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
  shippingAmount?: number;
  trackingCode?: string;
  createdAt: string;
  updatedAt?: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  customer?: {
    name?: string;
    email?: string;
  };
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items?: OrderItem[];
  trackingNumber?: string;
}

export default function SellerOrdersPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deepLinkId, setDeepLinkId] = useState<string | null>(null);

  const menuItems = getSellerMenuItems(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setDeepLinkId(params.get('id'));
    }
  }, []);

  const fetchAllOrders = useCallback(async () => {
    try {
      const response = await apiClient.getSellerOrders();
      if (response?.data) {
        setAllOrders(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching all orders:', err);
    }
  }, []);

  // Pass filterValue as parameter to avoid stale closure issues
  const fetchOrders = useCallback(async (filterValue: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // For multi-status filters (PROCESSING includes CONFIRMED+PROCESSING, 
      // DELIVERED includes DELIVERED+COMPLETED, CANCELLED includes CANCELLED+REFUNDED),
      // we need to fetch all and filter client-side to match stats
      const isMultiStatusFilter = ['PROCESSING', 'DELIVERED', 'CANCELLED'].includes(filterValue);
      
      if (isMultiStatusFilter) {
        // Fetch all orders and filter client-side
        const response = await apiClient.getSellerOrders();
        if (response?.data) {
          let orderData = Array.isArray(response.data) ? response.data : [];
          
          // Apply client-side filtering to match stats aggregation
          if (filterValue === 'PROCESSING') {
            orderData = orderData.filter((o: Order) =>
              ['confirmed', 'processing', 'fulfilled'].includes(o.status),
            );
          } else if (filterValue === 'DELIVERED') {
            orderData = orderData.filter((o: Order) => o.status === 'delivered');
          } else if (filterValue === 'CANCELLED') {
            orderData = orderData.filter((o: Order) => ['cancelled', 'refunded'].includes(o.status));
          }
          
          setOrders(orderData);
        }
      } else {
        // For single status filters (PENDING, SHIPPED) or no filter, use API directly
        const response = await apiClient.getSellerOrders(filterValue || undefined);
        if (response?.data) {
          setOrders(Array.isArray(response.data) ? response.data : []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all orders once on mount for stats calculation
  useEffect(() => {
    fetchAllOrders();
  }, [fetchAllOrders]);

  // Fetch filtered orders when statusFilter changes
  useEffect(() => {
    fetchOrders(statusFilter);
  }, [statusFilter, fetchOrders]);

  // Auto-open order details when deep-linked via ?id= param
  useEffect(() => {
    if (deepLinkId && allOrders.length > 0 && !selectedOrder) {
      const target = allOrders.find(o => o.id === deepLinkId);
      if (target) {
        setSelectedOrder(target);
        setTrackingNumber(target.trackingNumber || target.trackingCode || '');
        setShowDetailsModal(true);
        setDeepLinkId(null);
      }
    }
  }, [deepLinkId, allOrders, selectedOrder]);

  // Calculate stats from all orders
  const stats = useMemo(() => {
    return {
      total: allOrders.length,
      pending: allOrders.filter(o => ['pending', 'accepted'].includes(o.status)).length,
      processing: allOrders.filter(o => ['confirmed', 'processing', 'fulfilled'].includes(o.status)).length,
      shipped: allOrders.filter(o => o.status === 'shipped').length,
      delivered: allOrders.filter(o => o.status === 'delivered').length,
      cancelled: allOrders.filter(o => ['cancelled', 'refunded'].includes(o.status)).length,
      totalRevenue: allOrders
        .filter(o => !['cancelled', 'refunded'].includes(o.status) && (o as any).paymentStatus === 'paid')
        .reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    };
  }, [allOrders]);

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const search = searchTerm.toLowerCase();
    return orders.filter(order => 
      order.id.toLowerCase().includes(search) ||
      order.orderNumber?.toLowerCase().includes(search) ||
      order.user?.email?.toLowerCase().includes(search) ||
      order.user?.firstName?.toLowerCase().includes(search) ||
      order.user?.lastName?.toLowerCase().includes(search) ||
      order.customer?.email?.toLowerCase().includes(search) ||
      order.customer?.name?.toLowerCase().includes(search)
    );
  }, [orders, searchTerm]);

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setTrackingNumber(order.trackingNumber || order.trackingCode || '');
    setShowDetailsModal(true);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedOrder) return;
    
    try {
      setUpdatingStatus(true);
      await apiClient.updateOrderStatus(selectedOrder.id, newStatus, trackingNumber || undefined);
      toast.success(`Order status updated to ${newStatus}`);
      setSelectedOrder({ ...selectedOrder, status: newStatus.toLowerCase(), trackingNumber: trackingNumber || selectedOrder.trackingNumber });
      fetchOrders(statusFilter);
      fetchAllOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    if (!window.confirm('Are you sure you want to cancel this order? This action cannot be undone.')) return;
    
    try {
      setUpdatingStatus(true);
      await apiClient.cancelOrder(selectedOrder.id);
      toast.success('Order cancelled');
      setSelectedOrder({ ...selectedOrder, status: 'cancelled' });
      fetchOrders(statusFilter);
      fetchAllOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/15 text-yellow-300';
      case 'accepted':
      case 'confirmed':
      case 'processing': return 'bg-hos-gold/20 text-hos-gold';
      case 'fulfilled':
      case 'shipped': return 'bg-hos-gold/20 text-hos-gold';
      case 'delivered': return 'bg-green-500/15 text-green-300';
      case 'cancelled':
      case 'refunded': return 'bg-red-500/15 text-red-300';
      default: return 'bg-hos-bg-tertiary text-hos-text-secondary';
    }
  };

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller" backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">Orders</h1>
              <p className="text-hos-text-secondary mt-1">Manage your customer orders</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <button
              onClick={() => setStatusFilter('')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === '' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Total</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">{stats.total}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'PENDING' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Pending</h3>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PROCESSING')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'PROCESSING' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Processing</h3>
              <p className="text-2xl font-bold text-hos-gold mt-1">{stats.processing}</p>
            </button>
            <button
              onClick={() => setStatusFilter('SHIPPED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'SHIPPED' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Shipped</h3>
              <p className="text-2xl font-bold text-hos-gold mt-1">{stats.shipped}</p>
            </button>
            <button
              onClick={() => setStatusFilter('DELIVERED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'DELIVERED' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Delivered</h3>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.delivered}</p>
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'CANCELLED' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Cancelled</h3>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.cancelled}</p>
            </button>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-hos-text-muted uppercase">Revenue</h3>
              <p className="text-2xl font-bold text-green-400 mt-1">${stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          {/* Search */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order ID, customer name, or email..."
              className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
            />
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded">
              Error: {error}
              <button
                onClick={() => fetchOrders(statusFilter)}
                className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {/* Orders Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          ) : (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-hos-text-muted mb-4">No orders found</p>
                  <Link href="/seller/products" className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium">
                    View your products →
                  </Link>
                </div>
              ) : (
                <>
                <div className="md:hidden space-y-3 p-4">
                  {filteredOrders.map((order) => (
                    <PortalMobileCard
                      key={order.id}
                      title={`Order #${order.orderNumber || order.id.slice(0, 8)}`}
                      subtitle={order.user?.email || order.customer?.email}
                      rows={[
                        {
                          label: 'Customer',
                          value: `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || '—',
                        },
                        { label: 'Total', value: formatPrice(Number(order.total || 0)) },
                        { label: 'Status', value: <StatusBadge status={order.status} /> },
                        { label: 'Date', value: new Date(order.createdAt).toLocaleDateString() },
                      ]}
                      actions={
                        <button
                          type="button"
                          onClick={() => openOrderDetails(order)}
                          className="text-hos-gold hover:text-hos-gold-hover text-sm font-medium"
                        >
                          View Details
                        </button>
                      }
                    />
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-hos-bg-tertiary">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hos-text-secondary">
                            #{order.orderNumber || order.id.slice(0, 8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-hos-text-secondary">
                              {order.user?.firstName} {order.user?.lastName}
                            </div>
                            <div className="text-sm text-hos-text-muted">
                              {order.user?.email || order.customer?.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hos-text-secondary">
                            {formatPrice(Number(order.total || 0))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => openOrderDetails(order)}
                              className="text-hos-gold hover:text-hos-gold font-medium text-sm"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          )}
        </div>

        <Modal
          open={showDetailsModal && !!selectedOrder}
          onClose={() => setShowDetailsModal(false)}
          titleId="seller-order-modal-title"
        >
          {selectedOrder && (
            <>
              <div className="p-6 border-b border-hos-border">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 id="seller-order-modal-title" className="text-xl font-bold text-hos-text-secondary">
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
                {/* Status and Actions */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-hos-text-muted">Current Status:</span>
                    <span className={`ml-2 px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedOrder.status === 'pending' && (
                      <button
                        onClick={() => handleStatusUpdate('CONFIRMED')}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm"
                      >
                        Accept Order
                      </button>
                    )}
                    {selectedOrder.status === 'accepted' && (
                      <button
                        onClick={() => handleStatusUpdate('CONFIRMED')}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm"
                      >
                        Confirm Order
                      </button>
                    )}
                    {selectedOrder.status === 'confirmed' && (
                      <button
                        onClick={() => handleStatusUpdate('PROCESSING')}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm"
                      >
                        Start Processing
                      </button>
                    )}
                    {selectedOrder.status === 'processing' && (
                      <button
                        onClick={() => handleStatusUpdate('FULFILLED')}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm"
                      >
                        Mark as Fulfilled
                      </button>
                    )}
                    {selectedOrder.status === 'fulfilled' && (
                      <button
                        onClick={() => handleStatusUpdate('SHIPPED')}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm"
                      >
                        Mark as Shipped
                      </button>
                    )}
                    {selectedOrder.status === 'shipped' && (
                      <button
                        onClick={() => handleStatusUpdate('DELIVERED')}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                      >
                        Mark as Delivered
                      </button>
                    )}
                    {['pending', 'accepted', 'confirmed', 'processing'].includes(selectedOrder.status) && (
                      <button
                        onClick={handleCancelOrder}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-hos-bg-secondary rounded-lg p-4">
                  <h3 className="font-medium text-hos-text-secondary mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-hos-text-muted">Name:</span>
                      <span className="ml-2 text-hos-text-secondary">
                        {selectedOrder.user?.firstName} {selectedOrder.user?.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="text-hos-text-muted">Email:</span>
                      <span className="ml-2 text-hos-text-secondary">
                        {selectedOrder.user?.email || selectedOrder.customer?.email}
                      </span>
                    </div>
                  </div>
                </div>

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
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, index) => (
                        <div key={item.id || index} className="p-4 flex items-center gap-4">
                          {item.product?.images?.[0] && (
                            <Image
                              src={
                                typeof item.product.images[0] === 'string'
                                  ? item.product.images[0]
                                  : item.product.images[0]?.url || ''
                              }
                              alt={item.product?.name || item.productName || 'Product'}
                              width={64}
                              height={64}
                              className="object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-hos-text-secondary">
                              {item.product?.name || item.productName || 'Product'}
                            </p>
                            <p className="text-sm text-hos-text-muted">Qty: {item.quantity}</p>
                          </div>
                          <p className="font-medium text-hos-text-secondary">
                            ${Number(item.price || 0).toFixed(2)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-hos-text-muted">
                        No item details available
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-hos-bg-secondary rounded-lg p-4">
                  <h3 className="font-medium text-hos-text-secondary mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.subtotal && (
                      <div className="flex justify-between">
                        <span className="text-hos-text-muted">Subtotal</span>
                        <span className="text-hos-text-secondary">${Number(selectedOrder.subtotal).toFixed(2)}</span>
                      </div>
                    )}
                    {(selectedOrder.shippingCost || selectedOrder.shippingAmount) ? (
                      <div className="flex justify-between">
                        <span className="text-hos-text-muted">Shipping</span>
                        <span className="text-hos-text-secondary">${Number(selectedOrder.shippingCost || selectedOrder.shippingAmount || 0).toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-medium text-base pt-2 border-t">
                      <span className="text-hos-text-secondary">Total</span>
                      <span className="text-hos-text-secondary">${Number(selectedOrder.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Tracking Number */}
                {(['processing', 'fulfilled', 'shipped', 'delivered', 'confirmed'].includes(selectedOrder.status) || selectedOrder.trackingNumber || selectedOrder.trackingCode) && (
                  <div className="bg-hos-gold/10 rounded-lg p-4">
                    <h3 className="font-medium text-hos-text-secondary mb-2">Tracking Information</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Enter tracking number"
                        className="flex-1 px-3 py-2 border border-hos-border rounded-lg text-sm bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold focus:outline-none"
                      />
                      <button
                        onClick={async () => {
                          if (!trackingNumber.trim()) {
                            toast.error('Please enter a tracking number');
                            return;
                          }
                          try {
                            setUpdatingStatus(true);
                            await apiClient.updateOrderStatus(selectedOrder.id, selectedOrder.status, trackingNumber);
                            setSelectedOrder({ ...selectedOrder, trackingNumber });
                            toast.success('Tracking number saved');
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to save tracking number');
                          } finally {
                            setUpdatingStatus(false);
                          }
                        }}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t bg-hos-bg-secondary">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </Modal>
      </DashboardLayout>
    </RouteGuard>
  );
}
