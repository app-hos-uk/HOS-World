'use client';

import { useEffect, useState, Fragment } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { Dialog, Transition } from '@headlessui/react';

interface StockTransfer {
  id: string;
  fromWarehouse: { id: string; name: string; code: string };
  toWarehouse: { id: string; name: string; code: string };
  product: { id: string; name: string; sku?: string };
  quantity: number;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  requestedBy: string;
  completedBy?: string;
  notes?: string;
  completedAt?: string;
  createdAt: string;
}

export default function AdminStockTransfersPage() {
  const toast = useToast();
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    fromWarehouseId: '',
    toWarehouseId: '',
    productId: '',
    quantity: 1,
    notes: '',
  });
  const [filters, setFilters] = useState({
    status: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    productId: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTransfers();
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (formData.fromWarehouseId) {
      fetchProductsForWarehouse(formData.fromWarehouseId);
    }
  }, [formData.fromWarehouseId]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getStockTransfers({
        status: filters.status || undefined,
        fromWarehouseId: filters.fromWarehouseId || undefined,
        toWarehouseId: filters.toWarehouseId || undefined,
        productId: filters.productId || undefined,
        page: 1,
        limit: 50,
      });
      if (response?.data?.transfers) {
        setTransfers(response.data.transfers);
      }
    } catch (err: any) {
      console.error('Error fetching transfers:', err);
      toast.error(err.message || 'Failed to load stock transfers');
    } finally {
      setLoading(false);
    }
  };

  const fetchWarehouses = async () => {
    try {
      const response = await apiClient.getWarehouses();
      if (response?.data && Array.isArray(response.data)) {
        setWarehouses(response.data.filter((w: any) => w.isActive));
      }
    } catch (err: any) {
      console.error('Error fetching warehouses:', err);
    }
  };

  const fetchProductsForWarehouse = async (warehouseId: string) => {
    try {
      const response = await apiClient.getInventoryLocations(warehouseId);
      if (response?.data && Array.isArray(response.data)) {
        // Get unique products from inventory locations
        const productIds = [...new Set(response.data.map((loc: any) => loc.productId))];
        // Fetch product details (simplified - would need a bulk product endpoint)
        setProducts(response.data.map((loc: any) => ({
          id: loc.productId,
          name: loc.product?.name || 'Unknown Product',
          sku: loc.product?.sku,
          available: loc.quantity - (loc.reserved || 0),
        })));
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.fromWarehouseId === formData.toWarehouseId) {
      toast.error('Source and destination warehouses must be different');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.createStockTransfer(formData);
      toast.success('Stock transfer created successfully!');
      setShowCreateModal(false);
      setFormData({
        fromWarehouseId: '',
        toWarehouseId: '',
        productId: '',
        quantity: 1,
        notes: '',
      });
      fetchTransfers();
    } catch (err: any) {
      console.error('Error creating transfer:', err);
      toast.error(err.message || 'Failed to create stock transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTransfer = async (transferId: string) => {
    if (!confirm('Complete this stock transfer? This will update inventory in both warehouses.')) {
      return;
    }
    try {
      await apiClient.completeStockTransfer(transferId);
      toast.success('Stock transfer completed successfully!');
      fetchTransfers();
    } catch (err: any) {
      console.error('Error completing transfer:', err);
      toast.error(err.message || 'Failed to complete transfer');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'IN_TRANSIT':
        return 'bg-blue-100 text-blue-800';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <RouteGuard requiredRole="ADMIN">
      <AdminLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-purple-900 mb-2">Stock Transfers</h1>
              <p className="text-gray-600">Manage stock transfers between warehouses</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              + Create Transfer
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters({ ...filters, status: e.target.value });
                    setTimeout(() => fetchTransfers(), 100);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_TRANSIT">In Transit</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Warehouse</label>
                <select
                  value={filters.fromWarehouseId}
                  onChange={(e) => {
                    setFilters({ ...filters, fromWarehouseId: e.target.value });
                    setTimeout(() => fetchTransfers(), 100);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Warehouse</label>
                <select
                  value={filters.toWarehouseId}
                  onChange={(e) => {
                    setFilters({ ...filters, toWarehouseId: e.target.value });
                    setTimeout(() => fetchTransfers(), 100);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilters({ status: '', fromWarehouseId: '', toWarehouseId: '', productId: '' });
                    setTimeout(() => fetchTransfers(), 100);
                  }}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <p className="mt-4 text-gray-600">Loading transfers...</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      From → To
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No stock transfers found. Create your first transfer to get started.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{transfer.product.name}</div>
                          {transfer.product.sku && (
                            <div className="text-sm text-gray-500">SKU: {transfer.product.sku}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {transfer.fromWarehouse.name} ({transfer.fromWarehouse.code})
                          </div>
                          <div className="text-sm text-gray-500">→</div>
                          <div className="text-sm text-gray-900">
                            {transfer.toWarehouse.name} ({transfer.toWarehouse.code})
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">{transfer.quantity}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                              transfer.status,
                            )}`}
                          >
                            {transfer.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(transfer.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {transfer.status === 'PENDING' && (
                            <button
                              onClick={() => handleCompleteTransfer(transfer.id)}
                              className="text-purple-600 hover:text-purple-900 mr-4"
                            >
                              Complete
                            </button>
                          )}
                          {transfer.status === 'COMPLETED' && transfer.completedAt && (
                            <span className="text-sm text-gray-500">
                              Completed {formatDate(transfer.completedAt)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Create Transfer Modal */}
          <Transition appear show={showCreateModal} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={() => setShowCreateModal(false)}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-25" />
              </Transition.Child>

              <div className="fixed inset-0 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 scale-95"
                    enterTo="opacity-100 scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 scale-100"
                    leaveTo="opacity-0 scale-95"
                  >
                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 mb-4"
                      >
                        Create Stock Transfer
                      </Dialog.Title>

                      <form onSubmit={handleCreateTransfer} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            From Warehouse *
                          </label>
                          <select
                            required
                            value={formData.fromWarehouseId}
                            onChange={(e) => setFormData({ ...formData, fromWarehouseId: e.target.value, productId: '' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Select warehouse</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.code})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            To Warehouse *
                          </label>
                          <select
                            required
                            value={formData.toWarehouseId}
                            onChange={(e) => setFormData({ ...formData, toWarehouseId: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="">Select warehouse</option>
                            {warehouses
                              .filter((w) => w.id !== formData.fromWarehouseId)
                              .map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} ({w.code})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Product *
                          </label>
                          <select
                            required
                            value={formData.productId}
                            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                            disabled={!formData.fromWarehouseId}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                          >
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku && `(${p.sku})`} - Available: {p.available}
                              </option>
                            ))}
                          </select>
                          {!formData.fromWarehouseId && (
                            <p className="mt-1 text-xs text-gray-500">Select source warehouse first</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Quantity *
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={formData.quantity}
                            onChange={(e) =>
                              setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes (optional)
                          </label>
                          <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Add any notes about this transfer..."
                          />
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                          <button
                            type="button"
                            onClick={() => setShowCreateModal(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                          >
                            {submitting ? 'Creating...' : 'Create Transfer'}
                          </button>
                        </div>
                      </form>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
