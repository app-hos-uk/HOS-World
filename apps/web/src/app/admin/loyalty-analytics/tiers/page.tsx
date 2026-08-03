'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { AlignedDataTable, type AlignedColumn } from '@/components/ui/AlignedDataTable';

type TierRow = {
  tier: string;
  memberCount: number;
  avgSpend: number;
  avgClv: number;
  avgPurchaseFreq: number;
  churnRate: number;
  revenueContribution: number;
};

export default function TierAnalysisPage() {
  const [data, setData] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetTierAnalysis()
      .then((r) => setData(Array.isArray(r.data) ? r.data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load tier analysis'))
      .finally(() => setLoading(false));
  }, []);

  const columns = useMemo<AlignedColumn<TierRow>[]>(
    () => [
      {
        key: 'tier',
        header: 'Tier',
        width: '1.5fr',
        align: 'left',
        cell: (t) => <span className="font-medium">{t.tier}</span>,
      },
      {
        key: 'members',
        header: 'Members',
        width: '1fr',
        align: 'right',
        cell: (t) => t.memberCount,
      },
      {
        key: 'avgSpend',
        header: 'Avg spend',
        width: '1.1fr',
        align: 'right',
        cell: (t) => `$${Number(t.avgSpend).toFixed(2)}`,
      },
      {
        key: 'avgClv',
        header: 'Avg CLV',
        width: '1.1fr',
        align: 'right',
        cell: (t) => `$${Number(t.avgClv).toFixed(2)}`,
      },
      {
        key: 'freq',
        header: 'Freq/mo',
        width: '1fr',
        align: 'right',
        cell: (t) => Number(t.avgPurchaseFreq).toFixed(2),
      },
      {
        key: 'churn',
        header: 'Churn',
        width: '1fr',
        align: 'right',
        cell: (t) => `${(Number(t.churnRate) * 100).toFixed(1)}%`,
      },
      {
        key: 'revenue',
        header: 'Revenue',
        width: '1.2fr',
        align: 'right',
        cell: (t) => `$${Number(t.revenueContribution).toFixed(2)}`,
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
        <h1 className="text-2xl font-semibold text-hos-text-secondary">Tier analysis</h1>
        {loading ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <AlignedDataTable
            columns={columns}
            rows={data}
            rowKey={(t) => t.tier}
            minWidth={720}
            emptyMessage="No tier analysis data available."
          />
        )}
      </div>
    </RouteGuard>
  );
}
