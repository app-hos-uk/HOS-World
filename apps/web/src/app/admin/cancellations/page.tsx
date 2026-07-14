'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';

const STATUS_FILTERS = [
  { value: '', label: 'All Active' },
  { value: 'PENDING_FINANCE', label: 'Pending Finance' },
  { value: 'ESCALATED', label: 'Escalated' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'APPROVED', label: 'Approved' },
];

export default function AdminCancellationsPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING_FINANCE');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getCancellationRequests({
        status: statusFilter || undefined,
        limit: 50,
      });
      setRequests(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load cancellation requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleFinanceReview = async (id: string, approved: boolean) => {
    try {
      setProcessingId(id);
      await apiClient.reviewCancellationFinance(id, {
        approved,
        notes: reviewNotes[id] || undefined,
      });
      toast.success(approved ? 'Cancellation approved' : 'Cancellation rejected');
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to review cancellation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleAdminResolve = async (id: string, approved: boolean) => {
    try {
      setProcessingId(id);
      await apiClient.resolveCancellationAdmin(id, {
        approved,
        notes: reviewNotes[id] || undefined,
      });
      toast.success(approved ? 'Cancellation approved by admin' : 'Cancellation rejected by admin');
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve cancellation');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
              <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Cancellation Approvals</h1>
            <p className="text-hos-text-secondary mt-1">
              Review paid order cancellation requests awaiting finance or admin action
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value || 'all'}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  statusFilter === filter.value
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-secondary border border-hos-border text-hos-text-secondary'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" />
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-8 text-center text-hos-text-muted">
              No cancellation requests found
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const canFinanceReview = ['PENDING_FINANCE', 'ESCALATED'].includes(request.status);
                const canAdminResolve = request.status === 'ESCALATED' || request.status === 'REJECTED';

                return (
                  <div
                    key={request.id}
                    className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-hos-text-secondary">
                          Order #{request.order?.orderNumber || request.orderId.slice(0, 8)}
                        </h2>
                        <p className="text-sm text-hos-text-muted mt-1">
                          Customer: {request.requestedBy?.email || request.requestedById}
                        </p>
                        <p className="text-sm text-hos-text-muted">
                          Amount: {formatPrice(Number(request.order?.total || 0), request.order?.currency || 'USD')}
                        </p>
                        <p className="text-sm text-hos-text-muted">
                          Status: <span className="font-medium">{request.status}</span>
                        </p>
                        {request.reason && (
                          <p className="text-sm text-hos-text-secondary mt-2">
                            Reason: {request.reason}
                          </p>
                        )}
                        {request.escalationReason && (
                          <p className="text-sm text-orange-300 mt-1">
                            Escalation: {request.escalationReason}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-hos-text-muted">
                        Requested {new Date(request.createdAt).toLocaleString()}
                      </div>
                    </div>

                    {(canFinanceReview || canAdminResolve) && (
                      <div className="border-t border-hos-border pt-4 space-y-3">
                        <textarea
                          value={reviewNotes[request.id] || ''}
                          onChange={(e) =>
                            setReviewNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                          }
                          placeholder="Review notes (optional)"
                          className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-tertiary text-sm"
                          rows={2}
                        />
                        <div className="flex flex-wrap gap-2">
                          {canFinanceReview && (
                            <>
                              <button
                                onClick={() => handleFinanceReview(request.id, true)}
                                disabled={processingId === request.id}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                              >
                                Approve Refund
                              </button>
                              <button
                                onClick={() => handleFinanceReview(request.id, false)}
                                disabled={processingId === request.id}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {canAdminResolve && (
                            <>
                              <button
                                onClick={() => handleAdminResolve(request.id, true)}
                                disabled={processingId === request.id}
                                className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm"
                              >
                                Admin Override Approve
                              </button>
                              <button
                                onClick={() => handleAdminResolve(request.id, false)}
                                disabled={processingId === request.id}
                                className="px-4 py-2 border border-red-500/40 text-red-400 rounded-lg hover:bg-red-500/10 disabled:opacity-50 text-sm"
                              >
                                Admin Reject
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
          </RouteGuard>
  );
}
