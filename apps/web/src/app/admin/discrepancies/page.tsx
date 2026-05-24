'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminDiscrepanciesPage() {
  const toast = useToast();
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          discrepancyData = responseData.data;
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

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-white">Discrepancy Reports</h1>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-hos-text-muted">Loading discrepancies...</div>
            </div>
          ) : (
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Severity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Description</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                  {discrepancies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-hos-text-muted">No discrepancies found</td>
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
                            'bg-hos-bg-tertiary text-white'
                          }`}>
                            {disc.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            disc.status === 'RESOLVED' ? 'bg-green-500/15 text-green-300' :
                            disc.status === 'OPEN' ? 'bg-hos-gold/20 text-hos-gold' :
                            'bg-hos-bg-tertiary text-white'
                          }`}>
                            {disc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{disc.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted">
                          {new Date(disc.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

