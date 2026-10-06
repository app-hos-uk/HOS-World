'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { FeatureFlagBanner } from '@/components/admin/FeatureFlagBanner';

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
              <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">POS Integration</h1>
            <p className="mt-1 text-hos-text-secondary">
              Connect Lightspeed (Vend) outlets, sync catalogue stock, and import in-store sales.
            </p>
          </div>

          <FeatureFlagBanner
            flag="POS_INTEGRATION"
            enabledLabel="POS Integration Enabled"
            disabledLabel="POS Integration Disabled"
            enabledDescription="Lightspeed (Vend) connections are active. Also requires POS_ENABLED=true env var."
            disabledDescription="POS integration is turned off. Enable the feature flag and set POS_ENABLED=true to activate."
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 shadow-sm">
              <div className="text-sm text-hos-text-muted">Connections</div>
              <div className="mt-1 text-2xl font-semibold text-hos-text-secondary">
                {loading ? '—' : connections ?? 0}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/pos/connections"
              className="flex flex-col rounded-lg border border-hos-gold/30 bg-hos-gold/5 px-4 py-3 hover:bg-hos-gold/10 transition-colors"
            >
              <span className="text-sm font-medium text-hos-gold">Connections</span>
              <span className="text-xs text-hos-text-muted mt-0.5">Lightspeed credentials, outlets, sync settings</span>
            </Link>
            <Link
              href="/admin/pos/jobs"
              className="flex flex-col rounded-lg border border-hos-border bg-hos-bg-secondary px-4 py-3 hover:bg-hos-bg-tertiary transition-colors"
            >
              <span className="text-sm font-medium text-hos-text-secondary">Job Management</span>
              <span className="text-xs text-hos-text-muted mt-0.5">Cron schedules, queue health, DLQ, activity logs</span>
            </Link>
            <Link
              href="/admin/pos/product-pull"
              className="flex flex-col rounded-lg border border-hos-border bg-hos-bg-secondary px-4 py-3 hover:bg-hos-bg-tertiary transition-colors"
            >
              <span className="text-sm font-medium text-hos-text-secondary">Product Pull</span>
              <span className="text-xs text-hos-text-muted mt-0.5">Search Lightspeed catalogue, preview before import</span>
            </Link>
            <Link
              href="/admin/pos/sync"
              className="flex flex-col rounded-lg border border-hos-border bg-hos-bg-secondary px-4 py-3 hover:bg-hos-bg-tertiary transition-colors"
            >
              <span className="text-sm font-medium text-hos-text-secondary">Sync Log</span>
              <span className="text-xs text-hos-text-muted mt-0.5">Recent entity mappings for products and customers</span>
            </Link>
            <Link
              href="/admin/pos/stores"
              className="flex flex-col rounded-lg border border-hos-border bg-hos-bg-secondary px-4 py-3 hover:bg-hos-bg-tertiary transition-colors"
            >
              <span className="text-sm font-medium text-hos-text-secondary">Outlets</span>
              <span className="text-xs text-hos-text-muted mt-0.5">Physical store locations mapped to Lightspeed</span>
            </Link>
            <Link
              href="/admin/pos/sales"
              className="flex flex-col rounded-lg border border-hos-border bg-hos-bg-secondary px-4 py-3 hover:bg-hos-bg-tertiary transition-colors"
            >
              <span className="text-sm font-medium text-hos-text-secondary">POS Sales</span>
              <span className="text-xs text-hos-text-muted mt-0.5">Imported in-store transactions and line items</span>
            </Link>
          </div>

          <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 text-sm text-hos-text-secondary">
            <p className="font-medium text-hos-text-secondary">Webhooks</p>
            <p className="mt-1">
              Register your POS webhook URL as{' '}
              <code className="rounded bg-hos-bg-tertiary px-1 py-0.5 text-xs">
                {'{API}'}/api/pos/webhooks/lightspeed/{'{storeCode}'}
              </code>{' '}
              (use each store&apos;s <code className="rounded bg-hos-bg-tertiary px-1">code</code>).
            </p>
          </div>
        </div>
          </RouteGuard>
  );
}
