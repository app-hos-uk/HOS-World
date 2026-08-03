'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { AlignedDataTable, type AlignedColumn } from '@/components/ui/AlignedDataTable';

type CampaignRow = {
  campaignId: string;
  campaignName: string;
  campaignType: string;
  totalOrders: number;
  totalRevenue: number;
  totalPoints: number;
  roi: number;
};

export default function AttributionPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetCampaignAttribution({ limit: 50 })
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load attribution data'))
      .finally(() => setLoading(false));
  }, []);

  const campaigns: CampaignRow[] = data?.campaigns ?? [];
  const totals = data?.totals;

  const columns = useMemo<AlignedColumn<CampaignRow>[]>(
    () => [
      {
        key: 'campaign',
        header: 'Campaign',
        width: '1.8fr',
        align: 'left',
        cell: (c) => <span className="font-medium">{c.campaignName}</span>,
      },
      {
        key: 'type',
        header: 'Type',
        width: '1fr',
        align: 'left',
        cell: (c) => c.campaignType,
      },
      {
        key: 'orders',
        header: 'Orders',
        width: '0.9fr',
        align: 'right',
        cell: (c) => c.totalOrders,
      },
      {
        key: 'revenue',
        header: 'Revenue',
        width: '1.1fr',
        align: 'right',
        cell: (c) => `$${Number(c.totalRevenue).toFixed(2)}`,
      },
      {
        key: 'points',
        header: 'Points',
        width: '0.9fr',
        align: 'right',
        cell: (c) => c.totalPoints,
      },
      {
        key: 'roi',
        header: 'ROI',
        width: '0.8fr',
        align: 'right',
        cell: (c) => `${c.roi}x`,
      },
    ],
    [],
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Link href="/admin/loyalty-analytics" className="text-sm text-violet-400">
          ← Health
        </Link>
        <h1 className="text-2xl font-semibold text-hos-text-secondary">Campaign ROI</h1>
        {loading ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <>
            {totals && (
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                <div className="rounded border border-hos-border bg-hos-bg-secondary p-3">
                  <p className="text-hos-text-muted">Orders</p>
                  <p className="text-xl font-semibold">{totals.orders}</p>
                </div>
                <div className="rounded border border-hos-border bg-hos-bg-secondary p-3">
                  <p className="text-hos-text-muted">Revenue</p>
                  <p className="text-xl font-semibold">${Number(totals.revenue).toFixed(2)}</p>
                </div>
                <div className="rounded border border-hos-border bg-hos-bg-secondary p-3">
                  <p className="text-hos-text-muted">Points</p>
                  <p className="text-xl font-semibold">{totals.points}</p>
                </div>
                <div className="rounded border border-hos-border bg-hos-bg-secondary p-3">
                  <p className="text-hos-text-muted">Cost</p>
                  <p className="text-xl font-semibold">${Number(totals.cost).toFixed(2)}</p>
                </div>
                <div className="rounded border border-hos-border bg-hos-bg-secondary p-3">
                  <p className="text-hos-text-muted">Avg ROI</p>
                  <p className="text-xl font-semibold">{totals.avgRoi}x</p>
                </div>
              </div>
            )}
            <AlignedDataTable
              columns={columns}
              rows={campaigns}
              rowKey={(c) => c.campaignId}
              minWidth={720}
              emptyMessage="No campaign attribution data available."
            />
          </>
        )}
      </div>
    </RouteGuard>
  );
}
