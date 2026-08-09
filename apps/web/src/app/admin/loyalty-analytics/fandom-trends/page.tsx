'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { AlignedDataTable, type AlignedColumn } from '@/components/ui/AlignedDataTable';
import { useMoney } from '@/hooks/useMoney';

type FandomRow = {
  fandom: string;
  members: number;
  revenue: number;
  orders: number;
  avgSpend: number;
  growth: number;
};

export default function FandomTrendsPage() {
  const { formatMoney } = useMoney();
  const [data, setData] = useState<FandomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetFandomTrends(30)
      .then((r) => setData(Array.isArray(r.data) ? r.data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load fandom trends'))
      .finally(() => setLoading(false));
  }, []);

  const columns = useMemo<AlignedColumn<FandomRow>[]>(
    () => [
      {
        key: 'fandom',
        header: 'Fandom',
        width: '1.8fr',
        align: 'left',
        cell: (f) => <span className="font-medium">{f.fandom}</span>,
      },
      {
        key: 'members',
        header: 'Members',
        width: '1fr',
        align: 'right',
        cell: (f) => f.members,
      },
      {
        key: 'revenue',
        header: 'Revenue',
        width: '1.1fr',
        align: 'right',
        cell: (f) => formatMoney(Number(f.revenue)),
      },
      {
        key: 'orders',
        header: 'Orders',
        width: '1fr',
        align: 'right',
        cell: (f) => f.orders,
      },
      {
        key: 'avgSpend',
        header: 'Avg spend',
        width: '1.1fr',
        align: 'right',
        cell: (f) => formatMoney(Number(f.avgSpend)),
      },
      {
        key: 'growth',
        header: 'Growth',
        width: '1fr',
        align: 'right',
        cell: (f) => `${f.growth > 0 ? '+' : ''}${f.growth}%`,
      },
    ],
    [formatMoney],
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Link href="/admin/loyalty-analytics" className="text-sm text-violet-400">
          ← Health
        </Link>
        <h1 className="text-2xl font-semibold text-hos-text-secondary">Fandom trends (30d)</h1>
        {loading ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <AlignedDataTable
            columns={columns}
            rows={data}
            rowKey={(f) => f.fandom}
            minWidth={640}
            emptyMessage="No fandom trend data available."
          />
        )}
      </div>
    </RouteGuard>
  );
}
