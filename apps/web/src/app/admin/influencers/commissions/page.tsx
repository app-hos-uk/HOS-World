'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { RouteGuard } from '@/components/RouteGuard';

const api = apiClient as any;

interface Commission {
  id: string;
  orderId: string;
  orderTotal: number;
  rateSource: string;
  rateApplied: number;
  amount: number;
  status: string;
  currency: string;
  notes?: string;
  influencer: {
    id: string;
    displayName: string;
    referralCode: string;
  };
  createdAt: string;
}

export default function AdminInfluencerCommissionsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchCommissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getAdminCommissions({
        status: statusFilter || undefined,
        limit: 100,
      });
      setCommissions(response.data || []);
    } catch (err: any) {
      console.error('Error fetching commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  const handleApprove = async (id: string) => {
    try {
      await api.approveCommission(id);
      toast.success('Commission approved');
      fetchCommissions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.updateCommissionStatus(id, status);
      toast.success('Status updated');
      fetchCommissions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-500/15 text-yellow-300',
      APPROVED: 'bg-green-500/15 text-green-300',
      PAID: 'bg-hos-gold/20 text-hos-gold',
      CANCELLED: 'bg-red-500/15 text-red-300',
      ADJUSTED: 'bg-hos-gold/20 text-hos-gold',
    };
    return styles[status] || 'bg-hos-bg-tertiary text-hos-text-secondary';
  };

  // Stats
  const pendingTotal = commissions.filter(c => c.status === 'PENDING').reduce((sum, c) => sum + c.amount, 0);
  const approvedTotal = commissions.filter(c => c.status === 'APPROVED').reduce((sum, c) => sum + c.amount, 0);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
            <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-hos-text-secondary">Influencer Commissions</h1>
          <p className="text-hos-text-secondary mt-1">
            Review and manage commission payouts
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-hos-bg-secondary rounded-lg p-4 shadow-sm">
            <p className="text-sm text-hos-text-muted">Total Commissions</p>
            <p className="text-2xl font-bold text-hos-text-secondary">{commissions.length}</p>
          </div>
          <div className="bg-hos-bg-secondary rounded-lg p-4 shadow-sm">
            <p className="text-sm text-hos-text-muted">Pending Approval</p>
            <p className="text-2xl font-bold text-yellow-400">{formatCurrency(pendingTotal)}</p>
          </div>
          <div className="bg-hos-bg-secondary rounded-lg p-4 shadow-sm">
            <p className="text-sm text-hos-text-muted">Ready for Payout</p>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(approvedTotal)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-hos-bg-secondary rounded-lg shadow-sm p-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-hos-border rounded-lg"
          >
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-hos-bg-secondary rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold mx-auto"></div>
            </div>
          ) : commissions.length === 0 ? (
            <div className="p-12 text-center text-hos-text-muted">No commissions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Influencer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Order Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border">
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="hover:bg-hos-bg-tertiary">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {formatDate(commission.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-hos-text-secondary">{commission.influencer.displayName}</p>
                        <p className="text-sm text-hos-text-muted">{commission.influencer.referralCode}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-hos-text-secondary">
                        {commission.orderId.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-secondary">
                        {formatCurrency(commission.orderTotal, commission.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {(commission.rateApplied * 100).toFixed(0)}% ({commission.rateSource})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-400">
                        {formatCurrency(commission.amount, commission.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(commission.status)}`}>
                          {commission.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {commission.status === 'PENDING' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(commission.id)}
                              className="text-green-400 hover:text-green-300 text-sm font-medium"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(commission.id, 'CANCELLED')}
                              className="text-red-400 hover:text-red-300 text-sm font-medium"
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
      </div>
          </RouteGuard>
  );
}
