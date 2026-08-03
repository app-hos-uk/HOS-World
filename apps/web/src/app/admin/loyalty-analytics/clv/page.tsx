'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { AlignedDataTable, type AlignedColumn } from '@/components/ui/AlignedDataTable';

type TopMember = {
  membershipId: string;
  name: string;
  clvScore: number;
  tier: string;
  totalSpend: number;
  purchaseCount: number;
};

export default function ClvReportPage() {
  const [dist, setDist] = useState<any[]>([]);
  const [top, setTop] = useState<TopMember[]>([]);
  const [churn, setChurn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const errs: string[] = [];
    Promise.all([
      apiClient.adminGetClvDistribution().catch((e: unknown) => {
        errs.push(e instanceof Error ? e.message : 'Failed to load CLV distribution');
        return null;
      }),
      apiClient.adminGetClvTop(30).catch((e: unknown) => {
        errs.push(e instanceof Error ? e.message : 'Failed to load top members');
        return null;
      }),
      apiClient.adminGetChurnReport().catch((e: unknown) => {
        errs.push(e instanceof Error ? e.message : 'Failed to load churn report');
        return null;
      }),
    ]).then(([d, t, c]) => {
      const distData = d?.data;
      setDist(Array.isArray(distData) ? distData : (distData as any)?.buckets || []);
      setTop(Array.isArray(t?.data) ? (t.data as TopMember[]) : []);
      setChurn(c?.data || null);
      setErrors(errs);
    }).finally(() => setLoading(false));
  }, []);

  const columns = useMemo<AlignedColumn<TopMember>[]>(
    () => [
      {
        key: 'name',
        header: 'Name',
        width: '1.6fr',
        align: 'left',
        cell: (m) => <span className="font-medium">{m.name}</span>,
      },
      {
        key: 'clv',
        header: 'CLV',
        width: '1fr',
        align: 'right',
        cell: (m) => `$${Number(m.clvScore).toFixed(2)}`,
      },
      {
        key: 'tier',
        header: 'Tier',
        width: '1fr',
        align: 'left',
        cell: (m) => m.tier,
      },
      {
        key: 'spend',
        header: 'Spend',
        width: '1fr',
        align: 'right',
        cell: (m) => `$${Number(m.totalSpend).toFixed(2)}`,
      },
      {
        key: 'orders',
        header: 'Orders',
        width: '0.8fr',
        align: 'right',
        cell: (m) => m.purchaseCount,
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
        <h1 className="text-2xl font-semibold text-hos-text-secondary">CLV report</h1>
        {loading ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : (
          <>
            {errors.length > 0 && (
              <p className="text-sm text-red-400">{errors.join(' · ')}</p>
            )}
            <div>
              <h2 className="mb-2 text-lg font-medium">Distribution</h2>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                {dist.map((b: any) => (
                  <div key={b.bucket} className="rounded-lg border border-hos-border bg-hos-bg-secondary p-3">
                    <p className="text-hos-text-muted">{b.bucket}</p>
                    <p className="text-xl font-semibold">{b.count}</p>
                    <p className="text-xs text-hos-text-muted">avg ${Number(b.avgClv).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-medium">Top members</h2>
              <AlignedDataTable
                columns={columns}
                rows={top}
                rowKey={(m) => m.membershipId}
                minWidth={640}
                emptyMessage="No member CLV data available."
              />
            </div>
            {churn && (
              <div>
                <h2 className="mb-2 text-lg font-medium">Churn risk</h2>
                <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded border border-hos-border bg-hos-bg-secondary p-3">
                    <p className="text-hos-text-muted">Healthy</p>
                    <p className="text-xl font-semibold text-emerald-400">{churn.healthy}</p>
                  </div>
                  <div className="rounded border border-hos-border bg-hos-bg-secondary p-3">
                    <p className="text-hos-text-muted">At risk</p>
                    <p className="text-xl font-semibold text-amber-400">{churn.atRisk}</p>
                  </div>
                  <div className="rounded border border-hos-border bg-hos-bg-secondary p-3">
                    <p className="text-hos-text-muted">Churned</p>
                    <p className="text-xl font-semibold text-red-400">{churn.churned}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RouteGuard>
  );
}
