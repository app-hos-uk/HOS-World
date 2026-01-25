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

      // Calculate stats (simplified - would need more endpoints for accurate stats)
      setStats({
        totalWarehouses: warehouses.length,
        activeWarehouses,
        totalProducts: 0, // Would need products count endpoint
        lowStockProducts: 0, // Would need low stock alert endpoint
        totalStockValue: 0, // Would need inventory value calculation
        pendingTransfers: transfersData.length,
      });
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
    return new Date(dateString).toLocaleDateString('en-GB', {
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

  const getMovementTypeColor = (type: string) => {
    switch (type) {
      case 'IN':
        return 'text-green-600';
      case 'OUT':
        return 'text-red-600';
      case 'ADJUST':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-purple-900 mb-2">Inventory Dashboard</h1>
            <p className="text-gray-600">Overview of warehouses, stock transfers, and movements</p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
              <p className="mt-4 text-gray-600">Loading inventory data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-600 mb-1">Total Warehouses</div>
                  <div className="text-2xl font-bold text-purple-900">{stats?.totalWarehouses || 0}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-600 mb-1">Active Warehouses</div>
                  <div className="text-2xl font-bold text-green-600">{stats?.activeWarehouses || 0}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-600 mb-1">Pending Transfers</div>
                  <div className="text-2xl font-bold text-yellow-600">{stats?.pendingTransfers || 0}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-600 mb-1">Total Products</div>
                  <div className="text-2xl font-bold text-blue-600">{stats?.totalProducts || 'N/A'}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-600 mb-1">Low Stock Items</div>
                  <div className="text-2xl font-bold text-red-600">{stats?.lowStockProducts || 'N/A'}</div>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="text-sm text-gray-600 mb-1">Total Stock Value</div>
                  <div className="text-2xl font-bold text-purple-600">
                    £{stats?.totalStockValue?.toLocaleString() || 'N/A'}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Link
                    href="/admin/warehouses"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📦</div>
                    <div className="text-sm font-medium text-gray-900">Manage Warehouses</div>
                  </Link>
                  <Link
                    href="/admin/warehouses?action=transfer"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">🔄</div>
                    <div className="text-sm font-medium text-gray-900">Stock Transfers</div>
                  </Link>
                  <Link
                    href="/admin/inventory?tab=movements"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📊</div>
                    <div className="text-sm font-medium text-gray-900">Stock Movements</div>
                  </Link>
                  <Link
                    href="/admin/products"
                    className="p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-center"
                  >
                    <div className="text-2xl mb-2">📋</div>
                    <div className="text-sm font-medium text-gray-900">Product Inventory</div>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Transfers */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-gray-900">Pending Stock Transfers</h2>
                      <Link
                        href="/admin/warehouses?tab=transfers"
                        className="text-sm text-purple-600 hover:text-purple-900"
                      >
                        View All →
                      </Link>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {recentTransfers.length === 0 ? (
                      <div className="px-6 py-8 text-center text-gray-500 text-sm">
                        No pending transfers
                      </div>
                    ) : (
                      recentTransfers.map((transfer) => (
                        <div key={transfer.id} className="px-6 py-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {transfer.product.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {transfer.fromWarehouse.name} → {transfer.toWarehouse.name}
                              </div>
                              <div className="text-xs text-gray-500">
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
                              className="mt-2 text-xs text-purple-600 hover:text-purple-900 font-medium"
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
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-center">
                      <h2 className="text-lg font-semibold text-gray-900">Recent Stock Movements</h2>
                      <Link
                        href="/admin/inventory?tab=movements"
                        className="text-sm text-purple-600 hover:text-purple-900"
                      >
                        View All →
                      </Link>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {recentMovements.length === 0 ? (
                      <div className="px-6 py-8 text-center text-gray-500 text-sm">
                        No recent movements
                      </div>
                    ) : (
                      recentMovements.map((movement) => (
                        <div key={movement.id} className="px-6 py-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">
                                {movement.product.name}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {movement.inventoryLocation.warehouse.name} ({movement.inventoryLocation.warehouse.code})
                              </div>
                              <div className="text-xs text-gray-500">
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
                              <div className="text-xs text-gray-500 mt-1">{movement.movementType}</div>
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
