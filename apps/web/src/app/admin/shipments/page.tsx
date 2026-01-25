'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Shipment {
  id: string;
  orderId: string;
  order?: {
    id: string;
    orderNumber: string;
    customer?: { email: string; firstName?: string; lastName?: string };
    shippingAddress?: any;
  };
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: 'PENDING' | 'PICKED' | 'PACKED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
  estimatedDelivery?: string;
  actualDelivery?: string;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Stats {
  total: number;
  pending: number;
  inTransit: number;
  outForDelivery: number;
  delivered: number;
  failed: number;
  returned: number;
  avgDeliveryDays: number;
}

const STATUSES = [
  { value: 'PENDING', label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'PICKED', label: 'Picked', color: 'bg-blue-100 text-blue-800' },
  { value: 'PACKED', label: 'Packed', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'IN_TRANSIT', label: 'In Transit', color: 'bg-purple-100 text-purple-800' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-800' },
  { value: 'FAILED', label: 'Failed', color: 'bg-red-100 text-red-800' },
  { value: 'RETURNED', label: 'Returned', color: 'bg-gray-100 text-gray-800' },
];

export default function AdminShipmentsPage() {
  const toast = useToast();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modal
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Update form
  const [updateForm, setUpdateForm] = useState({
    status: '',
    trackingNumber: '',
    carrier: '',
    notes: '',
  });

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFulfillmentShipments();
      const data = response?.data || [];
      const shipmentList = Array.isArray(data) ? data : [];
      setShipments(shipmentList);
      calculateStats(shipmentList);
    } catch (err: any) {
      console.error('Error fetching shipments:', err);
      setError(err.message || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, []);

  const calculateStats = (shipmentList: Shipment[]) => {
    const delivered = shipmentList.filter(s => s.status === 'DELIVERED');
    let totalDays = 0;
    let countWithDelivery = 0;
    
    delivered.forEach(s => {
      if (s.actualDelivery && s.createdAt) {
        const days = Math.ceil((new Date(s.actualDelivery).getTime() - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0) {
          totalDays += days;
          countWithDelivery++;
        }
      }
    });

    setStats({
      total: shipmentList.length,
      pending: shipmentList.filter(s => ['PENDING', 'PICKED', 'PACKED'].includes(s.status)).length,
      inTransit: shipmentList.filter(s => s.status === 'IN_TRANSIT').length,
      outForDelivery: shipmentList.filter(s => s.status === 'OUT_FOR_DELIVERY').length,
      delivered: delivered.length,
      failed: shipmentList.filter(s => s.status === 'FAILED').length,
      returned: shipmentList.filter(s => s.status === 'RETURNED').length,
      avgDeliveryDays: countWithDelivery > 0 ? Math.round(totalDays / countWithDelivery) : 0,
    });
  };

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // Filtered and sorted shipments
  const filteredShipments = useMemo(() => {
    let filtered = [...shipments];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.id.toLowerCase().includes(term) ||
        s.orderId.toLowerCase().includes(term) ||
        s.order?.orderNumber?.toLowerCase().includes(term) ||
        s.trackingNumber?.toLowerCase().includes(term) ||
        s.order?.customer?.email?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    // Carrier filter
    if (carrierFilter !== 'ALL') {
      filtered = filtered.filter(s => s.carrier === carrierFilter);
    }

    // Date filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      let startDate: Date;
      switch (dateFilter) {
        case '1d':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(0);
      }
      filtered = filtered.filter(s => new Date(s.createdAt) >= startDate);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [shipments, searchTerm, statusFilter, carrierFilter, dateFilter, sortBy, sortOrder]);

  // Get unique carriers
  const carriers = useMemo(() => {
    const unique = new Set(shipments.map(s => s.carrier).filter(Boolean));
    return Array.from(unique);
  }, [shipments]);

  // Chart data
  const chartData = useMemo(() => {
    return STATUSES.map(s => ({
      name: s.label,
      count: shipments.filter(sh => sh.status === s.value).length,
    }));
  }, [shipments]);

  const handleViewDetails = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setShowDetailModal(true);
  };

  const handleUpdateClick = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setUpdateForm({
      status: shipment.status,
      trackingNumber: shipment.trackingNumber || '',
      carrier: shipment.carrier || '',
      notes: shipment.notes || '',
    });
    setShowUpdateModal(true);
  };

  const handleUpdateShipment = async () => {
    if (!selectedShipment) return;
    
    try {
      setActionLoading(true);
      await apiClient.updateFulfillmentShipment(selectedShipment.id, {
        status: updateForm.status,
        trackingNumber: updateForm.trackingNumber || undefined,
        carrier: updateForm.carrier || undefined,
        notes: updateForm.notes || undefined,
      });
      toast.success('Shipment updated successfully');
      setShowUpdateModal(false);
      fetchShipments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update shipment');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = STATUSES.find(s => s.value === status) || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>;
  };

  const exportColumns = [
    { key: 'id', header: 'Shipment ID', format: (v: string) => v.substring(0, 8) },
    { key: 'order', header: 'Order', format: (v: any) => v?.orderNumber || '' },
    { key: 'carrier', header: 'Carrier' },
    { key: 'trackingNumber', header: 'Tracking Number' },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Created', format: (v: string) => new Date(v).toLocaleDateString() },
    { key: 'estimatedDelivery', header: 'Est. Delivery', format: (v: string) => v ? new Date(v).toLocaleDateString() : '' },
    { key: 'actualDelivery', header: 'Delivered', format: (v: string) => v ? new Date(v).toLocaleDateString() : '' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FULFILLMENT']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
              <p className="text-gray-600 mt-1">Track and manage order shipments</p>
            </div>
            <DataExport data={filteredShipments} columns={exportColumns} filename="shipments-export" />
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'ALL' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'PENDING' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Pending</p>
                <p className="text-xl font-bold text-yellow-600">{stats.pending}</p>
              </button>
              <button
                onClick={() => setStatusFilter('IN_TRANSIT')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'IN_TRANSIT' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">In Transit</p>
                <p className="text-xl font-bold text-purple-600">{stats.inTransit}</p>
              </button>
              <button
                onClick={() => setStatusFilter('OUT_FOR_DELIVERY')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'OUT_FOR_DELIVERY' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Out for Delivery</p>
                <p className="text-xl font-bold text-cyan-600">{stats.outForDelivery}</p>
              </button>
              <button
                onClick={() => setStatusFilter('DELIVERED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'DELIVERED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Delivered</p>
                <p className="text-xl font-bold text-green-600">{stats.delivered}</p>
              </button>
              <button
                onClick={() => setStatusFilter('FAILED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'FAILED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Failed</p>
                <p className="text-xl font-bold text-red-600">{stats.failed}</p>
              </button>
              <button
                onClick={() => setStatusFilter('RETURNED')}
                className={`bg-white rounded-lg shadow p-3 text-left hover:shadow-md ${statusFilter === 'RETURNED' ? 'ring-2 ring-purple-500' : ''}`}
              >
                <p className="text-xs text-gray-500">Returned</p>
                <p className="text-xl font-bold text-gray-600">{stats.returned}</p>
              </button>
              <div className="bg-white rounded-lg shadow p-3">
                <p className="text-xs text-gray-500">Avg Delivery</p>
                <p className="text-xl font-bold text-blue-600">{stats.avgDeliveryDays}d</p>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Shipments by Status</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchShipments} className="mt-2 text-red-600 hover:text-red-800 text-sm">Retry</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Order, tracking, customer..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Status</option>
                  {STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                <select
                  value={carrierFilter}
                  onChange={(e) => setCarrierFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Carriers</option>
                  {carriers.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="ALL">All Time</option>
                  <option value="1d">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Shipments Table */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Shipments ({filteredShipments.length})</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredShipments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          No shipments found
                        </td>
                      </tr>
                    ) : (
                      filteredShipments.map((shipment) => (
                        <tr key={shipment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            {shipment.id.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">
                              {shipment.order?.orderNumber || shipment.orderId.substring(0, 8)}
                            </div>
                            {shipment.order?.customer && (
                              <div className="text-xs text-gray-500">{shipment.order.customer.email}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {shipment.carrier || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            {shipment.trackingNumber ? (
                              <div>
                                <span className="text-sm font-mono">{shipment.trackingNumber}</span>
                                {shipment.trackingUrl && (
                                  <a
                                    href={shipment.trackingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-2 text-xs text-purple-600 hover:underline"
                                  >
                                    Track
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">Not available</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(shipment.status)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(shipment.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleViewDetails(shipment)}
                                className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleUpdateClick(shipment)}
                                className="px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded"
                              >
                                Update
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detail Modal */}
          {showDetailModal && selectedShipment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">Shipment Details</h2>
                      <p className="text-sm text-gray-500">ID: {selectedShipment.id}</p>
                    </div>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-6">
                    {/* Status */}
                    <div className="flex items-center gap-4">
                      <div className="text-lg font-medium">Status:</div>
                      {getStatusBadge(selectedShipment.status)}
                    </div>

                    {/* Order Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold mb-2">Order Information</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Order ID</p>
                          <p className="font-medium">{selectedShipment.order?.orderNumber || selectedShipment.orderId}</p>
                        </div>
                        {selectedShipment.order?.customer && (
                          <div>
                            <p className="text-gray-500">Customer</p>
                            <p className="font-medium">{selectedShipment.order.customer.email}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tracking Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Carrier</p>
                        <p className="font-medium">{selectedShipment.carrier || 'Not assigned'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Tracking Number</p>
                        <p className="font-medium font-mono">{selectedShipment.trackingNumber || 'Not available'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Created</p>
                        <p className="font-medium">{new Date(selectedShipment.createdAt).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Est. Delivery</p>
                        <p className="font-medium">{selectedShipment.estimatedDelivery ? new Date(selectedShipment.estimatedDelivery).toLocaleDateString() : 'N/A'}</p>
                      </div>
                      {selectedShipment.actualDelivery && (
                        <div>
                          <p className="text-sm text-gray-500">Delivered</p>
                          <p className="font-medium text-green-600">{new Date(selectedShipment.actualDelivery).toLocaleString()}</p>
                        </div>
                      )}
                      {selectedShipment.weight && (
                        <div>
                          <p className="text-sm text-gray-500">Weight</p>
                          <p className="font-medium">{selectedShipment.weight} kg</p>
                        </div>
                      )}
                    </div>

                    {selectedShipment.notes && (
                      <div>
                        <p className="text-sm text-gray-500">Notes</p>
                        <p className="text-gray-700">{selectedShipment.notes}</p>
                      </div>
                    )}

                    {selectedShipment.trackingUrl && (
                      <a
                        href={selectedShipment.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Track Shipment
                      </a>
                    )}

                    <div className="flex gap-2 pt-4 border-t">
                      <button
                        onClick={() => { setShowDetailModal(false); handleUpdateClick(selectedShipment); }}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Update Shipment
                      </button>
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Update Modal */}
          {showUpdateModal && selectedShipment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-bold">Update Shipment</h2>
                    <button onClick={() => setShowUpdateModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={updateForm.status}
                        onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        {STATUSES.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
                      <input
                        type="text"
                        value={updateForm.carrier}
                        onChange={(e) => setUpdateForm({ ...updateForm, carrier: e.target.value })}
                        placeholder="e.g., Royal Mail, DHL, UPS"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tracking Number</label>
                      <input
                        type="text"
                        value={updateForm.trackingNumber}
                        onChange={(e) => setUpdateForm({ ...updateForm, trackingNumber: e.target.value })}
                        placeholder="Enter tracking number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={updateForm.notes}
                        onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Add any notes..."
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleUpdateShipment}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {actionLoading ? 'Updating...' : 'Update'}
                      </button>
                      <button
                        onClick={() => setShowUpdateModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
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
