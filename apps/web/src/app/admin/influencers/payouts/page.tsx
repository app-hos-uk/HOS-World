'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { AdminLayout } from '@/components/AdminLayout';

const api = apiClient as any;

interface Payout {
  id: string;
  influencerId: string;
  influencer: {
    displayName: string;
    referralCode: string;
  };
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  paymentRef?: string;
  paidAt?: string;
  notes?: string;
  _count: {
    commissions: number;
  };
  createdAt: string;
}

interface Influencer {
  id: string;
  displayName: string;
  referralCode: string;
}

export default function AdminInfluencerPayoutsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<Payout | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    influencerId: '',
    periodStart: '',
    periodEnd: '',
    notes: '',
  });
  const [payForm, setPayForm] = useState({
    paymentMethod: '',
    paymentRef: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [payoutsRes, influencersRes] = await Promise.all([
        api.getAdminPayouts({ status: statusFilter || undefined, limit: 100 }),
        api.getInfluencers({ status: 'ACTIVE', limit: 100 }),
      ]);
      setPayouts(payoutsRes.data || []);
      setInfluencers(influencersRes.data || []);
    } catch (err: any) {
      console.error('Error fetching payouts:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.influencerId || !createForm.periodStart || !createForm.periodEnd) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      setCreating(true);
      await api.createPayout({
        influencerId: createForm.influencerId,
        periodStart: createForm.periodStart,
        periodEnd: createForm.periodEnd,
        notes: createForm.notes || undefined,
      });
      toast.success('Payout created successfully');
      setShowCreateModal(false);
      setCreateForm({ influencerId: '', periodStart: '', periodEnd: '', notes: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create payout');
    } finally {
      setCreating(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!showPayModal) return;

    try {
      await api.markPayoutPaid(showPayModal.id, payForm);
      toast.success('Payout marked as paid');
      setShowPayModal(null);
      setPayForm({ paymentMethod: '', paymentRef: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update payout');
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this payout?')) return;

    try {
      await api.cancelPayout(id);
      toast.success('Payout cancelled');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel payout');
    }
  };

  const formatCurrency = (amount: number, currency = 'GBP') => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PAID: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Influencer Payouts</h1>
            <p className="text-gray-600 mt-1">
              Create and track payout records
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Payout
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            </div>
          ) : payouts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No payouts found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Influencer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commissions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(payout.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{payout.influencer.displayName}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(payout.periodStart)} - {formatDate(payout.periodEnd)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payout._count.commissions} commissions
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        {formatCurrency(payout.totalAmount, payout.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(payout.status)}`}>
                          {payout.status}
                        </span>
                        {payout.paidAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            Paid {formatDate(payout.paidAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {payout.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowPayModal(payout)}
                              className="text-green-600 hover:text-green-800 text-sm font-medium"
                            >
                              Mark Paid
                            </button>
                            <button
                              onClick={() => handleCancel(payout.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Create Payout</h2>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Influencer</label>
                  <select
                    value={createForm.influencerId}
                    onChange={(e) => setCreateForm({ ...createForm, influencerId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    required
                  >
                    <option value="">Select influencer</option>
                    {influencers.map((i) => (
                      <option key={i.id} value={i.id}>{i.displayName} ({i.referralCode})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
                    <input
                      type="date"
                      value={createForm.periodStart}
                      onChange={(e) => setCreateForm({ ...createForm, periodStart: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
                    <input
                      type="date"
                      value={createForm.periodEnd}
                      onChange={(e) => setCreateForm({ ...createForm, periodEnd: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={createForm.notes}
                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Payout'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Mark Paid Modal */}
        {showPayModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Mark Payout as Paid</h2>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-gray-600">
                  Recording payment of <strong>{formatCurrency(showPayModal.totalAmount)}</strong> to{' '}
                  <strong>{showPayModal.influencer.displayName}</strong>
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={payForm.paymentMethod}
                    onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Select method</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="WISE">Wise</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={payForm.paymentRef}
                    onChange={(e) => setPayForm({ ...payForm, paymentRef: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Transaction ID or reference"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShowPayModal(null)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMarkPaid}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Confirm Payment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
