'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Modal } from '@/components/ui/Modal';

interface ReturnRow {
  id: string;
  orderId: string;
  reason: string;
  status: string;
  refundAmount?: number;
  createdAt: string;
  order?: { orderNumber?: string; total?: number; currency?: string };
}

interface ReturnsManagementProps {
  mode: 'admin' | 'seller';
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300',
  approved: 'bg-green-500/15 text-green-300',
  rejected: 'bg-red-500/15 text-red-300',
  processing: 'bg-hos-gold/20 text-hos-gold',
  completed: 'bg-emerald-500/15 text-emerald-300',
  refunded: 'bg-cyan-500/15 text-cyan-300',
  cancelled: 'bg-hos-bg-tertiary text-hos-text-secondary',
};

export function ReturnsManagement({ mode }: ReturnsManagementProps) {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReturnRow | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const fetchReturns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getReturns();
      setReturns(Array.isArray(res?.data) ? res.data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const filtered = statusFilter
    ? returns.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase())
    : returns;

  const handleApprove = async (row: ReturnRow) => {
    if (!window.confirm('Approve this return and process the refund?')) return;
    try {
      setActionLoading(row.id);
      await apiClient.updateReturnStatus(row.id, { status: 'APPROVED' });
      toast.success('Return approved and refund initiated');
      fetchReturns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve return');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    try {
      setActionLoading(selected.id);
      await apiClient.updateReturnStatus(selected.id, {
        status: 'REJECTED',
        refundMethod: rejectNotes.trim() || undefined,
      });
      toast.success('Return rejected');
      setShowRejectModal(false);
      setRejectNotes('');
      setSelected(null);
      fetchReturns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject return');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkProcessing = async (row: ReturnRow) => {
    try {
      setActionLoading(row.id);
      await apiClient.updateReturnStatus(row.id, { status: 'PROCESSING' });
      toast.success('Return marked as processing');
      fetchReturns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update return');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkCompleted = async (row: ReturnRow) => {
    try {
      setActionLoading(row.id);
      await apiClient.updateReturnStatus(row.id, { status: 'COMPLETED' });
      toast.success('Return completed');
      fetchReturns();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete return');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Return Requests</h1>
          <p className="text-sm text-hos-text-muted mt-1">
            {mode === 'admin'
              ? 'Review and process customer return requests across the marketplace'
              : 'Manage return requests for your orders'}
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-sm"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-8 text-center text-hos-text-muted">
          No return requests found.
        </div>
      ) : (
        <div className="bg-hos-bg-secondary border border-hos-border rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-hos-border">
            <thead>
              <tr className="text-left text-xs uppercase text-hos-text-muted">
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Refund</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hos-border">
              {filtered.map((row) => (
                <tr key={row.id} className="text-sm">
                  <td className="px-4 py-3 whitespace-nowrap">
                    #{row.order?.orderNumber || row.orderId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={row.reason}>
                    {row.reason}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        STATUS_COLORS[row.status.toLowerCase()] || STATUS_COLORS.pending
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.refundAmount != null
                      ? formatPrice(row.refundAmount, row.order?.currency || 'USD')
                      : row.order?.total != null
                        ? formatPrice(Number(row.order.total), row.order?.currency || 'USD')
                        : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-hos-text-muted">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/returns/${row.id}?from=${mode}`}
                        className="text-hos-gold hover:text-hos-gold-hover text-xs font-medium"
                      >
                        View
                      </Link>
                      {row.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading === row.id}
                            onClick={() => handleApprove(row)}
                            className="text-green-400 hover:text-green-300 text-xs font-medium disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading === row.id}
                            onClick={() => {
                              setSelected(row);
                              setRejectNotes('');
                              setShowRejectModal(true);
                            }}
                            className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {row.status === 'approved' && (
                        <button
                          type="button"
                          disabled={actionLoading === row.id}
                          onClick={() => handleMarkProcessing(row)}
                          className="text-hos-gold text-xs font-medium disabled:opacity-50"
                        >
                          Processing
                        </button>
                      )}
                      {['approved', 'processing'].includes(row.status) && (
                        <button
                          type="button"
                          disabled={actionLoading === row.id}
                          onClick={() => handleMarkCompleted(row)}
                          className="text-emerald-400 text-xs font-medium disabled:opacity-50"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Return">
        <div className="space-y-4">
          <p className="text-sm text-hos-text-secondary">
            Provide a reason for rejecting this return request.
          </p>
          <textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-sm"
            placeholder="Rejection reason (optional)"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="px-4 py-2 bg-hos-bg-tertiary rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
