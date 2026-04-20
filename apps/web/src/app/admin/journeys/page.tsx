'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminJourneysPage() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListJourneys()
      .then((r) => setRows((r.data as any[]) || []))
      .catch((e: any) => setErr(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deactivate = async (id: string) => {
    if (!confirm('Deactivate this journey?')) return;
    try {
      await apiClient.adminDeleteJourney(id);
      toast.success('Journey deactivated');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Marketing journeys</h1>
            <Link
              href="/admin/journeys/new"
              className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm hover:bg-indigo-500"
            >
              New journey
            </Link>
          </div>
          {err && <p className="text-red-600 mb-4">{err}</p>}
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Slug</th>
                    <th className="px-4 py-2">Trigger</th>
                    <th className="px-4 py-2">Active</th>
                    <th className="px-4 py-2">Enrollments</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => (
                    <tr key={j.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium">{j.name}</td>
                      <td className="px-4 py-2 text-gray-600">{j.slug}</td>
                      <td className="px-4 py-2">{j.triggerEvent}</td>
                      <td className="px-4 py-2">{j.isActive ? 'Yes' : 'No'}</td>
                      <td className="px-4 py-2">{j._count?.enrollments ?? '—'}</td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <Link href={`/admin/journeys/${j.id}`} className="text-indigo-600 hover:underline">
                          View
                        </Link>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => deactivate(j.id)}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="p-6 text-gray-500">No journeys yet. Run db:seed-journeys or create one.</p>}
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
