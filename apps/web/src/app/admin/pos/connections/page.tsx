'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const load = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
              <Link href="/admin/pos" className="text-sm text-hos-gold hover:text-hos-gold">
                ← POS home
              </Link>
              <h1 className="mt-2 text-2xl font-bold text-white">POS connections</h1>
            </div>
          </div>

          {loading ? (
            <div className="text-hos-text-muted">Loading…</div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-hos-border bg-hos-bg-secondary shadow">
              <table className="min-w-full divide-y divide-hos-border">
                <thead className="bg-hos-bg-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Store
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Provider
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">
                      Sync
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-hos-text-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hos-border bg-hos-bg-secondary">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-hos-text-muted">
                        No POS connections. Create one via API{' '}
                        <code className="rounded bg-hos-bg-tertiary px-1">POST /admin/pos/connections</code> or
                        extend this UI with a form.
                      </td>
                    </tr>
                  ) : (
                    items.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-3 text-sm">
                          {c.store?.name ?? '—'}{' '}
                          <span className="text-hos-text-muted">({c.store?.code})</span>
                        </td>
                        <td className="px-4 py-3 text-sm">{c.provider}</td>
                        <td className="px-4 py-3 text-sm">
                          {c.isActive ? (
                            <span className="text-green-700">Active</span>
                          ) : (
                            <span className="text-hos-text-muted">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-hos-text-secondary">{c.syncStatus}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <button
                            type="button"
                            onClick={() => void test(c.id)}
                            className="mr-2 text-hos-gold hover:text-hos-gold"
                          >
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => void syncProducts(c.id)}
                            className="text-hos-gold hover:text-hos-gold"
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
