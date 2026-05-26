'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

type PayoutStatus = 'ALL' | 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-500/15 text-yellow-300',
  PROCESSING: 'bg-hos-gold/20 text-hos-gold',
  PAID: 'bg-green-500/15 text-green-300',
  FAILED: 'bg-red-500/15 text-red-300',
};

export default function FinancePayoutsPage() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PayoutStatus>('ALL');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ sellerId: '', amount: '' });
  const [scheduling, setScheduling] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const menuItems = [
    { title: 'Dashboard', href: '/finance/dashboard', icon: '📊' },
    { title: 'Pricing Approvals', href: '/finance/pricing', icon: '💰' },
    { title: 'Payouts', href: '/finance/payouts', icon: '💸' },
    { title: 'Revenue Reports', href: '/finance/reports/revenue', icon: '📊' },
    { title: 'Fee Reports', href: '/finance/reports/fees', icon: '📋' },
  ];

  const extractPayoutsList = (response: any): any[] => {
    if (!response?.data) return [];
    const d = response.data;
    if (Array.isArray(d)) return d;
    // API returns getTransactions() shape: { transactions, balances, pagination }
    if (d?.transactions && Array.isArray(d.transactions)) return d.transactions;
    if (d?.payouts && Array.isArray(d.payouts)) return d.payouts;
    return [];
  };

  const fetchPayouts = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getPayouts();
      // Only replace payouts when the API returned a valid payload; preserve existing data on empty/null response (e.g. refresh failures)
      if (response?.data != null) {
        setPayouts(extractPayoutsList(response));
      }
      if (!response?.data && showLoading) {
        setError('Failed to load payouts');
      }
    } catch (err: any) {
      console.error('Error fetching payouts:', err);
      if (showLoading) {
        setError(err.message || 'Failed to load payouts');
        toast.error(err.message || 'Failed to load payouts');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayouts(true);
  }, [fetchPayouts]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchPayouts(false);
    };
    const interval = setInterval(() => fetchPayouts(false), 60_000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchPayouts]);

  const payoutList = Array.isArray(payouts) ? payouts : [];
  const filteredPayouts =
    activeTab === 'ALL'
      ? payoutList
      : payoutList.filter((p) => p.status === activeTab);

  const handleSchedulePayout = async () => {
    if (!scheduleForm.sellerId.trim()) {
      toast.error('Seller ID is required');
      return;
    }
    const amount = parseFloat(scheduleForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    try {
      setScheduling(true);
      await apiClient.schedulePayout({
        sellerId: scheduleForm.sellerId.trim(),
        amount,
      });
      toast.success('Payout scheduled successfully');
      setShowScheduleModal(false);
      setScheduleForm({ sellerId: '', amount: '' });
      await fetchPayouts(true);
    } catch (err: any) {
      console.error('Error scheduling payout:', err);
      toast.error(err.message || 'Failed to schedule payout');
    } finally {
      setScheduling(false);
    }
  };

  const handleProcessPayout = async (id: string) => {
    try {
      setProcessingId(id);
      await apiClient.processPayout(id);
      toast.success('Payout processing initiated');
      await fetchPayouts(true);
    } catch (err: any) {
      console.error('Error processing payout:', err);
      toast.error(err.message || 'Failed to process payout');
    } finally {
      setProcessingId(null);
    }
  };

  const tabs: PayoutStatus[] = ['ALL', 'PENDING', 'PROCESSING', 'PAID', 'FAILED'];

  return (
    <RouteGuard allowedRoles={['FINANCE', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout
        role="FINANCE"
        menuItems={menuItems}
        title="Finance"
        backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}
      >
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Process Payouts</h1>
            <p className="text-hos-text-secondary mt-2">Manage seller payouts and settlements</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchPayouts(true)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-bg-secondary border border-hos-border rounded-lg hover:bg-hos-bg-tertiary disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2 text-sm font-medium text-hos-text-secondary bg-hos-gold rounded-lg hover:bg-hos-gold-hover"
            >
              Schedule Payout
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const count =
              tab === 'ALL'
                ? payoutList.length
                : payoutList.filter((p) => p.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-secondary text-hos-text-secondary border border-hos-border hover:bg-hos-bg-tertiary'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()} ({count})
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/15 border border-red-400 text-red-400 rounded-lg">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-hos-bg-secondary border rounded-lg p-6 animate-pulse">
                <div className="flex justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-hos-bg-tertiary rounded w-1/3"></div>
                    <div className="h-3 bg-hos-bg-tertiary rounded w-1/4"></div>
                  </div>
                  <div className="h-6 w-20 bg-hos-bg-tertiary rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filteredPayouts.length === 0 && (
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-12 text-center">
            <div className="text-4xl mb-4">💸</div>
            <p className="text-hos-text-muted text-lg">No payouts found</p>
            <p className="text-sm text-hos-text-muted mt-2">
              {activeTab === 'ALL'
                ? 'Schedule a payout to get started. Need a seller UUID? Admin → Sellers → View → copy Seller ID.'
                : `No ${activeTab.toLowerCase()} payouts`}
            </p>
          </div>
        )}

        {!loading && !error && filteredPayouts.length > 0 && (
          <div className="bg-hos-bg-secondary border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-hos-bg-secondary border-b">
                    <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border">
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-hos-bg-tertiary transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-hos-text-secondary">
                          {payout.seller?.storeName || payout.sellerName || 'Unknown Seller'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                          <p className="text-xs text-hos-text-muted font-mono">
                            Seller ID: {payout.sellerId || '—'}
                          </p>
                          {payout.sellerId && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(payout.sellerId);
                                  toast.success('Seller ID copied');
                                } catch {
                                  toast.error('Could not copy');
                                }
                              }}
                              className="text-xs font-medium text-hos-gold hover:text-hos-gold-hover"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-hos-text-secondary">
                          ${(payout.amount || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            STATUS_STYLES[payout.status] || 'bg-hos-bg-tertiary text-hos-text-secondary'
                          }`}
                        >
                          {payout.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {new Date(payout.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {payout.status === 'PENDING' && (
                          <button
                            onClick={() => handleProcessPayout(payout.id)}
                            disabled={processingId === payout.id}
                            className="px-3 py-1.5 text-xs font-medium text-hos-text-secondary bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {processingId === payout.id ? 'Processing...' : 'Process'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Schedule Payout Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-hos-bg-secondary rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-xl font-bold">Schedule Payout</h2>
                  <button
                    onClick={() => {
                      setShowScheduleModal(false);
                      setScheduleForm({ sellerId: '', amount: '' });
                    }}
                    className="text-hos-text-muted hover:text-hos-text-secondary"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Seller ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={scheduleForm.sellerId}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, sellerId: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent font-mono text-sm"
                      placeholder="Paste seller profile UUID"
                    />
                    <p className="text-xs text-hos-text-muted mt-1.5">
                      Find it under <span className="font-medium">Admin → Sellers</span>, open{' '}
                      <span className="font-medium">View</span>, then copy <span className="font-medium">Seller ID</span>.
                      After payouts exist, it also appears in the table below as &quot;Seller ID&quot;.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                      Amount ($) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={scheduleForm.amount}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, amount: e.target.value }))
                      }
                      min="0"
                      step="0.01"
                      className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
                      placeholder="Enter payout amount"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSchedulePayout}
                    disabled={scheduling || !scheduleForm.sellerId.trim() || !scheduleForm.amount}
                    className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
                  >
                    {scheduling ? 'Scheduling...' : 'Schedule Payout'}
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleModal(false);
                      setScheduleForm({ sellerId: '', amount: '' });
                    }}
                    disabled={scheduling}
                    className="px-4 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}
