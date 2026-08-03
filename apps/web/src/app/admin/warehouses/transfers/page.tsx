'use client';

import { useEffect, useState, Fragment } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
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
  const [productsUsingFallback, setProductsUsingFallback] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const mapInventoryRows = (rows: any[]) => {
    const byProduct = new Map<string, { id: string; name: string; sku?: string; available: number }>();
    for (const loc of rows) {
      const id = loc.productId || loc.product?.id;
      if (!id) continue;
      const available = (loc.quantity ?? 0) - (loc.reserved || 0);
      const existing = byProduct.get(id);
      if (existing) {
        existing.available += available;
      } else {
        byProduct.set(id, {
          id,
          name: loc.product?.name || 'Unknown Product',
          sku: loc.product?.sku,
          available,
        });
      }
    }
    return Array.from(byProduct.values());
  };

  const fetchProductsForWarehouse = async (warehouseId: string) => {
    setProducts([]);
    setProductsUsingFallback(false);
    try {
      // 1) Inventory locations for source warehouse
      try {
        const response = await apiClient.getInventoryLocations(warehouseId);
        const locations = Array.isArray(response?.data) ? response.data : [];
        const mapped = mapInventoryRows(locations);
        const withStock = mapped.filter((p) => p.available > 0);
        if (withStock.length > 0) {
          setProducts(withStock);
          return;
        }
        if (mapped.length > 0) {
          setProducts(mapped);
          return;
        }
      } catch (locErr) {
        console.warn('getInventoryLocations failed, trying warehouse inventory:', locErr);
      }

      // 2) Warehouse detail (includes inventory relation)
      try {
        const whRes = await apiClient.getWarehouse(warehouseId);
        const inventory = whRes?.data?.inventory;
        if (Array.isArray(inventory) && inventory.length > 0) {
          const mapped = mapInventoryRows(inventory);
          const withStock = mapped.filter((p) => p.available > 0);
          setProducts(withStock.length > 0 ? withStock : mapped);
          return;
        }
      } catch (whErr) {
        console.warn('getWarehouse failed, trying warehouses list inventory:', whErr);
      }

      // 3) Inventory already loaded on warehouses list
      const fromList = warehouses.find((w) => w.id === warehouseId)?.inventory;
      if (Array.isArray(fromList) && fromList.length > 0) {
        const mapped = mapInventoryRows(fromList);
        const withStock = mapped.filter((p) => p.available > 0);
        setProducts(withStock.length > 0 ? withStock : mapped);
        return;
      }

      // 4) Last resort: active products (stock may be unknown)
      const prodRes = await apiClient.getAdminProducts({ status: 'ACTIVE', page: 1, limit: 200 });
      const raw = prodRes?.data;
      const list = Array.isArray(raw) ? raw : raw?.products || raw?.data || [];
      const active = (Array.isArray(list) ? list : [])
        .filter((p: any) => p?.id && (p.status === 'ACTIVE' || !p.status))
        .map((p: any) => ({
          id: p.id,
          name: p.name || 'Unknown Product',
          sku: p.sku,
          available: typeof p.stock === 'number' ? p.stock : typeof p.quantity === 'number' ? p.quantity : '—',
        }));
      setProducts(active);
      setProductsUsingFallback(true);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setProducts([]);
      toast.error(err.message || 'Failed to load products for warehouse');
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
        return 'bg-green-500/15 text-green-300';
      case 'PENDING':
        return 'bg-yellow-500/15 text-yellow-300';
      case 'IN_TRANSIT':
        return 'bg-hos-gold/20 text-hos-gold';
      case 'CANCELLED':
      case 'REJECTED':
        return 'bg-red-500/15 text-red-300';
      default:
        return 'bg-hos-bg-tertiary text-hos-text-secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-hos-gold mb-2">Stock Transfers</h1>
              <p className="text-hos-text-secondary">Manage stock transfers between warehouses</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-hos-gold hover:bg-hos-gold text-[#1a1406] px-6 py-2 rounded-lg font-medium transition-colors"
            >
              + Create Transfer
            </button>
          </div>

          {/* Filters */}
          <div className="bg-hos-bg-secondary rounded-lg shadow p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters({ ...filters, status: e.target.value });
                    setTimeout(() => fetchTransfers(), 100);
                  }}
                  className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
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
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">From Warehouse</label>
                <select
                  value={filters.fromWarehouseId}
                  onChange={(e) => {
                    setFilters({ ...filters, fromWarehouseId: e.target.value });
                    setTimeout(() => fetchTransfers(), 100);
                  }}
                  className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
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
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">To Warehouse</label>
                <select
                  value={filters.toWarehouseId}
                  onChange={(e) => {
                    setFilters({ ...filters, toWarehouseId: e.target.value });
                    setTimeout(() => fetchTransfers(), 100);
                  }}
                  className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
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
                  className="w-full px-4 py-2 bg-hos-bg-tertiary hover:bg-hos-bg-tertiary rounded-md text-sm font-medium"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
              <p className="mt-4 text-hos-text-secondary">Loading transfers...</p>
            </div>
          ) : (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider text-center">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      From → To
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                  {transfers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-hos-text-muted">
                        No stock transfers found. Create your first transfer to get started.
                      </td>
                    </tr>
                  ) : (
                    transfers.map((transfer) => (
                      <tr key={transfer.id} className="hover:bg-hos-bg-tertiary">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-hos-text-secondary">{transfer.product.name}</div>
                          {transfer.product.sku && (
                            <div className="text-sm text-hos-text-muted">SKU: {transfer.product.sku}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-hos-text-secondary">
                            {transfer.fromWarehouse.name} ({transfer.fromWarehouse.code})
                          </div>
                          <div className="text-sm text-hos-text-muted">→</div>
                          <div className="text-sm text-hos-text-secondary">
                            {transfer.toWarehouse.name} ({transfer.toWarehouse.code})
                          </div>
                        </td>
                        <td className="text-right px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-hos-text-secondary">{transfer.quantity}</span>
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {formatDate(transfer.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {transfer.status === 'PENDING' && (
                            <button
                              onClick={() => handleCompleteTransfer(transfer.id)}
                              className="text-hos-gold hover:text-hos-gold mr-4"
                            >
                              Complete
                            </button>
                          )}
                          {transfer.status === 'COMPLETED' && transfer.completedAt && (
                            <span className="text-sm text-hos-text-muted">
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
                    <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-hos-bg-secondary p-6 text-left align-middle shadow-xl transition-all">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-hos-text-secondary mb-4"
                      >
                        Create Stock Transfer
                      </Dialog.Title>

                      <form onSubmit={handleCreateTransfer} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            From Warehouse *
                          </label>
                          <select
                            required
                            value={formData.fromWarehouseId}
                            onChange={(e) => setFormData({ ...formData, fromWarehouseId: e.target.value, productId: '' })}
                            className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
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
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            To Warehouse *
                          </label>
                          <select
                            required
                            value={formData.toWarehouseId}
                            onChange={(e) => setFormData({ ...formData, toWarehouseId: e.target.value })}
                            className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
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
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            Product *
                          </label>
                          <select
                            required
                            value={formData.productId}
                            onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                            disabled={!formData.fromWarehouseId}
                            className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50 disabled:bg-hos-bg-tertiary"
                          >
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku && `(${p.sku})`}
                                {p.available !== undefined && p.available !== '—'
                                  ? ` - Available: ${p.available}`
                                  : productsUsingFallback
                                    ? ' - Stock unknown'
                                    : ''}
                              </option>
                            ))}
                          </select>
                          {!formData.fromWarehouseId && (
                            <p className="mt-1 text-xs text-hos-text-muted">Select source warehouse first</p>
                          )}
                          {formData.fromWarehouseId && productsUsingFallback && products.length > 0 && (
                            <p className="mt-1 text-xs text-amber-400">
                              No stocked inventory found at source warehouse. Showing all active products — verify stock before transferring.
                            </p>
                          )}
                          {formData.fromWarehouseId && products.length === 0 && (
                            <p className="mt-1 text-xs text-hos-text-muted">No products available for this warehouse.</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
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
                            className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                            Notes (optional)
                          </label>
                          <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-hos-border rounded-md focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                            placeholder="Add any notes about this transfer..."
                          />
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                          <button
                            type="button"
                            onClick={() => setShowCreateModal(false)}
                            className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-md hover:bg-hos-bg-tertiary"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-sm font-medium text-[#1a1406] bg-hos-gold rounded-md hover:bg-hos-gold-hover disabled:opacity-50"
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
          </RouteGuard>
  );
}
