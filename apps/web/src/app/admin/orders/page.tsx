'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';

interface Order {
  id: string;
  orderNumber?: string;
  user?: { email: string; firstName?: string; lastName?: string };
  customer?: { email: string };
  total: number;
  subtotal?: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  currency?: string;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  shippingAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items?: Array<{
    id: string;
    productId: string;
    product?: { name: string; sku?: string };
    quantity: number;
    price: number;
  }>;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-indigo-100 text-indigo-800',
  SHIPPED: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-gray-100 text-gray-800',
};

export default function AdminOrdersPage() {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  // Track which specific order is being updated (null = none)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    completed: 0,
    cancelled: 0,
    totalRevenue: 0,
  });

  useEffect(() => {
    fetchOrders();
    
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchOrders();
    };
    const interval = setInterval(fetchOrders, 60000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getOrders();
      const orderList = Array.isArray(response?.data) ? response.data : [];
      setOrders(orderList);

      // Calculate stats
      const pendingCount = orderList.filter((o: Order) => o.status === 'PENDING').length;
      const processingCount = orderList.filter((o: Order) => ['CONFIRMED', 'PROCESSING'].includes(o.status)).length;
      const shippedCount = orderList.filter((o: Order) => o.status === 'SHIPPED').length;
      const completedCount = orderList.filter((o: Order) => ['DELIVERED', 'COMPLETED'].includes(o.status)).length;
      const cancelledCount = orderList.filter((o: Order) => ['CANCELLED', 'REFUNDED'].includes(o.status)).length;
      const totalRevenue = orderList
        .filter((o: Order) => !['CANCELLED', 'REFUNDED'].includes(o.status))
        .reduce((sum: number, o: Order) => sum + (Number(o.total) || 0), 0);

      setStats({
        total: orderList.length,
        pending: pendingCount,
        processing: processingCount,
        shipped: shippedCount,
        completed: completedCount,
        cancelled: cancelledCount,
        totalRevenue,
      });
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrderId(orderId);
      await apiClient.updateOrderStatus(orderId, newStatus);
      toast.success(`Order status updated to ${newStatus}`);
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      order.id.toLowerCase().includes(searchLower) ||
      order.orderNumber?.toLowerCase().includes(searchLower) ||
      order.user?.email?.toLowerCase().includes(searchLower) ||
      order.customer?.email?.toLowerCase().includes(searchLower);

    // Status filter - handle multi-status filters to match stats card counts
    let matchesStatus = statusFilter === 'ALL';
    if (!matchesStatus) {
      if (statusFilter === 'PROCESSING') {
        // Match both CONFIRMED and PROCESSING to align with stats card
        matchesStatus = ['CONFIRMED', 'PROCESSING'].includes(order.status);
      } else if (statusFilter === 'COMPLETED') {
        // Match both DELIVERED and COMPLETED to align with stats card
        matchesStatus = ['DELIVERED', 'COMPLETED'].includes(order.status);
      } else if (statusFilter === 'CANCELLED') {
        // Match both CANCELLED and REFUNDED to align with stats card
        matchesStatus = ['CANCELLED', 'REFUNDED'].includes(order.status);
      } else {
        matchesStatus = order.status === statusFilter;
      }
    }

    // Date range filter
    let matchesDate = true;
    if (dateRange.start) {
      matchesDate = matchesDate && new Date(order.createdAt) >= new Date(dateRange.start);
    }
    if (dateRange.end) {
      matchesDate = matchesDate && new Date(order.createdAt) <= new Date(dateRange.end + 'T23:59:59');
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const exportColumns = [
    { key: 'orderNumber', header: 'Order #', format: (v: string, o: Order) => o.orderNumber || o.id.slice(0, 8) },
    { key: 'user', header: 'Customer', format: (v: any, o: Order) => o.user?.email || o.customer?.email || 'N/A' },
    { key: 'total', header: 'Total', format: (v: number, o: Order) => `${o.currency || 'GBP'} ${Number(v || 0).toFixed(2)}` },
    { key: 'status', header: 'Status' },
    { key: 'paymentStatus', header: 'Payment Status' },
    { key: 'createdAt', header: 'Date', format: (v: string) => new Date(v).toLocaleDateString() },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
              <p className="text-gray-600 mt-1">View and manage all customer orders</p>
            </div>
            <DataExport
              data={filteredOrders}
              columns={exportColumns}
              filename="orders-export"
            />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Total Orders</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Revenue</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">£{stats.totalRevenue.toFixed(2)}</p>
            </div>
            <button
              onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'PENDING' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Pending</h3>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'PROCESSING' ? 'ALL' : 'PROCESSING')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'PROCESSING' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Processing</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.processing}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'SHIPPED' ? 'ALL' : 'SHIPPED')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'SHIPPED' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Shipped</h3>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.shipped}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'COMPLETED' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Completed</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</p>
            </button>
            <button
              onClick={() => setStatusFilter(statusFilter === 'CANCELLED' ? 'ALL' : 'CANCELLED')}
              className={`bg-white rounded-lg shadow p-4 text-left ${statusFilter === 'CANCELLED' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Cancelled</h3>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.cancelled}</p>
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Order ID, customer email..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Statuses</option>
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            {(searchTerm || statusFilter !== 'ALL' || dateRange.start || dateRange.end) && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  Showing {filteredOrders.length} of {orders.length} orders
                </span>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                    setDateRange({ start: '', end: '' });
                  }}
                  className="text-sm text-purple-600 hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button
                onClick={fetchOrders}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          <span className="text-4xl block mb-2">📦</span>
                          <p>No orders found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              #{order.orderNumber || order.id.substring(0, 8)}
                            </div>
                            <div className="text-xs text-gray-500">{order.id.substring(0, 12)}...</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {order.user?.firstName || ''} {order.user?.lastName || ''}
                            </div>
                            <div className="text-xs text-gray-500">
                              {order.user?.email || order.customer?.email || 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {order.currency || 'GBP'} {Number(order.total || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                              disabled={updatingOrderId === order.id}
                              className={`text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer ${
                                STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'
                              } ${updatingOrderId === order.id ? 'opacity-50' : ''}`}
                            >
                              {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => openOrderDetails(order)}
                              className="text-purple-600 hover:text-purple-900"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Order Details Modal */}
          {showDetailsModal && selectedOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-lg max-w-3xl w-full my-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Order #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Customer Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Customer Information</h3>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="text-gray-500">Name:</span>{' '}
                          {selectedOrder.user?.firstName || ''} {selectedOrder.user?.lastName || 'N/A'}
                        </p>
                        <p>
                          <span className="text-gray-500">Email:</span>{' '}
                          {selectedOrder.user?.email || selectedOrder.customer?.email || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Shipping Address</h3>
                      {selectedOrder.shippingAddress ? (
                        <div className="text-sm space-y-1">
                          <p>{selectedOrder.shippingAddress.street}</p>
                          <p>
                            {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state}{' '}
                            {selectedOrder.shippingAddress.postalCode}
                          </p>
                          <p>{selectedOrder.shippingAddress.country}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No shipping address available</p>
                      )}
                    </div>
                  </div>

                  {/* Order Status */}
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Order Status</h3>
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-sm text-gray-500 mr-2">Status:</span>
                        <select
                          value={selectedOrder.status}
                          onChange={(e) => handleStatusUpdate(selectedOrder.id, e.target.value)}
                          disabled={updatingOrderId === selectedOrder.id}
                          className={`text-sm font-semibold rounded-full px-3 py-1 border-0 ${
                            STATUS_COLORS[selectedOrder.status] || 'bg-gray-100 text-gray-800'
                          } ${updatingOrderId === selectedOrder.id ? 'opacity-50' : ''}`}
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                      {selectedOrder.paymentStatus && (
                        <div>
                          <span className="text-sm text-gray-500 mr-2">Payment:</span>
                          <span className="text-sm font-medium">{selectedOrder.paymentStatus}</span>
                        </div>
                      )}
                      {selectedOrder.paymentMethod && (
                        <div>
                          <span className="text-sm text-gray-500 mr-2">Method:</span>
                          <span className="text-sm font-medium">{selectedOrder.paymentMethod}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Qty</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Price</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {selectedOrder.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-3 text-sm">
                                  <div className="font-medium">{item.product?.name || 'Unknown Product'}</div>
                                  {item.product?.sku && (
                                    <div className="text-xs text-gray-500">SKU: {item.product.sku}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">{item.quantity}</td>
                                <td className="px-4 py-3 text-sm text-right">£{Number(item.price).toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right font-medium">
                                  £{(Number(item.price) * item.quantity).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No items data available</p>
                    )}
                  </div>

                  {/* Order Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                    <div className="space-y-2 text-sm">
                      {selectedOrder.subtotal !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Subtotal:</span>
                          <span>£{Number(selectedOrder.subtotal).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.shipping !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Shipping:</span>
                          <span>£{Number(selectedOrder.shipping).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.tax !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Tax:</span>
                          <span>£{Number(selectedOrder.tax).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.discount !== undefined && selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount:</span>
                          <span>-£{Number(selectedOrder.discount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total:</span>
                        <span>{selectedOrder.currency || 'GBP'} {Number(selectedOrder.total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
