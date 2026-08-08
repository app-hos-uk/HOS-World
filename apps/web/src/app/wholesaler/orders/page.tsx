'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AppShellLayout } from '@/components/AppShellLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/useToast';
import { PortalMobileCard } from '@/components/ui/PortalMobileCard';
import { PORTAL_INPUT_CLASS, PORTAL_SELECT_CLASS } from '@/lib/portalFieldClasses';

/**
 * Wholesalers fulfil their own marketplace orders, so they get the same
 * forward-only transitions as B2C sellers.
 */
const NEXT_STATUS: Record<string, { status: string; label: string }> = {
  PENDING: { status: 'CONFIRMED', label: 'Accept Order' },
  ACCEPTED: { status: 'CONFIRMED', label: 'Confirm Order' },
  CONFIRMED: { status: 'PROCESSING', label: 'Start Processing' },
  PROCESSING: { status: 'FULFILLED', label: 'Mark as Fulfilled' },
  FULFILLED: { status: 'SHIPPED', label: 'Mark as Shipped' },
  SHIPPED: { status: 'DELIVERED', label: 'Mark as Delivered' },
};

const CANCELLABLE = ['PENDING', 'ACCEPTED', 'CONFIRMED', 'PROCESSING'];

function normalizeStatus(status: unknown): string {
  return String(status || '').toUpperCase();
}

export default function WholesalerOrdersPage() {
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const menuItems = getSellerMenuItems(true);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getWholesalerOrders(statusFilter || undefined);
      if (response?.data) {
        setOrders(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError(err.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const openManageModal = (order: any) => {
    setSelectedOrder(order);
    setTrackingNumber(order.trackingCode || order.trackingNumber || '');
    setCarrier(order.carrier || '');
    setCancelReason('');
    setShowCancelForm(false);
  };

  const closeManageModal = () => {
    setSelectedOrder(null);
    setTrackingNumber('');
    setCarrier('');
    setCancelReason('');
    setShowCancelForm(false);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedOrder) return;

    if (newStatus === 'SHIPPED') {
      if (!trackingNumber.trim()) {
        toast.error('Enter a tracking number before marking as shipped');
        return;
      }
      if (!carrier.trim()) {
        toast.error('Enter the carrier before marking as shipped');
        return;
      }
    }

    try {
      setUpdatingStatus(true);
      const shipping =
        newStatus === 'SHIPPED'
          ? { trackingCode: trackingNumber.trim(), carrier: carrier.trim() }
          : undefined;
      await apiClient.updateOrderStatus(selectedOrder.id, newStatus, shipping);
      toast.success(`Order status updated to ${newStatus}`);
      closeManageModal();
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    try {
      setUpdatingStatus(true);
      // Cancellation goes through the dedicated endpoint so refunds and stock
      // restoration are handled; the generic update endpoint rejects CANCELLED.
      await apiClient.cancelOrder(selectedOrder.id, cancelReason.trim());
      toast.success('Order cancellation submitted');
      closeManageModal();
      await fetchOrders();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel order');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const q = searchTerm.toLowerCase();
    return orders.filter((order) => {
      const orderId = (order.orderNumber || order.id || '').toLowerCase();
      const customer = `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.toLowerCase();
      const email = (order.user?.email || '').toLowerCase();
      return orderId.includes(q) || customer.includes(q) || email.includes(q);
    });
  }, [orders, searchTerm]);

  return (
    <RouteGuard allowedRoles={['WHOLESALER', 'ADMIN']} showAccessDenied={true}>
      <AppShellLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler" backToAdmin={{ title: 'Admin Dashboard', href: '/admin/dashboard' }} breadcrumbs="inline">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-hos-text-secondary">Bulk Orders</h1>
              <p className="text-hos-text-secondary mt-2">Manage your wholesale bulk orders</p>
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={PORTAL_SELECT_CLASS}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="SHIPPED">Shipped</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {!loading && !error && orders.length > 0 && (
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4 mb-6">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order ID, customer name, or email..."
              className={PORTAL_INPUT_CLASS}
            />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded mb-6">
            Error: {error}
            <button
              onClick={fetchOrders}
              className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-hos-text-muted">
                  {orders.length === 0 ? 'No bulk orders found' : 'No orders match your search'}
                </p>
              </div>
            ) : (
              <>
              <div className="md:hidden space-y-3 p-4">
                {filteredOrders.map((order) => (
                  <PortalMobileCard
                    key={order.id}
                    title={`Order #${order.orderNumber || order.id.slice(0, 8)}`}
                    subtitle={`${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || undefined}
                    rows={[
                      { label: 'Total', value: formatPrice(parseFloat(order.total || 0)) },
                      {
                        label: 'Quantity',
                        value: order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
                      },
                      {
                        label: 'Status',
                        value: (
                          <span
                            className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                              (() => {
                                const s = (order.status || '').toLowerCase();
                                if (s === 'pending') return 'bg-yellow-500/15 text-yellow-300';
                                if (['confirmed', 'processing', 'accepted'].includes(s)) return 'bg-hos-gold/20 text-hos-gold';
                                if (['fulfilled', 'shipped'].includes(s)) return 'bg-hos-gold/20 text-hos-gold';
                                if (s === 'delivered') return 'bg-green-500/15 text-green-300';
                                if (['cancelled', 'refunded'].includes(s)) return 'bg-red-500/15 text-red-300';
                                return 'bg-hos-bg-tertiary text-hos-text-secondary';
                              })()
                            }`}
                          >
                            {order.status}
                          </span>
                        ),
                      },
                      { label: 'Date', value: new Date(order.createdAt).toLocaleDateString() },
                      {
                        label: 'Actions',
                        value: (
                          <button
                            type="button"
                            onClick={() => openManageModal(order)}
                            className="text-hos-gold hover:text-hos-gold-hover font-medium"
                          >
                            Manage
                          </button>
                        ),
                      },
                    ]}
                  />
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="tabular-nums text-right px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Total
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-hos-text-secondary">
                          #{order.orderNumber || order.id.slice(0, 8)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {order.user?.firstName} {order.user?.lastName}
                        </td>
                        <td className="tabular-nums text-right px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {formatPrice(parseFloat(order.total || 0))}
                        </td>
                        <td className="text-right px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {order.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              (() => {
                                const s = (order.status || '').toLowerCase();
                                if (s === 'pending') return 'bg-yellow-500/15 text-yellow-300';
                                if (['confirmed', 'processing', 'accepted'].includes(s)) return 'bg-hos-gold/20 text-hos-gold';
                                if (['fulfilled', 'shipped'].includes(s)) return 'bg-hos-gold/20 text-hos-gold';
                                if (s === 'delivered') return 'bg-green-500/15 text-green-300';
                                if (['cancelled', 'refunded'].includes(s)) return 'bg-red-500/15 text-red-300';
                                return 'bg-hos-bg-tertiary text-hos-text-secondary';
                              })()
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <button
                            type="button"
                            onClick={() => openManageModal(order)}
                            className="text-hos-gold hover:text-hos-gold-hover font-medium"
                          >
                            Manage
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

        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-lg bg-hos-bg-secondary border border-hos-border shadow-xl">
              <div className="flex items-start justify-between border-b border-hos-border p-5">
                <div>
                  <h2 className="text-lg font-semibold text-hos-text-secondary">
                    Order #{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}
                  </h2>
                  <p className="mt-1 text-sm text-hos-text-muted">
                    Current status: {normalizeStatus(selectedOrder.status)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeManageModal}
                  className="text-hos-text-muted hover:text-hos-text-secondary"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 p-5">
                {NEXT_STATUS[normalizeStatus(selectedOrder.status)]?.status === 'SHIPPED' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-hos-text-secondary">
                        Tracking Number
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="e.g. 1Z999AA10123456784"
                        className={PORTAL_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-hos-text-secondary">
                        Carrier
                      </label>
                      <input
                        type="text"
                        value={carrier}
                        onChange={(e) => setCarrier(e.target.value)}
                        placeholder="e.g. DPD"
                        className={PORTAL_INPUT_CLASS}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUS[normalizeStatus(selectedOrder.status)] ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleStatusUpdate(NEXT_STATUS[normalizeStatus(selectedOrder.status)].status)
                      }
                      disabled={updatingStatus}
                      className="rounded-lg bg-hos-gold px-4 py-2 text-sm font-medium text-[#1a1406] hover:bg-hos-gold-hover disabled:opacity-50"
                    >
                      {NEXT_STATUS[normalizeStatus(selectedOrder.status)].label}
                    </button>
                  ) : (
                    <p className="text-sm text-hos-text-muted">
                      This order has reached a final status — no further action is available.
                    </p>
                  )}

                  {CANCELLABLE.includes(normalizeStatus(selectedOrder.status)) && !showCancelForm && (
                    <button
                      type="button"
                      onClick={() => setShowCancelForm(true)}
                      disabled={updatingStatus}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>

                {showCancelForm && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                    <label className="mb-1 block text-sm font-medium text-hos-text-secondary">
                      Cancellation reason
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      rows={3}
                      placeholder="Explain why this order is being cancelled"
                      className={PORTAL_INPUT_CLASS}
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancelOrder}
                        disabled={updatingStatus}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm Cancellation
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCancelForm(false)}
                        disabled={updatingStatus}
                        className="rounded-lg bg-hos-bg-tertiary px-4 py-2 text-sm font-medium text-hos-text-secondary"
                      >
                        Keep Order
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end border-t border-hos-border p-5">
                <button
                  type="button"
                  onClick={closeManageModal}
                  className="rounded-lg bg-hos-bg-tertiary px-4 py-2 text-sm font-medium text-hos-text-secondary hover:bg-hos-bg-tertiary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </AppShellLayout>
    </RouteGuard>
  );
}

