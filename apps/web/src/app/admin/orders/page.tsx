'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';
import { Modal } from '@/components/ui/Modal';
import { PortalMobileCard } from '@/components/ui/PortalMobileCard';
import { formatAdminPrice } from '@/lib/adminFormat';
import {
  AdminColumnToggle,
  useAdminColumnVisibility,
  type AdminColumnDef,
} from '@/components/ui/AdminColumnToggle';

/** API returns lowercase; normalize so stats/filters work if casing differs */
function normalizeOrderStatus(status: string | undefined): string {
  return String(status ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Handles both `{ data: Order[] }` and legacy/nested `{ data: { data: Order[] } }`.
 */
function extractOrdersFromApiResponse(res: unknown): {
  orders: Order[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
} {
  const r = res as {
    data?: unknown;
    pagination?: { page: number; limit: number; total: number; totalPages: number };
  };
  const raw = r?.data;
  let orders: Order[] = [];
  if (Array.isArray(raw)) {
    orders = raw as Order[];
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    orders = (raw as { data: Order[] }).data;
  }
  return { orders, pagination: r?.pagination };
}

interface Order {
  id: string;
  orderNumber?: string;
  parentOrderId?: string | null;
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

// Must match API: orders.service mapToOrderType returns Prisma OrderStatus in lowercase
const ORDER_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'confirmed',
  'processing',
  'fulfilled',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300',
  accepted: 'bg-cyan-500/15 text-cyan-300',
  rejected: 'bg-orange-500/15 text-orange-300',
  confirmed: 'bg-hos-gold/20 text-hos-gold',
  processing: 'bg-hos-gold/20 text-hos-gold',
  fulfilled: 'bg-violet-500/15 text-violet-300',
  shipped: 'bg-cyan-500/15 text-cyan-300',
  delivered: 'bg-green-500/15 text-green-300',
  cancelled: 'bg-red-500/15 text-red-300',
  refunded: 'bg-hos-bg-tertiary text-hos-text-secondary',
};

const ORDER_TABLE_COLUMNS: AdminColumnDef[] = [
  { id: 'order', label: 'Order' },
  { id: 'customer', label: 'Customer' },
  { id: 'total', label: 'Total' },
  { id: 'status', label: 'Status' },
  { id: 'date', label: 'Date' },
  { id: 'actions', label: 'Actions' },
];

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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const [confirmDialog, setConfirmDialog] = useState<{ orderId: string; orderNumber: string; currentStatus: string; newStatus: string } | null>(null);
  const {
    visibleIds: orderVisibleColumnIds,
    isVisible: isOrderColumnVisible,
    toggleColumn: toggleOrderColumn,
    resetColumns: resetOrderColumns,
  } = useAdminColumnVisibility('admin-orders', ORDER_TABLE_COLUMNS);

  // Stats (counts may use pagination.total for "Total orders"; per-status from loaded rows)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
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
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // Backend caps at 100 per page; merge all pages so overview stats match the full dataset
      let page = 1;
      let totalPages = 1;
      const orderList: Order[] = [];
      let reportedTotal: number | undefined;

      do {
        const response = await apiClient.getOrders({ page, limit: 100 });
        const { orders, pagination } = extractOrdersFromApiResponse(response);
        orderList.push(...orders);
        reportedTotal = pagination?.total;
        totalPages = Math.max(1, pagination?.totalPages ?? 1);
        page += 1;
        if (page > 200) break;
      } while (page <= totalPages);

      setOrders(orderList);

      // Checkout-level orders only (exclude multi-vendor child rows) — matches admin dashboard & revenue math
      const checkoutOrders = orderList.filter((o) => !o.parentOrderId);

      const st = (o: Order) => normalizeOrderStatus(o.status);

      const pendingCount = checkoutOrders.filter((o) => st(o) === 'pending').length;
      const confirmedCount = checkoutOrders.filter((o) => st(o) === 'confirmed').length;
      const processingCount = checkoutOrders.filter((o) => st(o) === 'processing').length;
      const shippedCount = checkoutOrders.filter((o) => st(o) === 'shipped').length;
      const completedCount = checkoutOrders.filter((o) => st(o) === 'delivered').length;
      const cancelledCount = checkoutOrders.filter((o) =>
        ['cancelled', 'refunded'].includes(st(o)) ||
        String(o.paymentStatus || '').toLowerCase() === 'refunded',
      ).length;
      const totalRevenue = checkoutOrders
        .filter(
          (o) =>
            !['cancelled', 'refunded'].includes(st(o)) &&
            String(o.paymentStatus || '').toLowerCase() !== 'refunded',
        )
        .reduce((sum: number, o: Order) => sum + (Number(o.total) || 0), 0);

      setStats({
        total: reportedTotal ?? orderList.length,
        pending: pendingCount,
        confirmed: confirmedCount,
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dateRange.start, dateRange.end]);

  const handleStatusChange = (orderId: string, newStatus: string, orderNumber?: string, currentStatus?: string) => {
    if (newStatus === currentStatus) return;
    setConfirmDialog({ orderId, orderNumber: orderNumber || orderId.substring(0, 8), currentStatus: currentStatus || '', newStatus });
  };

  const confirmStatusUpdate = async () => {
    if (!confirmDialog) return;
    const { orderId, newStatus } = confirmDialog;
    setConfirmDialog(null);
    await handleStatusUpdate(orderId, newStatus);
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

    const os = normalizeOrderStatus(order.status);

    // Status filter - handle multi-status filters to match stats card counts
    let matchesStatus = statusFilter === 'ALL';
    if (!matchesStatus) {
      if (statusFilter === 'PROCESSING') {
        matchesStatus = ['confirmed', 'processing'].includes(os);
      } else if (statusFilter === 'COMPLETED') {
        matchesStatus = os === 'delivered';
      } else if (statusFilter === 'CANCELLED') {
        matchesStatus = ['cancelled', 'refunded'].includes(os);
      } else {
        matchesStatus = os === normalizeOrderStatus(statusFilter);
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

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportColumns = [
    { key: 'orderNumber', header: 'Order #', format: (v: string, o: Order) => o.orderNumber || o.id.slice(0, 8) },
    { key: 'user', header: 'Customer', format: (v: any, o: Order) => o.user?.email || o.customer?.email || 'N/A' },
    { key: 'total', header: 'Total', format: (v: number, o: Order) => formatAdminPrice(v || 0, o.currency || 'USD') },
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
              <h1 className="text-2xl font-bold text-hos-text-secondary">Orders Management</h1>
              <p className="text-hos-text-secondary mt-1">View and manage all customer orders</p>
            </div>
            <DataExport
              data={filteredOrders}
              columns={exportColumns}
              filename="orders-export"
            />
          </div>

          {/* Stats Cards — counts use normalized status; Confirmed / Processing are separate */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-4">
            <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
              <h3 className="admin-metric-label">Total Orders</h3>
              <p className="text-2xl font-bold text-hos-text-secondary mt-1">{stats.total}</p>
            </div>
            <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
              <h3 className="admin-metric-label">Revenue</h3>
              <p className="text-2xl font-bold text-hos-gold mt-1">${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'ALL' : 'pending')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'pending' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="admin-metric-label">Pending</h3>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'confirmed' ? 'ALL' : 'confirmed')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'confirmed' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="admin-metric-label">Confirmed</h3>
              <p className="text-2xl font-bold text-sky-400 mt-1">{stats.confirmed}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'PROCESSING' ? 'ALL' : 'PROCESSING')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'PROCESSING' ? 'ring-2 ring-hos-gold/50' : ''}`}
              title="Confirmed + actively processing"
            >
              <h3 className="admin-metric-label">In progress</h3>
              <p className="text-2xl font-bold text-hos-gold mt-1">{stats.confirmed + stats.processing}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'shipped' ? 'ALL' : 'shipped')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'shipped' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="admin-metric-label">Shipped</h3>
              <p className="text-2xl font-bold text-cyan-400 mt-1">{stats.shipped}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'COMPLETED' ? 'ALL' : 'COMPLETED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'COMPLETED' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="admin-metric-label">Completed</h3>
              <p className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</p>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'CANCELLED' ? 'ALL' : 'CANCELLED')}
              className={`bg-hos-bg-secondary rounded-lg shadow p-4 text-left ${statusFilter === 'CANCELLED' ? 'ring-2 ring-hos-gold/50' : ''}`}
            >
              <h3 className="admin-metric-label">Cancelled</h3>
              <p className="text-2xl font-bold text-red-400 mt-1">{stats.cancelled}</p>
            </button>
          </div>

          {/* Filters */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Order ID, customer email..."
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="select w-full"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PROCESSING">In progress (confirmed + processing)</option>
                  <option value="COMPLETED">Completed (delivered)</option>
                  <option value="CANCELLED">Cancelled (cancelled + refunded)</option>
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">From Date</label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">To Date</label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            {(searchTerm || statusFilter !== 'ALL' || dateRange.start || dateRange.end) && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-hos-text-muted">
                  Showing {filteredOrders.length} of {orders.length} orders (page {currentPage} of {totalPages || 1})
                </span>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                    setDateRange({ start: '', end: '' });
                  }}
                  className="text-sm text-hos-gold hover:text-hos-gold-hover"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300">Error: {error}</p>
              <button
                onClick={fetchOrders}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              {paginatedOrders.length > 0 && (
                <div className="md:hidden space-y-3 p-4">
                  {paginatedOrders.map((order) => (
                    <PortalMobileCard
                      key={order.id}
                      title={`Order #${order.orderNumber || order.id.substring(0, 8)}`}
                      subtitle={order.user?.email || order.customer?.email}
                      rows={[
                        {
                          label: 'Customer',
                          value: (order.user?.firstName || order.user?.lastName)
                            ? `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim()
                            : order.user?.email || order.customer?.email || 'Guest',
                        },
                        {
                          label: 'Total',
                          value: formatAdminPrice(order.total || 0, order.currency || 'USD'),
                        },
                        { label: 'Status', value: order.status },
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
              )}
              <div className="hidden md:block p-4 border-b flex justify-end">
                <AdminColumnToggle
                  columns={ORDER_TABLE_COLUMNS}
                  visibleIds={orderVisibleColumnIds}
                  onToggle={toggleOrderColumn}
                  onReset={resetOrderColumns}
                />
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="admin-table min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      {isOrderColumnVisible('order') && <th className="px-6 py-3 text-left">Order</th>}
                      {isOrderColumnVisible('customer') && <th className="px-6 py-3 text-left">Customer</th>}
                      {isOrderColumnVisible('total') && <th className="px-6 py-3 text-left">Total</th>}
                      {isOrderColumnVisible('status') && <th className="px-6 py-3 text-left">Status</th>}
                      {isOrderColumnVisible('date') && <th className="px-6 py-3 text-left">Date</th>}
                      {isOrderColumnVisible('actions') && <th className="px-6 py-3 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={orderVisibleColumnIds.size} className="px-6 py-12 text-center">
                          <div className={orders.length > 0 ? 'admin-empty-filtered' : ''}>
                            <span className="text-4xl block mb-2" aria-hidden>📦</span>
                            <p className="text-sm font-medium text-hos-text-secondary">
                              {orders.length > 0 ? 'No orders match your filters' : 'No orders found'}
                            </p>
                            {orders.length > 0 && (
                              <p className="mt-1 text-xs text-hos-text-muted">Try adjusting search or date range.</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="admin-table-row-clickable"
                          onClick={() => openOrderDetails(order)}
                        >
                          {isOrderColumnVisible('order') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-hos-text-secondary">
                              #{order.orderNumber || order.id.substring(0, 8)}
                            </div>
                          </td>
                          )}
                          {isOrderColumnVisible('customer') && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-hos-text-secondary">
                              {(order.user?.firstName || order.user?.lastName)
                                ? `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim()
                                : order.user?.email || order.customer?.email || 'Guest'}
                            </div>
                            {(order.user?.firstName || order.user?.lastName) && (
                              <div className="text-xs text-hos-text-muted truncate max-w-[200px]">
                                {order.user?.email || order.customer?.email || ''}
                              </div>
                            )}
                          </td>
                          )}
                          {isOrderColumnVisible('total') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hos-text-secondary">
                            {formatAdminPrice(order.total || 0, order.currency || 'USD')}
                          </td>
                          )}
                          {isOrderColumnVisible('status') && (
                          <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusChange(order.id, e.target.value, order.orderNumber || order.id.substring(0, 8), order.status)}
                              disabled={updatingOrderId !== null}
                              className={`text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer ${
                                STATUS_COLORS[order.status] || 'bg-hos-bg-tertiary text-hos-text-secondary'
                              } ${updatingOrderId !== null ? 'opacity-50' : ''}`}
                            >
                              {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </td>
                          )}
                          {isOrderColumnVisible('date') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          )}
                          {isOrderColumnVisible('actions') && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openOrderDetails(order)}
                              className="admin-table-action"
                            >
                              View
                            </button>
                          </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between bg-hos-bg-secondary rounded-lg shadow px-6 py-3 border border-hos-border">
              <p className="text-sm text-hos-text-secondary">
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredOrders.length)} of {filteredOrders.length} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="admin-pagination-btn"
                >
                  Previous
                </button>
                <span className="text-sm text-hos-text-secondary">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="admin-pagination-btn admin-pagination-btn-primary"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Status Change Confirmation Dialog */}
          {confirmDialog && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-bold text-hos-text-secondary mb-2">Confirm Status Change</h3>
                <p className="text-sm text-hos-text-secondary mb-4">
                  Are you sure you want to change the status of order{' '}
                  <span className="font-semibold">#{confirmDialog.orderNumber}</span> from{' '}
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[confirmDialog.currentStatus] || 'bg-hos-bg-tertiary text-hos-text-secondary'}`}>
                    {confirmDialog.currentStatus}
                  </span>{' '}
                  to{' '}
                  <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[confirmDialog.newStatus] || 'bg-hos-bg-tertiary text-hos-text-secondary'}`}>
                    {confirmDialog.newStatus}
                  </span>?
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setConfirmDialog(null)}
                    className="px-4 py-2 border border-hos-border rounded-lg text-sm font-medium text-hos-text-secondary hover:bg-hos-bg-tertiary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmStatusUpdate}
                    className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}

          <Modal
            open={showDetailsModal && !!selectedOrder}
            onClose={() => setShowDetailsModal(false)}
            titleId="admin-order-modal-title"
            size="xl"
          >
            {selectedOrder && (
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 id="admin-order-modal-title" className="text-2xl font-bold text-hos-text-secondary">
                      Order #{selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}
                    </h2>
                    <p className="text-sm text-hos-text-muted mt-1">
                      Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDetailsModal(false)}
                    className="text-hos-text-muted hover:text-hos-text-secondary text-2xl"
                    aria-label="Close order details"
                  >
                    ×
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Customer Info */}
                    <div className="bg-hos-bg-secondary rounded-lg p-4">
                      <h3 className="font-semibold text-hos-text-secondary mb-3">Customer Information</h3>
                      <div className="space-y-2 text-sm">
                        <p>
                          <span className="text-hos-text-muted">Name:</span>{' '}
                          {(selectedOrder.user?.firstName || selectedOrder.user?.lastName)
                            ? `${selectedOrder.user.firstName || ''} ${selectedOrder.user.lastName || ''}`.trim()
                            : 'N/A'}
                        </p>
                        <p>
                          <span className="text-hos-text-muted">Email:</span>{' '}
                          {selectedOrder.user?.email || selectedOrder.customer?.email || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="bg-hos-bg-secondary rounded-lg p-4">
                      <h3 className="font-semibold text-hos-text-secondary mb-3">Shipping Address</h3>
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
                        <p className="text-sm text-hos-text-muted">No shipping address available</p>
                      )}
                    </div>
                  </div>

                  {/* Order Status */}
                  <div className="bg-hos-bg-secondary rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-hos-text-secondary mb-3">Order Status</h3>
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="text-sm text-hos-text-muted mr-2">Status:</span>
                        <select
                          value={selectedOrder.status}
                          onChange={(e) => handleStatusChange(selectedOrder.id, e.target.value, selectedOrder.orderNumber || selectedOrder.id.substring(0, 8), selectedOrder.status)}
                          disabled={updatingOrderId !== null}
                          className={`text-sm font-semibold rounded-full px-3 py-1 border-0 ${
                            STATUS_COLORS[selectedOrder.status] || 'bg-hos-bg-tertiary text-hos-text-secondary'
                          } ${updatingOrderId !== null ? 'opacity-50' : ''}`}
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                      {selectedOrder.paymentStatus && (
                        <div>
                          <span className="text-sm text-hos-text-muted mr-2">Payment:</span>
                          <span className="text-sm font-medium">{selectedOrder.paymentStatus}</span>
                        </div>
                      )}
                      {selectedOrder.paymentMethod && (
                        <div>
                          <span className="text-sm text-hos-text-muted mr-2">Method:</span>
                          <span className="text-sm font-medium">{selectedOrder.paymentMethod}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-hos-text-secondary mb-3">Order Items</h3>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-hos-border">
                          <thead className="bg-hos-bg-secondary">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-hos-text-muted">Product</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-hos-text-muted">Qty</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-hos-text-muted">Price</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-hos-text-muted">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hos-border">
                            {selectedOrder.items.map((item) => (
                              <tr key={item.id}>
                                <td className="px-4 py-3 text-sm">
                                  <div className="font-medium">{item.product?.name || 'Unknown Product'}</div>
                                  {item.product?.sku && (
                                    <div className="text-xs text-hos-text-muted">SKU: {item.product.sku}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">{item.quantity}</td>
                                <td className="px-4 py-3 text-sm text-right">${Number(item.price).toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right font-medium">
                                  ${(Number(item.price) * item.quantity).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-hos-text-muted">No items data available</p>
                    )}
                  </div>

                  {/* Order Summary */}
                  <div className="bg-hos-bg-secondary rounded-lg p-4">
                    <h3 className="font-semibold text-hos-text-secondary mb-3">Order Summary</h3>
                    <div className="space-y-2 text-sm">
                      {selectedOrder.subtotal !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-hos-text-muted">Subtotal:</span>
                          <span>${Number(selectedOrder.subtotal).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.shipping !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-hos-text-muted">Shipping:</span>
                          <span>${Number(selectedOrder.shipping).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.tax !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-hos-text-muted">Tax:</span>
                          <span>${Number(selectedOrder.tax).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.discount !== undefined && selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-green-400">
                          <span>Discount:</span>
                          <span>-${Number(selectedOrder.discount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t">
                        <span>Total:</span>
                        <span>{selectedOrder.currency || 'USD'} {Number(selectedOrder.total).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex flex-wrap gap-2">
                      {(selectedOrder.user?.email || selectedOrder.customer?.email) && (
                        <a
                          href={`mailto:${selectedOrder.user?.email || selectedOrder.customer?.email}?subject=${encodeURIComponent(`Regarding order #${selectedOrder.orderNumber || selectedOrder.id.substring(0, 8)}`)}`}
                          className="admin-table-action"
                        >
                          Contact customer
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="admin-table-action"
                      >
                        Print
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDetailsModal(false)}
                      className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
            )}
          </Modal>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
