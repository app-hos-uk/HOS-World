'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

/** The resolve endpoint rejects anything already closed out (RESOLVED / DISMISSED). */
const RESOLVABLE_STATUSES = ['OPEN', 'INVESTIGATING'];

export default function AdminDiscrepanciesPage() {
  const toast = useToast();
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDiscrepancies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDiscrepancies = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getDiscrepancies();
      let discrepancyData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          discrepancyData = responseData;
        } else if (responseData && typeof responseData === 'object') {
          // API returns { discrepancies, pagination }; older shapes nested under data.
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
  };

  const handleResolve = async (disc: any) => {
    const resolution = prompt(
      `How was this ${String(disc.type || '').toLowerCase()} discrepancy resolved?`,
    );
    if (resolution === null) return;
    if (!resolution.trim()) {
      toast.error('A resolution note is required');
      return;
    }
    setResolvingId(disc.id);
    try {
      const res = await apiClient.resolveDiscrepancy(disc.id, resolution.trim());
      toast.success(res.message || 'Discrepancy resolved');
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
                            'bg-hos-bg-tertiary text-hos-text-secondary'
                          }`}>
                            {disc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{disc.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {new Date(disc.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {!RESOLVABLE_STATUSES.includes(disc.status) ? (
                            <span className="text-hos-text-muted" title={disc.resolution || undefined}>
                              —
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleResolve(disc)}
                              disabled={resolvingId === disc.id}
                              className="text-hos-gold hover:text-hos-gold-hover disabled:opacity-50 font-medium"
                            >
                              {resolvingId === disc.id ? 'Resolving…' : 'Resolve'}
                            </button>
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
          </RouteGuard>
  );
}

