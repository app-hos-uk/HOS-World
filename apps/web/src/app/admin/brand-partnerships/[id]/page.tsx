'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminBrandPartnershipDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetBrandPartnership(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));
    apiClient
      .adminGetBrandPartnershipReport(id)
      .then((r) => setReport((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Failed to load report'),
      );
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const campaigns = (row?.campaigns as Record<string, unknown>[]) ?? [];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <Link href="/admin/brand-partnerships" className="text-sm text-violet-700">
            ← All partners
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-semibold text-white">{String(row.name)}</h1>
                  <p className="text-sm text-hos-text-muted">
                    {String(row.status)} · {String(row.slug)}
                  </p>
                </div>
                <Link
                  href={`/admin/brand-partnerships/${id}/campaigns/new`}
                  className="rounded-md bg-violet-700 px-3 py-2 text-white text-sm"
                >
                  New campaign
                </Link>
              </div>
              <div className="border rounded-lg p-4 bg-hos-bg-secondary text-sm">
                <p className="font-medium mb-2">Budget</p>
                <p>
                  Spent {String(row.spentBudget)} / {String(row.totalBudget)} {String(row.currency)}
                </p>
              </div>
              {report && (
                <div className="border rounded-lg p-4 bg-hos-bg-secondary text-sm">
                  <p className="font-medium mb-3">Report Snapshot</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-hos-gold/10 rounded-lg p-3">
                      <p className="text-xs text-hos-text-muted">Total Campaigns</p>
                      <p className="text-xl font-semibold text-hos-gold-hover">
                        {Number(report.totalCampaigns ?? report.campaignCount ?? 0)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-hos-text-muted">Total Revenue</p>
                      <p className="text-xl font-semibold text-green-700">
                        ${Number(report.totalRevenue ?? report.revenue ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-hos-gold/10 rounded-lg p-3">
                      <p className="text-xs text-hos-text-muted">Total Orders</p>
                      <p className="text-xl font-semibold text-hos-gold">
                        {Number(report.totalOrders ?? report.orders ?? 0)}
                      </p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <p className="text-xs text-hos-text-muted">Conversion Rate</p>
                      <p className="text-xl font-semibold text-amber-700">
                        {Number(report.conversionRate ?? 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  {(report.impressions != null || report.clicks != null) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      {report.impressions != null && (
                        <div className="bg-hos-bg-secondary rounded-lg p-3">
                          <p className="text-xs text-hos-text-muted">Impressions</p>
                          <p className="text-lg font-semibold text-hos-text-secondary">
                            {Number(report.impressions).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {report.clicks != null && (
                        <div className="bg-hos-bg-secondary rounded-lg p-3">
                          <p className="text-xs text-hos-text-muted">Clicks</p>
                          <p className="text-lg font-semibold text-hos-text-secondary">
                            {Number(report.clicks).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {report.ctr != null && (
                        <div className="bg-hos-bg-secondary rounded-lg p-3">
                          <p className="text-xs text-hos-text-muted">CTR</p>
                          <p className="text-lg font-semibold text-hos-text-secondary">
                            {Number(report.ctr).toFixed(2)}%
                          </p>
                        </div>
                      )}
                      {report.avgOrderValue != null && (
                        <div className="bg-hos-bg-secondary rounded-lg p-3">
                          <p className="text-xs text-hos-text-muted">Avg Order Value</p>
                          <p className="text-lg font-semibold text-hos-text-secondary">
                            ${Number(report.avgOrderValue).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div>
                <h2 className="text-lg font-medium mb-2">Campaigns</h2>
                <ul className="space-y-2">
                  {campaigns.map((c) => (
                    <li key={String(c.id)} className="border rounded p-2 bg-hos-bg-secondary flex justify-between">
                      <span>{String(c.name)}</span>
                      <span className="text-hos-text-muted text-xs">{String(c.status)}</span>
                      <Link
                        href={`/admin/brand-partnerships/campaigns/${String(c.id)}`}
                        className="text-violet-600 text-sm"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-hos-text-muted">Loading…</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
