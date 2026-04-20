'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

type Connection = {
  id: string;
  provider: string;
  isActive: boolean;
  syncStatus: string;
  lastSyncedAt: string | null;
  store?: { name: string; code: string; city?: string | null };
};

export default function AdminPosConnectionsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getPosConnections();
      const data = (res as { data?: Connection[] })?.data;
      setItems(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const test = async (id: string) => {
    try {
      const res = await apiClient.testPosConnection(id);
      const body = (res as { data?: { success?: boolean; error?: string } })?.data;
      if (body?.success) toast.success('Connection OK');
      else toast.error(body?.error || 'Test failed');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Test failed');
    }
  };

  const syncProducts = async (id: string) => {
    try {
      await apiClient.triggerPosProductSync(id);
      toast.success('Product sync queued');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Queue failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/admin/pos" className="text-sm text-indigo-600 hover:text-indigo-800">
                ← POS home
              </Link>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">POS connections</h1>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-500">Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Store
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                      Sync
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        No POS connections. Create one via API{' '}
                        <code className="rounded bg-gray-100 px-1">POST /admin/pos/connections</code> or
                        extend this UI with a form.
                      </td>
                    </tr>
                  ) : (
                    items.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-sm">
                          {c.store?.name ?? '—'}{' '}
                          <span className="text-gray-400">({c.store?.code})</span>
                        </td>
                        <td className="px-4 py-3 text-sm">{c.provider}</td>
                        <td className="px-4 py-3 text-sm">
                          {c.isActive ? (
                            <span className="text-green-700">Active</span>
                          ) : (
                            <span className="text-gray-500">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{c.syncStatus}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <button
                            type="button"
                            onClick={() => void test(c.id)}
                            className="mr-2 text-indigo-600 hover:text-indigo-800"
                          >
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => void syncProducts(c.id)}
                            className="text-indigo-600 hover:text-indigo-800"
                          >
                            Sync products
                          </button>
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
