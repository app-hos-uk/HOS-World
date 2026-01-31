'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  items: Array<{
    id: string;
    productId: string;
    product: {
      id: string;
      name: string;
      images: Array<{ url: string }>;
    };
    quantity: number;
    price: number;
  }>;
  createdAt?: string; // Optional to allow for missing/invalid dates
  deliveredAt?: string;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  notes?: string;
  refundAmount?: number;
  refundMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ReturnsPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'returns'>('orders');

  const [returnForm, setReturnForm] = useState({
    orderId: '',
    reason: '',
    notes: '',
    selectedItems: [] as string[],
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // NOTE: apiClient uses shared-types where dates may be typed as Date.
      // The UI expects ISO strings. Normalize date fields defensively to avoid build-time type conflicts.
      const ordersResponse = await apiClient
        .getOrders()
        .catch(() => ({ data: [] as any[] } as any));
      const returnsResponse = await apiClient
        .getReturns()
        .catch(() => ({ data: [] as any[] } as any));

      const rawOrders: any[] = Array.isArray(ordersResponse?.data) ? ordersResponse.data : [];
      const normalizedOrders: Order[] = rawOrders.map((o: any) => {
        // Safely normalize createdAt - check for existence and validity
        // If missing or invalid, set to undefined so UI can show 'N/A' instead of misleading date
        let normalizedCreatedAt: string | undefined;
        if (!o?.createdAt) {
          // Missing date - set to undefined (not a fallback date) so UI can display 'N/A'
          normalizedCreatedAt = undefined;
        } else if (typeof o.createdAt === 'string') {
          // Validate string date before using it
          const date = new Date(o.createdAt);
          if (isNaN(date.getTime())) {
            // Invalid date string, set to undefined
            normalizedCreatedAt = undefined;
          } else {
            normalizedCreatedAt = o.createdAt;
          }
        } else {
          const date = new Date(o.createdAt);
          // Check if date is valid before calling toISOString()
          if (isNaN(date.getTime())) {
            // Invalid date, set to undefined (not a fallback date)
            normalizedCreatedAt = undefined;
          } else {
            normalizedCreatedAt = date.toISOString();
          }
        }

        // Safely normalize deliveredAt - check for existence and validity
        let normalizedDeliveredAt: string | undefined;
        if (o?.deliveredAt == null) {
          normalizedDeliveredAt = undefined;
        } else if (typeof o.deliveredAt === 'string') {
          normalizedDeliveredAt = o.deliveredAt;
        } else {
          const date = new Date(o.deliveredAt);
          // Check if date is valid before calling toISOString()
          if (isNaN(date.getTime())) {
            // Invalid date, set to undefined
            normalizedDeliveredAt = undefined;
          } else {
            normalizedDeliveredAt = date.toISOString();
          }
        }

        return {
          ...o,
          createdAt: normalizedCreatedAt,
          deliveredAt: normalizedDeliveredAt,
        };
      });
      setOrders(normalizedOrders);

      const rawReturns: any[] = Array.isArray(returnsResponse?.data) ? returnsResponse.data : [];
      setReturnRequests(rawReturns as ReturnRequest[]);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReturn = (order: Order) => {
    setSelectedOrder(order);
    setReturnForm({
      orderId: order.id,
      reason: '',
      notes: '',
      selectedItems: [],
    });
    setShowCreateModal(true);
  };

  const handleSubmitReturn = async () => {
    if (!selectedOrder) return;

    if (!returnForm.reason.trim()) {
      toast.error('Please provide a reason for the return');
      return;
    }

    try {
      setActionLoading(true);
      await toast.promise(
        apiClient.createReturnRequest({
          orderId: returnForm.orderId,
          reason: returnForm.reason.trim(),
          notes: returnForm.notes.trim() || undefined,
          items: returnForm.selectedItems.length > 0
            ? selectedOrder.items
                .filter((item) => returnForm.selectedItems.includes(item.id))
                .map((item) => ({
                  orderItemId: item.id,
                  quantity: item.quantity,
                  reason: returnForm.reason,
                }))
            : undefined,
        }),
        {
          loading: 'Creating return request...',
          success: 'Return request created successfully',
          error: (err: any) => err.message || 'Failed to create return request',
        }
      );
      setShowCreateModal(false);
      await fetchData();
      setActiveTab('returns');
    } catch (err: any) {
      console.error('Error creating return request:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-purple-100 text-purple-800',
      REFUNDED: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const canReturnOrder = (order: Order) => {
    // Check if order is delivered and within return window
    // This is a simplified check - actual logic should check return policies
    return order.status === 'DELIVERED' || order.status === 'COMPLETED';
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-6xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 font-primary text-purple-900">
          Returns & Refunds
        </h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('orders')}
              className={`pb-4 px-2 font-medium text-sm transition-colors ${
                activeTab === 'orders'
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My Orders
            </button>
            <button
              onClick={() => setActiveTab('returns')}
              className={`pb-4 px-2 font-medium text-sm transition-colors ${
                activeTab === 'returns'
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Return Requests ({returnRequests.length})
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-sm sm:text-base text-gray-600">Loading...</p>
            </div>
          </div>
        ) : activeTab === 'orders' ? (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600 mb-4">You have no orders yet.</p>
                <Link
                  href="/products"
                  className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Browse Products
                </Link>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="bg-white border rounded-lg shadow-sm p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Order #{order.orderNumber}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Placed on {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0 text-right">
                      <p className="text-lg font-semibold text-purple-900">
                        {formatPrice(order.total, order.currency || 'GBP')}
                      </p>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'DELIVERED' || order.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                        <img
                          src={item.product.images[0]?.url || '/placeholder-image.jpg'}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded-md"
                        />
                        <div className="flex-grow">
                          <p className="font-medium text-gray-900">{item.product.name}</p>
                          <p className="text-sm text-gray-500">
                            Quantity: {item.quantity} × {formatPrice(item.price, order.currency || 'GBP')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {canReturnOrder(order) && (
                    <button
                      onClick={() => handleCreateReturn(order)}
                      className="w-full sm:w-auto px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      Request Return
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {returnRequests.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <p className="text-gray-600 mb-4">You have no return requests.</p>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  View Orders
                </button>
              </div>
            ) : (
              returnRequests.map((returnRequest) => {
                const order = orders.find((o) => o.id === returnRequest.orderId);
                return (
                  <div key={returnRequest.id} className="bg-white border rounded-lg shadow-sm p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Return Request #{returnRequest.id.slice(0, 8)}
                        </h3>
                        {order && (
                          <p className="text-sm text-gray-500">
                            Order #{order.orderNumber}
                          </p>
                        )}
                        <p className="text-sm text-gray-500">
                          Created on {returnRequest.createdAt ? new Date(returnRequest.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full mt-2 sm:mt-0 ${getStatusColor(returnRequest.status)}`}>
                        {returnRequest.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Reason:</p>
                        <p className="text-sm text-gray-600">{returnRequest.reason}</p>
                      </div>
                      {returnRequest.notes && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Notes:</p>
                          <p className="text-sm text-gray-600">{returnRequest.notes}</p>
                        </div>
                      )}
                      {returnRequest.refundAmount && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Refund Amount:</p>
                          <p className="text-lg font-semibold text-green-600">
                            {formatPrice(returnRequest.refundAmount, order?.currency || 'GBP')}
                          </p>
                        </div>
                      )}
                      {returnRequest.refundMethod && (
                        <div>
                          <p className="text-sm font-medium text-gray-700">Refund Method:</p>
                          <p className="text-sm text-gray-600">{returnRequest.refundMethod}</p>
                        </div>
                      )}
                    </div>

                    <Link
                      href={`/returns/${returnRequest.id}`}
                      className="text-purple-600 hover:text-purple-800 font-medium text-sm"
                    >
                      View Details →
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Create Return Modal */}
        {showCreateModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 my-8">
              <h2 className="text-xl font-bold mb-4">Request Return</h2>
              <p className="text-sm text-gray-600 mb-4">
                Order #{selectedOrder.orderNumber}
              </p>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Items to Return (optional - leave empty to return entire order)
                  </label>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item) => (
                      <label key={item.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={returnForm.selectedItems.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setReturnForm({
                                ...returnForm,
                                selectedItems: [...returnForm.selectedItems, item.id],
                              });
                            } else {
                              setReturnForm({
                                ...returnForm,
                                selectedItems: returnForm.selectedItems.filter((id) => id !== item.id),
                              });
                            }
                          }}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <img
                          src={item.product.images[0]?.url || '/placeholder-image.jpg'}
                          alt={item.product.name}
                          className="w-12 h-12 object-cover rounded-md"
                        />
                        <div className="flex-grow">
                          <p className="font-medium text-gray-900">{item.product.name}</p>
                          <p className="text-sm text-gray-500">
                            Qty: {item.quantity} × {formatPrice(item.price, selectedOrder.currency || 'GBP')}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Return *
                  </label>
                  <select
                    value={returnForm.reason}
                    onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    required
                  >
                    <option value="">Select a reason</option>
                    <option value="DEFECTIVE">Defective or damaged item</option>
                    <option value="WRONG_ITEM">Wrong item received</option>
                    <option value="NOT_AS_DESCRIBED">Not as described</option>
                    <option value="SIZE_ISSUE">Size doesn&apos;t fit</option>
                    <option value="CHANGED_MIND">Changed my mind</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes (optional)
                  </label>
                  <textarea
                    value={returnForm.notes}
                    onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
                    rows={4}
                    placeholder="Please provide any additional details about your return..."
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReturn}
                  disabled={actionLoading || !returnForm.reason}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
    </RouteGuard>
  );
}
