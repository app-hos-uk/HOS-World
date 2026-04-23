'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminStoresPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient
      .adminListStores()
      .then((r) => {
        const d = r.data as Record<string, unknown>[] | undefined;
        setRows(Array.isArray(d) ? d : []);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Stores</h1>
            <Link
              href="/admin/stores/new"
              className="text-sm rounded-md bg-violet-700 px-3 py-2 text-white"
            >
              New store
            </Link>
          </div>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Code</th>
                    <th className="text-left p-2">Region</th>
                    <th className="text-left p-2">Active</th>
                    <th className="text-left p-2">Onboarding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const id = String(r.id);
                    const ob = r.onboardingChecklist as Record<string, string> | undefined;
                    return (
                      <tr key={id} className="border-t">
                        <td className="p-2">
                          <Link href={`/admin/stores/${id}`} className="text-violet-700">
                            {String(r.name)}
                          </Link>
                        </td>
                        <td className="p-2">{String(r.code)}</td>
                        <td className="p-2">{String(r.defaultRegionCode ?? '—')}</td>
                        <td className="p-2">{String(r.isActive)}</td>
                        <td className="p-2">{ob?.status ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
