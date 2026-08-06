'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

const RESOLVABLE_STATUSES = ['OPEN', 'INVESTIGATING'];
const STATUS_OPTIONS = ['', 'OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'];
const TYPE_OPTIONS = ['', 'INVENTORY_DRIFT', 'GIFT_CARD_BALANCE', 'PRICE_MISMATCH', 'ORDER_TOTAL'];

export default function AdminDiscrepanciesPage() {
  const toast = useToast();
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [resolveModal, setResolveModal] = useState<{ id: string; type: string } | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const fetchDiscrepancies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDiscrepancies({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      });
      let discrepancyData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          discrepancyData = responseData;
        } else if (responseData && typeof responseData === 'object') {
          if (Array.isArray(responseData.discrepancies)) {
            discrepancyData = responseData.discrepancies;
          } else if (Array.isArray(responseData.data)) {
            discrepancyData = responseData.data;
          }
        }
      }
      setDiscrepancies(discrepancyData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load discrepancies');
      setDiscrepancies([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, toast]);

  useEffect(() => {
    fetchDiscrepancies();
  }, [fetchDiscrepancies]);

  const openResolveModal = (disc: any) => {
    setResolveModal({ id: disc.id, type: disc.type || '' });
    setResolveNote('');
  };

  const handleResolve = async () => {
    if (!resolveModal) return;
    if (!resolveNote.trim()) {
      toast.error('A resolution note is required');
      return;
    }
    setResolvingId(resolveModal.id);
    try {
      const res = await apiClient.resolveDiscrepancy(resolveModal.id, resolveNote.trim());
      toast.success(res.message || 'Discrepancy resolved');
      setResolveModal(null);
      await fetchDiscrepancies();
    } catch (err: any) {
      toast.error(err.message || 'Failed to resolve discrepancy');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-hos-text-secondary">Discrepancy Reports</h1>
          <p className="text-sm text-hos-text-muted mt-1">
            Inventory drift from POS stock reconciliation and gift-card balance mismatches.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-hos-border bg-hos-bg-tertiary text-hos-text-primary"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-hos-border bg-hos-bg-tertiary text-hos-text-primary"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t || 'all'} value={t}>
                {t ? t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'All types'}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-hos-text-muted">Loading discrepancies...</div>
          </div>
        ) : (
          <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-hos-border">
              <thead className="bg-hos-bg-secondary">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-hos-text-muted uppercase text-left">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Severity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-hos-text-muted uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                {discrepancies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-hos-text-muted">No discrepancies found</td>
                  </tr>
                ) : (
                  discrepancies.map((disc) => (
                    <tr key={disc.id} className="hover:bg-hos-bg-tertiary">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{disc.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          disc.severity === 'CRITICAL' ? 'bg-red-500/15 text-red-300' :
                          disc.severity === 'HIGH' ? 'bg-orange-500/15 text-orange-300' :
                          disc.severity === 'MEDIUM' ? 'bg-yellow-500/15 text-yellow-300' :
                          'bg-hos-bg-tertiary text-hos-text-secondary'
                        }`}>
                          {disc.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          disc.status === 'RESOLVED' ? 'bg-green-500/15 text-green-300' :
                          disc.status === 'OPEN' ? 'bg-hos-gold/20 text-hos-gold' :
                          disc.status === 'INVESTIGATING' ? 'bg-amber-500/15 text-amber-300' :
                          disc.status === 'DISMISSED' ? 'bg-hos-bg-tertiary text-hos-text-muted' :
                          'bg-hos-bg-tertiary text-hos-text-secondary'
                        }`}>
                          {disc.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm max-w-xs truncate" title={disc.description}>
                        {disc.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                        {new Date(disc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {RESOLVABLE_STATUSES.includes(disc.status) ? (
                          <button
                            type="button"
                            onClick={() => openResolveModal(disc)}
                            disabled={resolvingId === disc.id}
                            className="text-hos-gold hover:text-hos-gold-hover disabled:opacity-50 font-medium"
                          >
                            {resolvingId === disc.id ? 'Resolving…' : 'Resolve'}
                          </button>
                        ) : disc.status === 'RESOLVED' ? (
                          <span className="text-hos-text-muted cursor-help" title={disc.resolution || 'Resolved'}>
                            Resolved
                          </span>
                        ) : (
                          <span className="text-hos-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-hos-text-secondary mb-1">Resolve discrepancy</h3>
            <p className="text-sm text-hos-text-muted mb-4">
              {resolveModal.type.replace(/_/g, ' ').toLowerCase()}
            </p>
            <textarea
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="How was this resolved?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-hos-border bg-hos-bg-tertiary text-hos-text-primary focus:outline-none focus:ring-1 focus:ring-hos-gold/50"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setResolveModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolve}
                disabled={!resolveNote.trim() || resolvingId === resolveModal.id}
                className="px-4 py-2 text-sm rounded-lg bg-hos-gold text-[#1a1406] font-medium hover:opacity-90 disabled:opacity-50"
              >
                {resolvingId === resolveModal.id ? 'Resolving…' : 'Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}
