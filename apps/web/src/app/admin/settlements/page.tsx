'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { DataExport } from '@/components/DataExport';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Settlement {
  id: string;
  sellerId: string;
  seller?: {
    id: string;
    storeName: string;
    email: string;
    bankDetails?: any;
  };
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED';
  periodStart: string;
  periodEnd: string;
  ordersCount: number;
  platformFee: number;
  netAmount: number;
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

interface Stats {
  totalSettlements: number;
  pendingCount: number;
  pendingAmount: number;
  processingCount: number;
  processingAmount: number;
  paidThisMonth: number;
  paidThisMonthAmount: number;
  failedCount: number;
  totalPlatformFees: number;
  avgSettlementAmount: number;
}

export default function AdminSettlementsPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedSettlements, setSelectedSettlements] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'seller'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Create settlement form
  const [sellers, setSellers] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState({
    sellerId: '',
    periodStart: '',
    periodEnd: '',
  });

  const fetchSettlements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getSettlements();
      const data: any = response?.data;
      const settlementList = Array.isArray(data) ? data : (data?.data || []);
      setSettlements(settlementList);
      calculateStats(settlementList);
    } catch (err: any) {
      console.error('Error fetching settlements:', err);
      setError(err.message || 'Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSellers = useCallback(async () => {
    try {
      const response = await apiClient.getUsers();
      const raw = response?.data as { data?: unknown[] } | unknown[] | undefined;
      const userData = Array.isArray(raw) ? raw : (raw as { data?: unknown[] })?.data ?? [];
      const users = Array.isArray(userData) ? userData : [];
      const sellerRoles = ['SELLER', 'B2C_SELLER', 'WHOLESALER'];
      setSellers(users.filter((u: any) => sellerRoles.includes(u.role)));
    } catch {
      setSellers([]);
    }
  }, []);

  const calculateStats = (settlementList: Settlement[]) => {
    const pending = settlementList.filter(s => s.status === 'PENDING');
    const processing = settlementList.filter(s => s.status === 'PROCESSING');
    const failed = settlementList.filter(s => s.status === 'FAILED');
    
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const paidThisMonth = settlementList.filter(s => 
      s.status === 'PAID' && s.paidAt && new Date(s.paidAt) >= thisMonth
    );
    
    const totalFees = settlementList.reduce((sum, s) => sum + (s.platformFee || 0), 0);
    const avgAmount = settlementList.length > 0 
      ? settlementList.reduce((sum, s) => sum + (s.amount || 0), 0) / settlementList.length 
      : 0;

    setStats({
      totalSettlements: settlementList.length,
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, s) => sum + (s.netAmount || 0), 0),
      processingCount: processing.length,
      processingAmount: processing.reduce((sum, s) => sum + (s.netAmount || 0), 0),
      paidThisMonth: paidThisMonth.length,
      paidThisMonthAmount: paidThisMonth.reduce((sum, s) => sum + (s.netAmount || 0), 0),
      failedCount: failed.length,
      totalPlatformFees: totalFees,
      avgSettlementAmount: avgAmount,
    });
  };

  useEffect(() => {
    fetchSettlements();
    fetchSellers();
  }, [fetchSettlements, fetchSellers]);

  // Filtered and sorted settlements
  const filteredSettlements = useMemo(() => {
    let filtered = [...settlements];

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.seller?.storeName?.toLowerCase().includes(term) ||
        s.seller?.email?.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) ||
        s.paymentReference?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(s => s.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      let startDate: Date;
      switch (dateFilter) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
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
        case 'amount':
          comparison = (a.netAmount || 0) - (b.netAmount || 0);
          break;
        case 'seller':
          comparison = (a.seller?.storeName || '').localeCompare(b.seller?.storeName || '');
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [settlements, searchTerm, statusFilter, dateFilter, sortBy, sortOrder]);

  // Chart data
  const chartData = useMemo(() => {
    const last30Days: Record<string, { date: string; amount: number; count: number }> = {};
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last30Days[dateStr] = { date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), amount: 0, count: 0 };
    }
    
    settlements
      .filter(s => s.status === 'PAID' && s.paidAt)
      .forEach(s => {
        const dateStr = new Date(s.paidAt!).toISOString().split('T')[0];
        if (last30Days[dateStr]) {
          last30Days[dateStr].amount += s.netAmount || 0;
          last30Days[dateStr].count += 1;
        }
      });
    
    return Object.values(last30Days);
  }, [settlements]);

  const handleViewDetails = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
    setShowDetailModal(true);
  };

  const handleProcessSettlement = async (settlementId: string) => {
    try {
      setProcessing(true);
      await apiClient.processSettlement(settlementId);
      toast.success('Settlement processing started');
      fetchSettlements();
      setShowDetailModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to process settlement');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkAsPaid = async (settlementId: string, paymentReference: string) => {
    try {
      setProcessing(true);
      await apiClient.markSettlementPaid(settlementId, { paymentReference });
      toast.success('Settlement marked as paid');
      fetchSettlements();
      setShowDetailModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark as paid');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelSettlement = async (settlementId: string, reason: string) => {
    if (!confirm('Are you sure you want to cancel this settlement?')) return;
    try {
      setProcessing(true);
      await apiClient.cancelSettlement(settlementId, { reason });
      toast.success('Settlement cancelled');
      fetchSettlements();
      setShowDetailModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel settlement');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateSettlement = async () => {
    if (!createForm.sellerId || !createForm.periodStart || !createForm.periodEnd) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      setProcessing(true);
      await apiClient.createSettlement({
        sellerId: createForm.sellerId,
        periodStart: createForm.periodStart,
        periodEnd: createForm.periodEnd,
      });
      toast.success('Settlement created successfully');
      setShowCreateModal(false);
      setCreateForm({ sellerId: '', periodStart: '', periodEnd: '' });
      fetchSettlements();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create settlement');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkProcess = async () => {
    if (selectedSettlements.size === 0) return;
    if (!confirm(`Process ${selectedSettlements.size} settlements?`)) return;

    let success = 0;
    for (const id of selectedSettlements) {
      try {
        await apiClient.processSettlement(id);
        success++;
      } catch {
        // Continue on error
      }
    }
    toast.success(`Processed ${success} settlements`);
    setSelectedSettlements(new Set());
    fetchSettlements();
  };

  const toggleSelection = (id: string) => {
    setSelectedSettlements(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPending = () => {
    const pendingIds = filteredSettlements.filter(s => s.status === 'PENDING').map(s => s.id);
    setSelectedSettlements(new Set(pendingIds));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2 py-0.5 text-xs rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };

  const exportColumns = [
    { key: 'id', header: 'Settlement ID' },
    { key: 'seller', header: 'Seller', format: (v: any) => v?.storeName || '' },
    { key: 'netAmount', header: 'Net Amount', format: (v: number, r: Settlement) => `${r.currency || 'GBP'} ${Number(v).toFixed(2)}` },
    { key: 'platformFee', header: 'Platform Fee', format: (v: number, r: Settlement) => `${r.currency || 'GBP'} ${Number(v).toFixed(2)}` },
    { key: 'status', header: 'Status' },
    { key: 'periodStart', header: 'Period Start', format: (v: string) => new Date(v).toLocaleDateString() },
    { key: 'periodEnd', header: 'Period End', format: (v: string) => new Date(v).toLocaleDateString() },
    { key: 'paidAt', header: 'Paid Date', format: (v: string) => v ? new Date(v).toLocaleDateString() : '' },
  ];

  if (loading) {
    return (
      <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Settlements</h1>
              <p className="text-gray-600 mt-1">Manage seller payouts and settlements</p>
            </div>
            <div className="flex gap-2">
              <DataExport data={filteredSettlements} columns={exportColumns} filename="settlements-export" />
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                + Create Settlement
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</p>
                <p className="text-xs text-gray-500">{formatPrice(stats.pendingAmount)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-blue-600">{stats.processingCount}</p>
                <p className="text-xs text-gray-500">{formatPrice(stats.processingAmount)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Paid This Month</p>
                <p className="text-2xl font-bold text-green-600">{stats.paidThisMonth}</p>
                <p className="text-xs text-gray-500">{formatPrice(stats.paidThisMonthAmount)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failedCount}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600">Platform Fees (Total)</p>
                <p className="text-2xl font-bold text-purple-600">{formatPrice(stats.totalPlatformFees)}</p>
              </div>
            </div>
          )}

          {/* Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payouts (Last 30 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `£${v}`} />
                  <Tooltip formatter={(value: number) => [`£${value.toFixed(2)}`, 'Amount']} />
                  <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">Error: {error}</p>
              <button onClick={fetchSettlements} className="mt-2 text-red-600 hover:text-red-800 text-sm">Retry</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by seller, ID, or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="PROCESSING">Processing</option>
                <option value="PAID">Paid</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ALL">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="amount-desc">Highest Amount</option>
                <option value="amount-asc">Lowest Amount</option>
                <option value="seller-asc">Seller A-Z</option>
              </select>
            </div>

            {/* Bulk Actions */}
            {selectedSettlements.size > 0 && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                <span className="text-sm text-gray-600">{selectedSettlements.size} selected</span>
                <button
                  onClick={handleBulkProcess}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                >
                  Process Selected
                </button>
                <button onClick={() => setSelectedSettlements(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Settlements Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Settlements ({filteredSettlements.length})</h2>
              <button onClick={selectAllPending} className="text-sm text-purple-600 hover:text-purple-800">
                Select All Pending
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      <input
                        type="checkbox"
                        checked={selectedSettlements.size === filteredSettlements.filter(s => s.status === 'PENDING').length && filteredSettlements.filter(s => s.status === 'PENDING').length > 0}
                        onChange={() => selectedSettlements.size > 0 ? setSelectedSettlements(new Set()) : selectAllPending()}
                        className="rounded border-gray-300 text-purple-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gross</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fees</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                        No settlements found
                      </td>
                    </tr>
                  ) : (
                    filteredSettlements.map((settlement) => (
                      <tr key={settlement.id} className={`hover:bg-gray-50 ${selectedSettlements.has(settlement.id) ? 'bg-purple-50' : ''}`}>
                        <td className="px-4 py-3">
                          {settlement.status === 'PENDING' && (
                            <input
                              type="checkbox"
                              checked={selectedSettlements.has(settlement.id)}
                              onChange={() => toggleSelection(settlement.id)}
                              className="rounded border-gray-300 text-purple-600"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{settlement.seller?.storeName || 'Unknown'}</div>
                          <div className="text-xs text-gray-500">{settlement.seller?.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(settlement.periodStart).toLocaleDateString()} - {new Date(settlement.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{settlement.ordersCount}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{formatPrice(settlement.amount)}</td>
                        <td className="px-4 py-3 text-sm text-red-600">-{formatPrice(settlement.platformFee)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-green-600">{formatPrice(settlement.netAmount)}</td>
                        <td className="px-4 py-3">{getStatusBadge(settlement.status)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleViewDetails(settlement)}
                              className="px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded"
                            >
                              View
                            </button>
                            {settlement.status === 'PENDING' && (
                              <button
                                onClick={() => handleProcessSettlement(settlement.id)}
                                className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                              >
                                Process
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detail Modal */}
          {showDetailModal && selectedSettlement && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-2xl font-bold">Settlement Details</h2>
                      <p className="text-sm text-gray-500 mt-1">ID: {selectedSettlement.id}</p>
                    </div>
                    <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                  </div>

                  <div className="space-y-6">
                    {/* Seller Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Seller Information</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Store Name</p>
                          <p className="font-medium">{selectedSettlement.seller?.storeName || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Email</p>
                          <p className="font-medium">{selectedSettlement.seller?.email || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Settlement Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Period</p>
                        <p className="font-medium">
                          {new Date(selectedSettlement.periodStart).toLocaleDateString()} - {new Date(selectedSettlement.periodEnd).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Orders</p>
                        <p className="font-medium">{selectedSettlement.ordersCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Gross Amount</p>
                        <p className="font-medium">{formatPrice(selectedSettlement.amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Platform Fee</p>
                        <p className="font-medium text-red-600">-{formatPrice(selectedSettlement.platformFee)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Net Amount</p>
                        <p className="text-xl font-bold text-green-600">{formatPrice(selectedSettlement.netAmount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <div className="mt-1">{getStatusBadge(selectedSettlement.status)}</div>
                      </div>
                    </div>

                    {selectedSettlement.paymentReference && (
                      <div>
                        <p className="text-sm text-gray-500">Payment Reference</p>
                        <p className="font-medium">{selectedSettlement.paymentReference}</p>
                      </div>
                    )}

                    {selectedSettlement.paidAt && (
                      <div>
                        <p className="text-sm text-gray-500">Paid At</p>
                        <p className="font-medium">{new Date(selectedSettlement.paidAt).toLocaleString()}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-4 border-t">
                      {selectedSettlement.status === 'PENDING' && (
                        <button
                          onClick={() => handleProcessSettlement(selectedSettlement.id)}
                          disabled={processing}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {processing ? 'Processing...' : 'Start Processing'}
                        </button>
                      )}
                      {selectedSettlement.status === 'PROCESSING' && (
                        <button
                          onClick={() => {
                            const ref = prompt('Enter payment reference:');
                            if (ref) handleMarkAsPaid(selectedSettlement.id, ref);
                          }}
                          disabled={processing}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          Mark as Paid
                        </button>
                      )}
                      {['PENDING', 'PROCESSING'].includes(selectedSettlement.status) && (
                        <button
                          onClick={() => {
                            const reason = prompt('Enter cancellation reason:');
                            if (reason) handleCancelSettlement(selectedSettlement.id, reason);
                          }}
                          disabled={processing}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
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

          {/* Create Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-md w-full p-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-xl font-bold">Create Settlement</h2>
                  <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seller *</label>
                    <select
                      value={createForm.sellerId}
                      onChange={(e) => setCreateForm({ ...createForm, sellerId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select a seller</option>
                      {sellers.map(s => (
                        <option key={s.id} value={s.id}>{s.storeName || s.email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Period Start *</label>
                      <input
                        type="date"
                        value={createForm.periodStart}
                        onChange={(e) => setCreateForm({ ...createForm, periodStart: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Period End *</label>
                      <input
                        type="date"
                        value={createForm.periodEnd}
                        onChange={(e) => setCreateForm({ ...createForm, periodEnd: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCreateSettlement}
                      disabled={processing}
                      className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {processing ? 'Creating...' : 'Create Settlement'}
                    </button>
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
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
