'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function AdminBrandPartnershipsDashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetBrandPartnershipDashboard()
      .then((r) => setData((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto">
          <Link href="/admin/brand-partnerships" className="text-sm text-violet-400 mb-4 inline-block">
            ← Partners
          </Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary mb-6">Brand partnerships</h1>
          {error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : loading ? (
            <p className="text-hos-text-muted">Loading…</p>
          ) : data ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted">Partnerships</p>
                <p className="text-2xl font-semibold">{String(data.totalPartnerships)}</p>
                <p className="text-xs text-hos-text-muted mt-1">Active: {String(data.activePartnerships)}</p>
              </div>
              <div className="border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted">Active campaigns</p>
                <p className="text-2xl font-semibold">{String(data.activeCampaigns)}</p>
              </div>
              <div className="border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted">Brand-funded points</p>
                <p className="text-2xl font-semibold">{String(data.totalBrandFundedPoints)}</p>
              </div>
              <div className="border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted">Budget util. (avg)</p>
                <p className="text-2xl font-semibold">{String(data.budgetUtilization)}%</p>
              </div>
              <div className="col-span-full border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted mb-2">Top partners</p>
                <pre className="text-xs overflow-auto">{JSON.stringify(data.topPartners, null, 2)}</pre>
              </div>
              <div className="col-span-full border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
                <p className="text-hos-text-muted mb-2">Recent campaigns</p>
                <pre className="text-xs overflow-auto">{JSON.stringify(data.recentCampaigns, null, 2)}</pre>
              </div>
            </div>
          ) : (
            <p className="text-hos-text-muted">No data available.</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
