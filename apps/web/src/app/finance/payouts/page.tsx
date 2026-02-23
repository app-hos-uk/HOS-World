'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

type PayoutStatus = 'ALL' | 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
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

  const fetchPayouts = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
        setError(null);
      }
      const response = await apiClient.getPayouts();
      if (response?.data) {
        setPayouts(response.data);
      } else if (showLoading) {
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

  const filteredPayouts =
    activeTab === 'ALL'
      ? payouts
      : payouts.filter((p) => p.status === activeTab);

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
      <DashboardLayout role="FINANCE" menuItems={menuItems} title="Finance">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Process Payouts</h1>
            <p className="text-gray-600 mt-2">Manage seller payouts and settlements</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchPayouts(true)}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
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
                ? payouts.length
                : payouts.filter((p) => p.status === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()} ({count})
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            <p className="font-semibold">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white border rounded-lg p-6 animate-pulse">
                <div className="flex justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                  </div>
                  <div className="h-6 w-20 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filteredPayouts.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="text-4xl mb-4">💸</div>
            <p className="text-gray-500 text-lg">No payouts found</p>
            <p className="text-sm text-gray-400 mt-2">
              {activeTab === 'ALL'
                ? 'Schedule a payout to get started'
                : `No ${activeTab.toLowerCase()} payouts`}
            </p>
          </div>
        )}

        {!loading && !error && filteredPayouts.length > 0 && (
          <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPayouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">
                          {payout.seller?.storeName || payout.sellerName || 'Unknown Seller'}
                        </p>
                        <p className="text-xs text-gray-500">{payout.sellerId}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-gray-900">
                          ${(payout.amount || 0).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            STATUS_STYLES[payout.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {payout.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(payout.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {payout.status === 'PENDING' && (
                          <button
                            onClick={() => handleProcessPayout(payout.id)}
                            disabled={processingId === payout.id}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
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
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-xl font-bold">Schedule Payout</h2>
                  <button
                    onClick={() => {
                      setShowScheduleModal(false);
                      setScheduleForm({ sellerId: '', amount: '' });
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Seller ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={scheduleForm.sellerId}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({ ...prev, sellerId: e.target.value }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter seller ID"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter payout amount"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSchedulePayout}
                    disabled={scheduling || !scheduleForm.sellerId.trim() || !scheduleForm.amount}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {scheduling ? 'Scheduling...' : 'Schedule Payout'}
                  </button>
                  <button
                    onClick={() => {
                      setShowScheduleModal(false);
                      setScheduleForm({ sellerId: '', amount: '' });
                    }}
                    disabled={scheduling}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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
