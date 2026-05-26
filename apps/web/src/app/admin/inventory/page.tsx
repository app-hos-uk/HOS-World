'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface InventoryStats {
  totalWarehouses: number;
  activeWarehouses: number;
  totalProducts: number;
  lowStockProducts: number;
  totalStockValue: number;
  pendingTransfers: number;
}

interface RecentTransfer {
  id: string;
  fromWarehouse: { name: string; code: string };
  toWarehouse: { name: string; code: string };
  product: { name: string; sku?: string };
  quantity: number;
  status: string;
  createdAt: string;
}

interface RecentMovement {
  id: string;
  inventoryLocation: {
    warehouse: { name: string; code: string };
  };
  product: { name: string; sku?: string };
  quantity: number;
  movementType: string;
  referenceType?: string;
  createdAt: string;
}

export default function AdminInventoryDashboardPage() {
  const toast = useToast();
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [recentTransfers, setRecentTransfers] = useState<RecentTransfer[]>([]);
  const [recentMovements, setRecentMovements] = useState<RecentMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch warehouses for stats
      const warehousesRes = await apiClient.getWarehouses();
      const warehouses = warehousesRes?.data || [];
      const activeWarehouses = warehouses.filter((w: any) => w.isActive).length;

      // Fetch recent transfers
      const transfersRes = await apiClient.getStockTransfers({
        status: 'PENDING',
        page: 1,
        limit: 10,
      });
      const transfersData = transfersRes?.data?.transfers || [];
      setRecentTransfers(transfersData);

      // Fetch recent movements
      const movementsRes = await apiClient.getStockMovements({
        page: 1,
        limit: 10,
      });
      const movementsData = movementsRes?.data?.movements || [];
      setRecentMovements(movementsData);

      // Fetch inventory metrics for product stats
      try {
        const metricsRes = await apiClient.getInventoryMetrics();
        const metrics = metricsRes?.data || {};
        
        // Helper to safely convert to number, returning 0 for invalid values
        const safeNumber = (value: unknown): number => {
          if (value === null || value === undefined) return 0;
          const num = Number(value);
          return Number.isFinite(num) ? num : 0;
        };
        
        // Use totalProducts if it exists, otherwise fall back to totalQuantity
        // Check for field existence (not nullish) rather than truthiness to preserve 0 values
        const productCount = metrics.totalProducts !== undefined && metrics.totalProducts !== null
          ? safeNumber(metrics.totalProducts)
          : safeNumber(metrics.totalQuantity);
        
        setStats({
          totalWarehouses: warehouses.length,
          activeWarehouses,
          totalProducts: productCount,
          lowStockProducts: safeNumber(metrics.lowStockItems),
          totalStockValue: safeNumber(metrics.totalValue),
          pendingTransfers: transfersData.length,
        });
      } catch (metricsErr) {
        console.warn('Could not fetch inventory metrics, using defaults:', metricsErr);
        setStats({
          totalWarehouses: warehouses.length,
          activeWarehouses,
          totalProducts: 0,
          lowStockProducts: 0,
          totalStockValue: 0,
          pendingTransfers: transfersData.length,
        });
      }
    } catch (err: any) {
      console.error('Error fetching inventory dashboard data:', err);
      toast.error(err.message || 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteTransfer = async (transferId: string) => {
    try {
      await apiClient.completeStockTransfer(transferId);
      toast.success('Stock transfer completed successfully!');
      fetchDashboardData();
    } catch (err: any) {
      console.error('Error completing transfer:', err);
      toast.error(err.message || 'Failed to complete transfer');
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

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'IN':
        return 'text-green-400';
      case 'OUT':
        return 'text-red-400';
      case 'ADJUST':
        return 'text-orange-400';
      default:
        return 'text-hos-text-secondary';
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-hos-gold mb-2">Inventory Dashboard</h1>
            <p className="text-hos-text-secondary">Overview of warehouses, stock transfers, and movements</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
              <p className="mt-4 text-hos-text-secondary">Loading inventory data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                  <div className="text-sm text-hos-text-secondary mb-1">Total Warehouses</div>
                  <div className="text-2xl font-bold text-hos-gold">{stats?.totalWarehouses || 0}</div>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                  <div className="text-sm text-hos-text-secondary mb-1">Active Warehouses</div>
                  <div className="text-2xl font-bold text-green-400">{stats?.activeWarehouses || 0}</div>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                  <div className="text-sm text-hos-text-secondary mb-1">Pending Transfers</div>
                  <div className="text-2xl font-bold text-yellow-400">{stats?.pendingTransfers || 0}</div>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                  <div className="text-sm text-hos-text-secondary mb-1">Total Products</div>
                  <div className="text-2xl font-bold text-hos-gold">{(stats?.totalProducts ?? 0).toLocaleString()}</div>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                  <div className="text-sm text-hos-text-secondary mb-1">Low Stock Items</div>
                  <div className="text-2xl font-bold text-red-400">{(stats?.lowStockProducts ?? 0).toLocaleString()}</div>
                </div>
                <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                  <div className="text-sm text-hos-text-secondary mb-1">Total Stock Value</div>
                  <div className="text-2xl font-bold text-hos-gold">
                    ${(stats?.totalStockValue ?? 0).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-hos-text-secondary mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link
                    href="/admin/warehouses"
                    className="p-4 border border-hos-border rounded-lg hover:bg-hos-gold/10 hover:border-hos-border-accent transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📦</div>
                    <div className="text-sm font-medium text-hos-text-secondary">Manage Warehouses</div>
                  </Link>
                  <Link
                    href="/admin/warehouses?action=transfer"
                    className="p-4 border border-hos-border rounded-lg hover:bg-hos-gold/10 hover:border-hos-border-accent transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">🔄</div>
                    <div className="text-sm font-medium text-hos-text-secondary">Stock Transfers</div>
                  </Link>
                  <Link
                    href="/admin/inventory?tab=movements"
                    className="p-4 border border-hos-border rounded-lg hover:bg-hos-gold/10 hover:border-hos-border-accent transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📊</div>
                    <div className="text-sm font-medium text-hos-text-secondary">Stock Movements</div>
                  </Link>
                  <Link
                    href="/admin/products"
                    className="p-4 border border-hos-border rounded-lg hover:bg-hos-gold/10 hover:border-hos-border-accent transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📋</div>
                    <div className="text-sm font-medium text-hos-text-secondary">Product Inventory</div>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transfers */}
                <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-hos-border bg-hos-bg-secondary">
                    <div className="flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-hos-text-secondary">Pending Stock Transfers</h2>
                      <Link
                        href="/admin/warehouses?tab=transfers"
                        className="text-sm text-hos-gold hover:text-hos-gold"
                      >
                        View All →
                      </Link>
                    </div>
                  </div>
                  <div className="divide-y divide-hos-border">
                    {recentTransfers.length === 0 ? (
                      <div className="px-6 py-8 text-center text-hos-text-muted text-sm">
                        No pending transfers
                      </div>
                    ) : (
                      recentTransfers.map((transfer) => (
                        <div key={transfer.id} className="px-6 py-4 hover:bg-hos-bg-tertiary">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-hos-text-secondary">
                                {transfer.product.name}
                              </div>
                              <div className="text-xs text-hos-text-muted mt-1">
                                {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                              </div>
                              <div className="text-xs text-hos-text-muted">
                                Qty: {transfer.quantity} • {formatDate(transfer.createdAt)}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                                  transfer.status,
                                )}`}
                              >
                                {transfer.status}
                              </span>
                            </div>
                          </div>
                          {transfer.status === 'PENDING' && (
                            <button
                              onClick={() => handleCompleteTransfer(transfer.id)}
                              className="mt-2 text-xs text-hos-gold hover:text-hos-gold font-medium"
                            >
                              Complete Transfer →
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Stock Movements */}
                <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-hos-border bg-hos-bg-secondary">
                    <div className="flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-hos-text-secondary">Recent Stock Movements</h2>
                      <Link
                        href="/admin/inventory?tab=movements"
                        className="text-sm text-hos-gold hover:text-hos-gold"
                      >
                        View All →
                      </Link>
                    </div>
                  </div>
                  <div className="divide-y divide-hos-border">
                    {recentMovements.length === 0 ? (
                      <div className="px-6 py-8 text-center text-hos-text-muted text-sm">
                        No recent movements
                      </div>
                    ) : (
                      recentMovements.map((movement) => (
                        <div key={movement.id} className="px-6 py-4 hover:bg-hos-bg-tertiary">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-hos-text-secondary">
                                {movement.product.name}
                              </div>
                              <div className="text-xs text-hos-text-muted mt-1">
                                {movement.inventoryLocation.warehouse.name} ({movement.inventoryLocation.warehouse.code})
                              </div>
                              <div className="text-xs text-hos-text-muted">
                                {movement.referenceType && `${movement.referenceType} • `}
                                {formatDate(movement.createdAt)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`text-sm font-semibold ${getMovementTypeColor(movement.movementType)}`}
                              >
                                {movement.quantity > 0 ? '+' : ''}
                                {movement.quantity}
                              </div>
                              <div className="text-xs text-hos-text-muted mt-1">{movement.movementType}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
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
