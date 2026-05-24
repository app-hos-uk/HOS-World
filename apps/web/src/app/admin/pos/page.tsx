'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminPosDashboardPage() {
  const toast = useToast();
  const [connections, setConnections] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getPosConnections();
        const data = (res as { data?: unknown })?.data;
        const list = Array.isArray(data) ? data : [];
        setConnections(list.length);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Failed to load POS');
        setConnections(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-white">POS Integration</h1>
            <p className="mt-1 text-hos-text-secondary">
              Connect Lightspeed (Vend) outlets, sync catalogue stock, and import in-store sales.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 shadow-sm">
              <div className="text-sm text-hos-text-muted">Connections</div>
              <div className="mt-1 text-2xl font-semibold text-white">
                {loading ? '—' : connections ?? 0}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/pos/connections"
              className="rounded-md bg-hos-gold px-4 py-2 text-sm font-medium text-white hover:bg-hos-gold-hover"
            >
              Manage connections
            </Link>
            <Link
              href="/admin/pos/sync"
              className="rounded-md border border-hos-border bg-hos-bg-secondary px-4 py-2 text-sm font-medium text-hos-text-secondary hover:bg-hos-bg-tertiary"
            >
              Sync log
            </Link>
            <Link
              href="/admin/pos/stores"
              className="rounded-md border border-hos-border bg-hos-bg-secondary px-4 py-2 text-sm font-medium text-hos-text-secondary hover:bg-hos-bg-tertiary"
            >
              Outlets
            </Link>
          </div>

          <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 text-sm text-hos-text-secondary">
            <p className="font-medium text-white">Webhooks</p>
            <p className="mt-1">
              Register your POS webhook URL as{' '}
              <code className="rounded bg-hos-bg-tertiary px-1 py-0.5 text-xs">
                {'{API}'}/api/pos/webhooks/lightspeed/{'{storeCode}'}
              </code>{' '}
              (use each store&apos;s <code className="rounded bg-hos-bg-tertiary px-1">code</code>).
            </p>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
