'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

export default function AdminFinancePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'payouts' | 'refunds' | 'reports'>('overview');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [platformFeeRate, setPlatformFeeRate] = useState(0.15);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');

  const extractData = (response: any) => {
    if (!response?.data) return [];
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    // Transactions, payouts, and refunds endpoints all return { transactions } from getTransactions()
    if (data.transactions && Array.isArray(data.transactions)) return data.transactions;
    if (data.payouts && Array.isArray(data.payouts)) return data.payouts;
    if (data.refunds && Array.isArray(data.refunds)) return data.refunds;
    return [];
  };

  const safeTransactions = useMemo(() => Array.isArray(transactions) ? transactions : [], [transactions]);
  const safePayouts = useMemo(() => Array.isArray(payouts) ? payouts : [], [payouts]);
  const safeRefunds = useMemo(() => Array.isArray(refunds) ? refunds : [], [refunds]);

  // Note: toast is NOT included in deps because useToast() returns a new object each render
  // The toast methods themselves are stable; including toast would cause infinite re-fetches
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [txRes, payoutRes, refundRes, settingsRes] = await Promise.all([
        apiClient.getTransactions().catch(() => ({ data: [] })),
        apiClient.getPayouts().catch(() => ({ data: [] })),
        apiClient.getRefunds().catch(() => ({ data: [] })),
        apiClient.getSystemSettings().catch(() => null),
      ]);
      
      setTransactions(extractData(txRes));
      setPayouts(extractData(payoutRes));
      setRefunds(extractData(refundRes));
      const rate = settingsRes?.data?.platformFeeRate;
      if (typeof rate === 'number' && rate >= 0 && rate <= 1) {
        setPlatformFeeRate(rate);
      }
    } catch (err: any) {
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data for specific tab - takes tab as parameter to avoid stale closure
  // Note: toast excluded from deps (see comment above fetchAllData)
  const fetchDataForTab = useCallback(async (tab: 'transactions' | 'payouts' | 'refunds') => {
    try {
      setLoading(true);
      switch (tab) {
        case 'transactions': {
          const res = await apiClient.getTransactions();
          setTransactions(extractData(res));
          break;
        }
        case 'payouts': {
          const res = await apiClient.getPayouts();
          setPayouts(extractData(res));
          break;
        }
        case 'refunds': {
          const res = await apiClient.getRefunds();
          setRefunds(extractData(res));
          break;
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    // Only call fetchDataForTab for tabs that it handles (not overview or reports)
    if (activeTab !== 'overview' && activeTab !== 'reports') {
      fetchDataForTab(activeTab);
    }
  }, [activeTab, fetchDataForTab]);

  // Calculate financial metrics (guard: API may return { transactions } object)
  const metrics = useMemo(() => {
    const completedTx = safeTransactions.filter(tx => tx.status === 'COMPLETED');
    const totalRevenue = completedTx.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const pendingTx = safeTransactions.filter(tx => tx.status === 'PENDING');
    const pendingAmount = pendingTx.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const totalPayouts = safePayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalRefunds = safeRefunds.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const netRevenue = totalRevenue - totalRefunds;
    const platformFees = totalRevenue * platformFeeRate;

    return {
      totalRevenue,
      pendingAmount,
      totalPayouts,
      totalRefunds,
      netRevenue,
      platformFees,
      transactionCount: safeTransactions.length,
      avgTransactionValue: completedTx.length > 0 ? totalRevenue / completedTx.length : 0,
    };
  }, [safeTransactions, safePayouts, safeRefunds, platformFeeRate]);

  // Helper to format date as YYYY-MM-DD in LOCAL time (not UTC)
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Revenue chart data (last 30 days)
  const revenueChartData = useMemo(() => {
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      // Use local date format consistently to avoid timezone mismatches
      const dateStr = formatLocalDate(date);
      
      const dayTransactions = safeTransactions.filter(tx => {
        // Convert transaction date to local date string for consistent comparison
        const txDate = new Date(tx.createdAt);
        const txDateStr = formatLocalDate(txDate);
        return txDateStr === dateStr && tx.status === 'COMPLETED';
      });
      
      const dayRevenue = dayTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      
      data.push({
        date: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
        revenue: dayRevenue,
        transactions: dayTransactions.length,
      });
    }
    
    return data;
  }, [safeTransactions, dateRange]);

  // Transaction type breakdown
  const transactionTypeData = useMemo(() => {
    const types: Record<string, number> = {};
    safeTransactions.forEach(tx => {
      const type = tx.type || 'OTHER';
      types[type] = (types[type] || 0) + (Number(tx.amount) || 0);
    });
    
    return Object.entries(types).map(([name, value]) => ({ name, value }));
  }, [safeTransactions]);

  // Payment status breakdown
  const paymentStatusData = useMemo(() => {
    const statuses: Record<string, number> = {};
    safeTransactions.forEach(tx => {
      const status = tx.status || 'UNKNOWN';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [safeTransactions]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'transactions', label: 'Transactions', icon: '💳' },
    { id: 'payouts', label: 'Payouts', icon: '💰' },
    { id: 'refunds', label: 'Refunds', icon: '↩️' },
    { id: 'reports', label: 'Reports', icon: '📈' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-hos-text-secondary">Finance Dashboard</h1>
              <p className="text-hos-text-secondary mt-1">Monitor revenue, transactions, and payouts</p>
            </div>
            <div className="flex gap-2">
              <a
                href="/admin/cancellations"
                className="px-4 py-2 border border-hos-border rounded-lg text-sm font-medium text-hos-text-secondary hover:bg-hos-bg-tertiary"
              >
                Cancellation Queue
              </a>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-hos-border rounded-lg text-sm"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
          </div>

          <div className="border-b border-hos-border">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-hos-gold text-hos-gold'
                      : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary hover:border-hos-border'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold"></div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                      <h3 className="text-sm font-medium text-hos-text-muted mb-1">Total Revenue</h3>
                      <p className="text-3xl font-bold text-green-400">${metrics.totalRevenue.toFixed(2)}</p>
                      <p className="text-xs text-hos-text-muted mt-1">{metrics.transactionCount} transactions</p>
                    </div>
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                      <h3 className="text-sm font-medium text-hos-text-muted mb-1">Net Revenue</h3>
                      <p className="text-3xl font-bold text-hos-gold">${metrics.netRevenue.toFixed(2)}</p>
                      <p className="text-xs text-hos-text-muted mt-1">After refunds</p>
                    </div>
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                      <h3 className="text-sm font-medium text-hos-text-muted mb-1">Platform Fees</h3>
                      <p className="text-3xl font-bold text-hos-gold">${metrics.platformFees.toFixed(2)}</p>
                      <p className="text-xs text-hos-text-muted mt-1">5% commission</p>
                    </div>
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                      <h3 className="text-sm font-medium text-hos-text-muted mb-1">Pending</h3>
                      <p className="text-3xl font-bold text-yellow-400">${metrics.pendingAmount.toFixed(2)}</p>
                      <p className="text-xs text-hos-text-muted mt-1">Awaiting settlement</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                      <h3 className="text-sm font-medium text-hos-text-muted">Seller Payouts</h3>
                      <p className="text-xl font-bold text-hos-text-secondary mt-1">${metrics.totalPayouts.toFixed(2)}</p>
                    </div>
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                      <h3 className="text-sm font-medium text-hos-text-muted">Total Refunds</h3>
                      <p className="text-xl font-bold text-red-400 mt-1">${metrics.totalRefunds.toFixed(2)}</p>
                    </div>
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                      <h3 className="text-sm font-medium text-hos-text-muted">Avg Transaction</h3>
                      <p className="text-xl font-bold text-hos-text-secondary mt-1">
                        ${isNaN(metrics.avgTransactionValue) ? '0.00' : metrics.avgTransactionValue.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-4">
                      <h3 className="text-sm font-medium text-hos-text-muted">Refund Rate</h3>
                      <p className="text-xl font-bold text-hos-text-secondary mt-1">
                        {metrics.totalRevenue > 0 ? ((metrics.totalRefunds / metrics.totalRevenue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Revenue Chart */}
                  <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-hos-text-secondary mb-4">Revenue Trend</h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                          <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']} />
                          <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="#8b5cf680" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Transaction Types */}
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-hos-text-secondary mb-4">Revenue by Type</h3>
                      {transactionTypeData.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={transactionTypeData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {transactionTypeData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-hos-text-muted">
                          No transaction data available
                        </div>
                      )}
                    </div>

                    {/* Payment Status */}
                    <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
                      <h3 className="text-lg font-semibold text-hos-text-secondary mb-4">Transaction Status</h3>
                      {paymentStatusData.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={paymentStatusData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 flex items-center justify-center text-hos-text-muted">
                          No status data available
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'transactions' && (
                <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold">All Transactions</h3>
                    <DataExport
                      data={safeTransactions}
                      columns={[
                        { key: 'type', header: 'Type' },
                        { key: 'amount', header: 'Amount', format: (v: number, t: any) => `${t.currency || 'USD'} ${Number(v).toFixed(2)}` },
                        { key: 'status', header: 'Status' },
                        { key: 'createdAt', header: 'Date', format: (v: string) => new Date(v).toLocaleDateString() },
                      ]}
                      filename="transactions-export"
                    />
                  </div>
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                      {safeTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-hos-text-muted">No transactions found</td>
                        </tr>
                      ) : (
                        safeTransactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-hos-bg-tertiary">
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{tx.type}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {tx.currency || 'USD'} {Number(tx.amount).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                tx.status === 'COMPLETED' ? 'bg-green-500/15 text-green-300' :
                                tx.status === 'PENDING' ? 'bg-yellow-500/15 text-yellow-300' :
                                'bg-red-500/15 text-red-300'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'payouts' && (
                <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold">Seller Payouts</h3>
                    <DataExport
                      data={safePayouts}
                      columns={[
                        {
                          key: 'sellerId',
                          header: 'Seller',
                          format: (_v: string, p: any) =>
                            p?.seller?.storeName
                              ? `${p.seller.storeName} (${p.sellerId || ''})`
                              : p?.sellerId || '',
                        },
                        { key: 'amount', header: 'Amount', format: (v: number, p: any) => `${p.currency || 'USD'} ${Number(v).toFixed(2)}` },
                        { key: 'status', header: 'Status' },
                        { key: 'createdAt', header: 'Date', format: (v: string) => new Date(v).toLocaleDateString() },
                      ]}
                      filename="payouts-export"
                    />
                  </div>
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Seller</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                      {safePayouts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-hos-text-muted text-sm">
                            <p>No payouts found.</p>
                            <p className="mt-2 text-xs text-hos-text-muted max-w-md mx-auto">
                              Seller IDs appear here once payouts exist. For the first payout, open{' '}
                              <span className="font-medium text-hos-text-secondary">Admin → Sellers</span>,{' '}
                              <span className="font-medium text-hos-text-secondary">View</span> a seller, and copy{' '}
                              <span className="font-medium text-hos-text-secondary">Seller ID</span> into Finance → Schedule Payout.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        safePayouts.map((payout) => (
                          <tr key={payout.id} className="hover:bg-hos-bg-tertiary">
                            <td className="px-6 py-4 text-sm">
                              <p className="font-medium text-hos-text-secondary">
                                {payout.seller?.storeName || 'Unknown seller'}
                              </p>
                              <p className="text-xs text-hos-text-muted font-mono mt-0.5">
                                Seller ID: {payout.sellerId || '—'}
                              </p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {payout.currency || 'USD'} {Number(payout.amount).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                payout.status === 'PAID' ? 'bg-green-500/15 text-green-300' :
                                payout.status === 'PENDING' ? 'bg-yellow-500/15 text-yellow-300' :
                                'bg-red-500/15 text-red-300'
                              }`}>
                                {payout.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                              {new Date(payout.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'refunds' && (
                <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold">Refunds</h3>
                    <DataExport
                      data={safeRefunds}
                      columns={[
                        { key: 'orderId', header: 'Order' },
                        { key: 'amount', header: 'Amount', format: (v: number, r: any) => `${r.currency || 'USD'} ${Number(v).toFixed(2)}` },
                        { key: 'status', header: 'Status' },
                        { key: 'createdAt', header: 'Date', format: (v: string) => new Date(v).toLocaleDateString() },
                      ]}
                      filename="refunds-export"
                    />
                  </div>
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Order</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                      {safeRefunds.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-hos-text-muted">No refunds found</td>
                        </tr>
                      ) : (
                        safeRefunds.map((refund) => (
                          <tr key={refund.id} className="hover:bg-hos-bg-tertiary">
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{refund.orderId}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {refund.currency || 'USD'} {Number(refund.amount).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                refund.status === 'COMPLETED' ? 'bg-green-500/15 text-green-300' :
                                refund.status === 'PENDING' ? 'bg-yellow-500/15 text-yellow-300' :
                                'bg-red-500/15 text-red-300'
                              }`}>
                                {refund.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                              {new Date(refund.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'reports' && (
                <RevenueReportsTab />
              )}
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

function RevenueReportsTab() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const toast = useToast();

  // Note: toast is NOT included in deps because useToast() returns a new object each render
  // The toast methods themselves are stable; including toast would cause infinite re-fetches
  const fetchReport = useCallback(async (start: string, end: string) => {
    try {
      setLoading(true);
      const response = await apiClient.getRevenueReport(start, end);
      if (response?.data) {
        setReportData(response.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load revenue report');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReport(dateRange.startDate, dateRange.endDate);
  }, [dateRange.startDate, dateRange.endDate, fetchReport]);

  return (
    <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-lg font-semibold">Revenue Reports</h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border border-hos-border rounded-lg text-sm"
          />
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border border-hos-border rounded-lg text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold"></div>
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-hos-gold/10 rounded-lg p-4">
              <div className="text-sm text-hos-text-secondary">Total Revenue</div>
              <div className="text-2xl font-bold text-hos-gold">
                {reportData.totalRevenue ? `$${Number(reportData.totalRevenue).toFixed(2)}` : 'N/A'}
              </div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="text-sm text-hos-text-secondary">Platform Fees</div>
              <div className="text-2xl font-bold text-green-300">
                {reportData.platformFees ? `$${Number(reportData.platformFees).toFixed(2)}` : 'N/A'}
              </div>
            </div>
            <div className="bg-hos-gold/10 rounded-lg p-4">
              <div className="text-sm text-hos-text-secondary">Seller Payouts</div>
              <div className="text-2xl font-bold text-hos-gold">
                {reportData.sellerPayouts ? `$${Number(reportData.sellerPayouts).toFixed(2)}` : 'N/A'}
              </div>
            </div>
          </div>
          {reportData.breakdown && (
            <div className="bg-hos-bg-secondary rounded-lg p-4">
              <h3 className="font-semibold mb-2">Revenue Breakdown</h3>
              <pre className="text-xs overflow-auto">{JSON.stringify(reportData.breakdown, null, 2)}</pre>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-hos-text-muted py-8">No revenue data available for the selected period</div>
      )}
    </div>
  );
}
