'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { useCurrency } from '@/contexts/CurrencyContext';
import { PORTAL_INPUT_CLASS, PORTAL_SELECT_CLASS } from '@/lib/portalFieldClasses';

export default function WholesalerOrdersPage() {
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

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
      <DashboardLayout role="WHOLESALER" menuItems={menuItems} title="Wholesaler">
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                        Date
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                          {formatPrice(parseFloat(order.total || 0))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}

