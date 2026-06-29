'use client';

import { useState, useEffect, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';

const STATUS_OPTIONS = ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUIRED', 'WON', 'LOST', 'CLOSED'];

export default function DisputesPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchDisputes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDisputes({ status: statusFilter || undefined, limit: 50 });
      setDisputes(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load disputes');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const notes = window.prompt('Notes (optional):') || undefined;
    try {
      await apiClient.updateDisputeStatus(id, newStatus, notes);
      toast.success('Dispute status updated');
      fetchDisputes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update dispute');
    }
  };

  const handleMarkEvidence = async (id: string) => {
    try {
      await apiClient.markDisputeEvidenceSubmitted(id);
      toast.success('Evidence marked as submitted');
      fetchDisputes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update dispute');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Disputes & Chargebacks</h1>
            <p className="text-hos-text-muted mt-1">Manage payment disputes and track chargeback rates</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setStatusFilter('')} className={`px-4 py-2 rounded-lg text-sm font-medium ${!statusFilter ? 'bg-hos-gold text-[#1a1406]' : 'bg-hos-bg-secondary border border-hos-border text-hos-text-secondary'}`}>All</button>
            {STATUS_OPTIONS.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-lg text-sm font-medium ${statusFilter === s ? 'bg-hos-gold text-[#1a1406]' : 'bg-hos-bg-secondary border border-hos-border text-hos-text-secondary'}`}>{s.replace('_', ' ')}</button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" /></div>
          ) : disputes.length === 0 ? (
            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-8 text-center text-hos-text-muted">No disputes found</div>
          ) : (
            <div className="space-y-4">
              {disputes.map((dispute) => (
                <div key={dispute.id} className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${dispute.status === 'OPEN' ? 'bg-red-500/20 text-red-400' : dispute.status === 'WON' ? 'bg-green-500/20 text-green-400' : dispute.status === 'LOST' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {dispute.status}
                        </span>
                        <span className="text-lg font-semibold">{formatPrice(Number(dispute.amount), dispute.currency)}</span>
                      </div>
                      {dispute.order && <p className="text-sm text-hos-text-muted">Order: #{dispute.order.orderNumber}</p>}
                      {dispute.seller && <p className="text-sm text-hos-text-muted">Seller: {dispute.seller.storeName}</p>}
                      {dispute.customer && <p className="text-sm text-hos-text-muted">Customer: {dispute.customer.email}</p>}
                      {dispute.reason && <p className="text-sm text-hos-text-secondary mt-2">Reason: {dispute.reason}</p>}
                      {dispute.evidenceDeadline && <p className="text-sm text-orange-400 mt-1">Evidence due: {new Date(dispute.evidenceDeadline).toLocaleDateString()}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {['OPEN', 'EVIDENCE_REQUIRED'].includes(dispute.status) && (
                        <button onClick={() => handleMarkEvidence(dispute.id)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Mark Evidence Sent</button>
                      )}
                      {!['WON', 'LOST', 'CLOSED'].includes(dispute.status) && (
                        <>
                          <button onClick={() => handleUpdateStatus(dispute.id, 'WON')} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm">Won</button>
                          <button onClick={() => handleUpdateStatus(dispute.id, 'LOST')} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm">Lost</button>
                          <button onClick={() => handleUpdateStatus(dispute.id, 'CLOSED')} className="px-3 py-1.5 border border-hos-border rounded-lg text-sm text-hos-text-muted">Close</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
