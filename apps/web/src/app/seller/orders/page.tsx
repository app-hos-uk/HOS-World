'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';
import Image from 'next/image';

interface OrderItem {
  id: string;
  productId: string;
  productName?: string;
  quantity: number;
  price: number;
  product?: {
    name: string;
    images?: string[];
  };
}

interface Order {
  id: string;
  orderNumber?: string;
  status: string;
  total: number;
  subtotal?: number;
  shippingCost?: number;
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

  const menuItems = [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
  ];

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
            orderData = orderData.filter((o: Order) => ['CONFIRMED', 'PROCESSING'].includes(o.status));
          } else if (filterValue === 'DELIVERED') {
            orderData = orderData.filter((o: Order) => ['DELIVERED', 'COMPLETED'].includes(o.status));
          } else if (filterValue === 'CANCELLED') {
            orderData = orderData.filter((o: Order) => ['CANCELLED', 'REFUNDED'].includes(o.status));
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

  // Calculate stats from all orders
  const stats = useMemo(() => {
    return {
      total: allOrders.length,
      pending: allOrders.filter(o => o.status === 'PENDING').length,
      processing: allOrders.filter(o => ['CONFIRMED', 'PROCESSING'].includes(o.status)).length,
      shipped: allOrders.filter(o => o.status === 'SHIPPED').length,
      delivered: allOrders.filter(o => ['DELIVERED', 'COMPLETED'].includes(o.status)).length,
      cancelled: allOrders.filter(o => ['CANCELLED', 'REFUNDED'].includes(o.status)).length,
      totalRevenue: allOrders
        .filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status))
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
    setTrackingNumber(order.trackingNumber || '');
    setShowDetailsModal(true);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedOrder) return;
    
    try {
      setUpdatingStatus(true);
      await apiClient.updateOrderStatus(selectedOrder.id, newStatus);
      toast.success(`Order status updated to ${newStatus}`);
      setSelectedOrder({ ...selectedOrder, status: newStatus });
      fetchOrders(statusFilter);
      fetchAllOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

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

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Orders</h1>
              <p className="text-gray-600 mt-1">Manage your customer orders</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <button
              onClick={() => setStatusFilter('')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === '' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Total</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'PENDING' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Pending</h3>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter('PROCESSING')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'PROCESSING' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Processing</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.processing}</p>
            </button>
            <button
              onClick={() => setStatusFilter('SHIPPED')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'SHIPPED' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Shipped</h3>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.shipped}</p>
            </button>
            <button
              onClick={() => setStatusFilter('DELIVERED')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'DELIVERED' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Delivered</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.delivered}</p>
            </button>
            <button
              onClick={() => setStatusFilter('CANCELLED')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'CANCELLED' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Cancelled</h3>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.cancelled}</p>
            </button>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Revenue</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">£{stats.totalRevenue.toFixed(2)}</p>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-lg shadow p-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order ID, customer name, or email..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No orders found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            #{order.orderNumber || order.id.slice(0, 8)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {order.user?.firstName} {order.user?.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.user?.email || order.customer?.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            £{Number(order.total || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => openOrderDetails(order)}
                              className="text-purple-600 hover:text-purple-900 font-medium text-sm"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        {showDetailsModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
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
                {/* Status and Actions */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500">Current Status:</span>
                    <span className={`ml-2 px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {selectedOrder.status === 'PENDING' && (
                      <button
                        onClick={() => handleStatusUpdate('PROCESSING')}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                      >
                        Accept Order
                      </button>
                    )}
                    {selectedOrder.status === 'PROCESSING' && (
                      <button
                        onClick={() => handleStatusUpdate('SHIPPED')}
                        disabled={updatingStatus}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm"
                      >
                        Mark as Shipped
                      </button>
                    )}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Name:</span>
                      <span className="ml-2 text-gray-900">
                        {selectedOrder.user?.firstName} {selectedOrder.user?.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 text-gray-900">
                        {selectedOrder.user?.email || selectedOrder.customer?.email}
                      </span>
                    </div>
                  </div>
                </div>

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
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, index) => (
                        <div key={item.id || index} className="p-4 flex items-center gap-4">
                          {item.product?.images?.[0] && (
                            <Image
                              src={item.product.images[0]}
                              alt={item.product?.name || item.productName || 'Product'}
                              width={64}
                              height={64}
                              className="object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {item.product?.name || item.productName || 'Product'}
                            </p>
                            <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          </div>
                          <p className="font-medium text-gray-900">
                            £{Number(item.price || 0).toFixed(2)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">
                        No item details available
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.subtotal && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="text-gray-900">£{Number(selectedOrder.subtotal).toFixed(2)}</span>
                      </div>
                    )}
                    {selectedOrder.shippingCost !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Shipping</span>
                        <span className="text-gray-900">£{Number(selectedOrder.shippingCost).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium text-base pt-2 border-t">
                      <span className="text-gray-900">Total</span>
                      <span className="text-gray-900">£{Number(selectedOrder.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Tracking Number */}
                {(selectedOrder.status === 'SHIPPED' || selectedOrder.trackingNumber) && (
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">Tracking Information</h3>
                    <p className="text-sm text-gray-700">
                      Tracking Number: {selectedOrder.trackingNumber || 'Not provided'}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t bg-gray-50">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}
