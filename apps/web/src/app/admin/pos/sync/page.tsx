'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminPosSyncPage() {
  const toast = useToast();
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getPosSyncLog();
        const data = (res as { data?: { mappings?: any[] } })?.data;
        setMappings(Array.isArray(data?.mappings) ? data.mappings : []);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to load sync log');
        setMappings([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="space-y-6">
          <Link href="/admin/pos" className="text-sm text-hos-gold hover:text-hos-gold">
            ← POS home
          </Link>
          <h1 className="text-2xl font-bold text-hos-text-secondary">POS sync log</h1>
          <p className="text-hos-text-secondary">Recent external entity mappings (products, customers).</p>

          {loading ? (
            <div className="text-hos-text-muted">Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-hos-border bg-hos-bg-secondary shadow">
              <table className="min-w-full divide-y divide-hos-border text-sm">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border">
                  {mappings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-hos-text-muted">
                        No mapping activity yet.
                      </td>
                    </tr>
                  ) : (
                    mappings.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-3">{m.provider}</td>
                        <td className="px-4 py-3">{m.entityType}</td>
                        <td className="px-4 py-3">{m.syncStatus}</td>
                        <td className="px-4 py-3 text-hos-text-muted">
                          {m.updatedAt ? new Date(m.updatedAt).toLocaleString() : '—'}
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
