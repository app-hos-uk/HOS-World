'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
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
      <AdminLayout>
        <div className="space-y-6">
          <Link href="/admin/pos" className="text-sm text-indigo-600 hover:text-indigo-800">
            ← POS home
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">POS sync log</h1>
          <p className="text-gray-600">Recent external entity mappings (products, customers).</p>

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mappings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No mapping activity yet.
                      </td>
                    </tr>
                  ) : (
                    mappings.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-3">{m.provider}</td>
                        <td className="px-4 py-3">{m.entityType}</td>
                        <td className="px-4 py-3">{m.syncStatus}</td>
                        <td className="px-4 py-3 text-gray-500">
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
      </AdminLayout>
    </RouteGuard>
  );
}
