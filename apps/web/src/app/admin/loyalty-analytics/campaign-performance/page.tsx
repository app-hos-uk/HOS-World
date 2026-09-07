'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { RouteGuard } from '@/components/RouteGuard';
import { DateRange, DateRangePicker } from '@/components/DateRangePicker';
import { AlignedDataTable, type AlignedColumn } from '@/components/ui/AlignedDataTable';
import { apiClient } from '@/lib/api';
import { useMoney } from '@/hooks/useMoney';

function defaultFrom(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d;
}
function defaultTo(): Date {
  return new Date();
}

type StoreOption = { id: string; name: string; code?: string };
type CampaignOption = { id: string; name: string; storeIds?: string[]; startsAt?: string; endsAt?: string };

type CampaignPerformance = {
  newRegistrations: number;
  avgTransactionValue: number;
  transactionsAboveThreshold: number;
  totalTransactions: number;
  thresholdRate: number;
  totalPointsAwarded: number;
  welcomeRewardsIssued: number;
  loyaltyBonusPointsAwarded: number;
  revenuePerDay: Array<{ date: string; revenue: number }>;
  threshold: number;
  bonusEarnRate: number;
  bonusPointsPerDollar: number;
  campaign: {
    id: string;
    name: string;
    storeIds: string[];
    startsAt: string;
    endsAt: string;
  } | null;
};

type BreakdownRow = {
  id: string;
  metric: string;
  value: string;
};

function isoDate(d: Date | null): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CampaignPerformancePage() {
  const { formatMoney, formatMoneyCompact } = useMoney();
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: defaultFrom(),
    endDate: defaultTo(),
  });
  const [storeId, setStoreId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [data, setData] = useState<CampaignPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [didSnapDates, setDidSnapDates] = useState(false);

  useEffect(() => {
    apiClient
      .adminListStores()
      .then((r) => {
        const d = r.data as StoreOption[] | undefined;
        setStores(Array.isArray(d) ? d : []);
      })
      .catch(() => setStores([]));
    apiClient
      .adminGetLoyaltyCampaigns()
      .then((r) => {
        const list = Array.isArray(r.data) ? (r.data as CampaignOption[]) : [];
        setCampaigns(list);
        const active = list.find((c) => {
          if (!c.storeIds?.length) return false;
          return true;
        }) ?? list[0];
        if (active) setCampaignId(active.id);
      })
      .catch(() => setCampaigns([]));
  }, []);

  const load = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.adminGetCampaignPerformance({
        campaignId: campaignId || undefined,
        storeId: storeId || undefined,
        from: isoDate(dateRange.startDate),
        to: isoDate(dateRange.endDate),
      });
      const result = (res.data as CampaignPerformance) ?? null;
      setData(result);
      if (!didSnapDates && result?.campaign?.startsAt && result?.campaign?.endsAt) {
        setDidSnapDates(true);
        setDateRange({
          startDate: new Date(result.campaign.startsAt),
          endDate: new Date(result.campaign.endsAt),
        });
      }
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed to load campaign performance');
    } finally {
      setLoading(false);
    }
  }, [campaignId, storeId, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const threshold = data?.threshold ?? 0;
  const bonusPct = Math.round((data?.bonusEarnRate ?? 0) * 100);

  const breakdownRows = useMemo<BreakdownRow[]>(() => {
    if (!data) return [];
    return [
      {
        id: 'welcome',
        metric: 'Welcome Rewards issued',
        value: String(data.welcomeRewardsIssued),
      },
      {
        id: 'bonus',
        metric: 'Loyalty Bonus points awarded',
        value: String(data.loyaltyBonusPointsAwarded),
      },
      {
        id: 'tx',
        metric: `Transactions ≥ ${formatMoney(threshold)}`,
        value: `${data.transactionsAboveThreshold} / ${data.totalTransactions}`,
      },
    ];
  }, [data, formatMoney, threshold]);

  const breakdownColumns = useMemo<AlignedColumn<BreakdownRow>[]>(
    () => [
      {
        key: 'metric',
        header: 'Metric',
        width: '2fr',
        align: 'left',
        cell: (r) => <span className="font-medium">{r.metric}</span>,
      },
      {
        key: 'value',
        header: 'Value',
        width: '1fr',
        align: 'right',
        cell: (r) => r.value,
      },
    ],
    [],
  );

  const kpi = (label: string, value: string, hint?: string) => (
    <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 shadow-sm">
      <p className="text-xs text-hos-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-hos-text-secondary">{value}</p>
      {hint ? <p className="mt-1 text-xs text-hos-text-muted">{hint}</p> : null}
    </div>
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Link href="/admin/loyalty-analytics" className="text-sm text-violet-400">
          ← Health
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Campaign performance</h1>
          <p className="mt-1 text-sm text-hos-text-muted">
            Track registrations, basket threshold rate, and bonus points issued for the selected
            campaign window.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-hos-border bg-hos-bg-secondary p-4">
          <DateRangePicker value={dateRange} onChange={setDateRange} disallowFutureDates={false} />
          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-sm text-hos-text-secondary">
              Campaign
              <select
                className="mt-1 block min-w-[16rem] rounded-md border border-hos-border bg-hos-bg-tertiary px-3 py-1.5 text-sm text-hos-text-primary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">All bonus campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-hos-text-secondary">
              Store
              <select
                className="mt-1 block min-w-[14rem] rounded-md border border-hos-border bg-hos-bg-tertiary px-3 py-1.5 text-sm text-hos-text-primary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              >
                <option value="">All stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.code ? ` (${s.code})` : ''}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="rounded-lg border border-hos-gold/40 bg-hos-gold/10 p-4 text-sm text-hos-text-secondary">
          <p className="font-medium text-hos-gold">Campaign quick reference</p>
          <p className="mt-1">
            Qualifying threshold: <strong>{formatMoney(threshold)}</strong>
            {' · '}
            Bonus rate: <strong>{bonusPct}%</strong>
            {data?.bonusPointsPerDollar != null ? (
              <>
                {' · '}
                {data.bonusPointsPerDollar} pts per currency unit of bonus
              </>
            ) : null}
          </p>
          {data?.campaign?.name ? (
            <p className="mt-1 text-hos-text-muted">Active filter: {data.campaign.name}</p>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {loading && !data ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {kpi('New registrations', String(data.newRegistrations), 'Memberships created in range')}
              {kpi(
                'Avg transaction value',
                formatMoney(data.avgTransactionValue),
                'Loyalty member orders & POS sales',
              )}
              {kpi(
                'Threshold rate',
                `${data.thresholdRate.toFixed(1)}%`,
                `${data.transactionsAboveThreshold} of ${data.totalTransactions} ≥ ${formatMoney(threshold)}`,
              )}
              {kpi('Total points awarded', String(data.totalPointsAwarded), 'Earn + bonus in period')}
            </div>

            <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4">
              <h2 className="mb-4 text-lg font-semibold text-hos-text-secondary">Daily revenue</h2>
              {data.revenuePerDay.every((d) => d.revenue === 0) ? (
                <p className="text-sm text-hos-text-muted">No loyalty member revenue in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.revenuePerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => formatMoneyCompact(Number(v))} width={72} />
                    <Tooltip
                      formatter={(value) => formatMoney(Number(value ?? 0))}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="var(--color-accent-gold)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4">
              <h2 className="mb-4 text-lg font-semibold text-hos-text-secondary">
                Welcome rewards vs loyalty bonus
              </h2>
              <AlignedDataTable
                columns={breakdownColumns}
                rows={breakdownRows}
                rowKey={(r) => r.id}
                minWidth={420}
                emptyMessage="No campaign activity in this range."
              />
            </div>
          </>
        ) : (
          <p className="text-hos-text-muted">No data available.</p>
        )}
      </div>
    </RouteGuard>
  );
}
