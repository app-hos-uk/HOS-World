'use client';

import { useState, useEffect, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function ReconciliationPage() {
  const toast = useToast();
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any>(null);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getReconciliationRuns({ limit: 20 });
      setRuns(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load reconciliation runs');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const handleStartRun = async () => {
    if (!periodStart || !periodEnd) {
      toast.error('Please select start and end dates');
      return;
    }
    try {
      setRunning(true);
      await apiClient.startReconciliation({ periodStart, periodEnd });
      toast.success('Reconciliation completed');
      await fetchRuns();
    } catch (err: any) {
      toast.error(err.message || 'Reconciliation failed');
    } finally {
      setRunning(false);
    }
  };

  const handleViewDetails = async (runId: string) => {
    try {
      const response = await apiClient.getReconciliationRunDetails(runId);
      setSelectedRun(response?.data);
    } catch (err: any) {
      toast.error('Failed to load run details');
    }
  };

  const handleResolveItem = async (itemId: string) => {
    const resolution = window.prompt('Enter resolution notes:');
    if (!resolution) return;
    try {
      await apiClient.resolveReconciliationItem(itemId, resolution);
      toast.success('Item resolved');
      if (selectedRun) handleViewDetails(selectedRun.id);
    } catch (err: any) {
      toast.error('Failed to resolve item');
    }
  };

  const handleIgnoreItem = async (itemId: string) => {
    const reason = window.prompt('Enter reason for ignoring:');
    if (!reason) return;
    try {
      await apiClient.ignoreReconciliationItem(itemId, reason);
      toast.success('Item ignored');
      if (selectedRun) handleViewDetails(selectedRun.id);
    } catch (err: any) {
      toast.error('Failed to ignore item');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Stripe Reconciliation</h1>
            <p className="text-hos-text-muted mt-1">Compare internal transactions against Stripe records</p>
          </div>

          {/* Start New Run */}
          <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
            <h2 className="text-lg font-semibold mb-4">Start New Reconciliation</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Period Start</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-tertiary text-hos-text-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Period End</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-tertiary text-hos-text-primary" />
              </div>
              <button onClick={handleStartRun} disabled={running} className="px-5 py-2 bg-hos-gold text-[#1a1406] rounded-lg font-medium disabled:opacity-50">
                {running ? 'Running...' : 'Run Reconciliation'}
              </button>
            </div>
          </div>

          {/* Run History */}
          <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
            <h2 className="text-lg font-semibold mb-4">Reconciliation History</h2>
            {loading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-hos-gold" /></div>
            ) : runs.length === 0 ? (
              <p className="text-hos-text-muted text-center py-8">No reconciliation runs yet</p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <div key={run.id} className="flex items-center justify-between p-4 bg-hos-bg-tertiary rounded-lg">
                    <div>
                      <p className="font-medium text-hos-text-secondary">
                        {new Date(run.periodStart).toLocaleDateString()} — {new Date(run.periodEnd).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-hos-text-muted">
                        Matched: {run.totalMatched} | Mismatched: {run.totalMismatched} | Missing: {run.totalMissing} | Extra: {run.totalExtra}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${run.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' : run.status === 'FAILED' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {run.status}
                      </span>
                      <button onClick={() => handleViewDetails(run.id)} className="text-sm text-hos-gold hover:underline">View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Run Details Modal */}
          {selectedRun && (
            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Run Details</h2>
                <button onClick={() => setSelectedRun(null)} className="text-hos-text-muted hover:text-hos-text-secondary">Close</button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(selectedRun.items || []).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-hos-bg-tertiary rounded-lg text-sm">
                    <div>
                      <span className={`px-2 py-0.5 rounded text-xs mr-2 ${item.type === 'MATCHED' ? 'bg-green-500/20 text-green-400' : item.type === 'AMOUNT_MISMATCH' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'}`}>
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-hos-text-muted">
                        Internal: ${Number(item.internalAmount || 0).toFixed(2)} | Stripe: ${Number(item.stripeAmount || 0).toFixed(2)}
                        {item.discrepancyAmount ? ` | Diff: $${Number(item.discrepancyAmount).toFixed(2)}` : ''}
                      </span>
                    </div>
                    {item.status === 'UNRESOLVED' && item.type !== 'MATCHED' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleResolveItem(item.id)} className="text-xs px-2 py-1 bg-green-600 text-white rounded">Resolve</button>
                        <button onClick={() => handleIgnoreItem(item.id)} className="text-xs px-2 py-1 border border-hos-border rounded text-hos-text-muted">Ignore</button>
                      </div>
                    )}
                    {item.status !== 'UNRESOLVED' && (
                      <span className="text-xs text-hos-text-muted">{item.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
