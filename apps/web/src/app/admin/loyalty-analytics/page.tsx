'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useMoney } from '@/hooks/useMoney';

const EXPORT_TYPES = ['clv', 'attribution', 'fandom', 'health'] as const;

export default function LoyaltyAnalyticsPage() {
  const { formatMoney } = useMoney();
  const toast = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [snapshotDate, setSnapshotDate] = useState('');
  const [computingSnapshot, setComputingSnapshot] = useState(false);
  const [recomputingClv, setRecomputingClv] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const [cohorts, setCohorts] = useState<any[] | null>(null);
  const [loadingCohorts, setLoadingCohorts] = useState(false);

  const load = useCallback(() => {
    apiClient
      .adminGetLoyaltyHealth()
      .then((r) => setData((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleComputeSnapshot = async () => {
    setComputingSnapshot(true);
    try {
      const res = await apiClient.adminComputeSnapshot(snapshotDate || undefined);
      toast.success(res?.message || 'Snapshot computed');
      load();
    } catch (err: any) {
      toast.error(err.message || 'Snapshot compute failed');
    } finally {
      setComputingSnapshot(false);
    }
  };

  const handleRecomputeClv = () => {
    setConfirmDialog({
      title: 'Recompute CLV for all members?',
      description: 'This may take a minute.',
      confirmLabel: 'Recompute',
      onConfirm: async () => {
        setConfirmDialog(null);
        setRecomputingClv(true);
        try {
          const res = await apiClient.adminRecomputeClv();
          const d = res?.data as { computed?: number; errors?: number } | undefined;
          toast.success(`CLV recomputed: ${d?.computed ?? 0} members, ${d?.errors ?? 0} errors`);
          load();
        } catch (err: any) {
          toast.error(err.message || 'CLV recompute failed');
        } finally {
          setRecomputingClv(false);
        }
      },
    });
  };

  const handleExport = async (type: string) => {
    setExporting(type);
    try {
      const res = await apiClient.adminExportLoyaltyReport(type, 'json');
      const blob = new Blob([JSON.stringify(res?.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loyalty-${type}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${type} report downloaded`);
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  const loadCohorts = async () => {
    setLoadingCohorts(true);
    try {
      const res = await apiClient.adminGetCohortRetention(6);
      const list = Array.isArray(res?.data) ? res.data : (res?.data as any)?.cohorts ?? [];
      setCohorts(list);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load cohorts');
    } finally {
      setLoadingCohorts(false);
    }
  };

  const d = data as any;
  const card = (label: string, val: unknown) => (
    <div className="border border-hos-border rounded-lg p-4 bg-hos-bg-secondary shadow-sm">
      <p className="text-hos-text-muted text-xs">{label}</p>
      <p className="text-xl font-semibold text-hos-text-secondary">{String(val ?? '—')}</p>
    </div>
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-hos-text-secondary">Program health</h1>
        {error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : loading ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : d ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {card('Total members', d.totalMembers)}
              {card('Active (30d)', d.activeLast30d)}
              {card('Active (90d)', d.activeLast90d)}
              {card('Avg CLV', d.avgClv != null ? formatMoney(Number(d.avgClv)) : '—')}
              {card('Churn rate', d.churnRate != null ? `${(Number(d.churnRate) * 100).toFixed(1)}%` : '—')}
              {card('Points liability', d.pointsLiability?.total)}
              {card('Liability cost', d.pointsLiability?.estimatedCost != null ? formatMoney(d.pointsLiability.estimatedCost) : '—')}
              {card('Revenue lift', d.revenueImpact?.liftPercent != null ? `${d.revenueImpact.liftPercent}%` : '—')}
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div className="border border-hos-border rounded-lg p-4 bg-hos-bg-secondary">
                <p className="text-hos-text-muted mb-2">Points velocity (30d)</p>
                <p>Issued: {d.pointsVelocity?.issuedLast30d ?? 0}</p>
                <p>Redeemed: {d.pointsVelocity?.redeemedLast30d ?? 0}</p>
                <p>Net: {d.pointsVelocity?.netChange ?? 0}</p>
              </div>
              <div className="border border-hos-border rounded-lg p-4 bg-hos-bg-secondary">
                <p className="text-hos-text-muted mb-2">Revenue impact (30d)</p>
                <p>Member: ${d.revenueImpact?.memberRevenue ?? 0}</p>
                <p>Non-member: ${d.revenueImpact?.nonMemberRevenue ?? 0}</p>
              </div>
            </div>

            {/* Sub-report links */}
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/admin/loyalty-analytics/clv" className="text-hos-gold hover:text-hos-gold-hover">CLV report →</Link>
              <Link href="/admin/loyalty-analytics/attribution" className="text-hos-gold hover:text-hos-gold-hover">Campaign ROI →</Link>
              <Link href="/admin/loyalty-analytics/fandom-trends" className="text-hos-gold hover:text-hos-gold-hover">Fandom trends →</Link>
              <Link href="/admin/loyalty-analytics/tiers" className="text-hos-gold hover:text-hos-gold-hover">Tier analysis →</Link>
              <Link href="/admin/loyalty-analytics/channels" className="text-hos-gold hover:text-hos-gold-hover">Channels →</Link>
            </div>

            {/* Operations */}
            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5 space-y-5">
              <h2 className="text-lg font-semibold text-hos-text-secondary">Operations</h2>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="snapshotDate" className="block text-xs uppercase text-hos-text-muted mb-1">
                    Snapshot date
                  </label>
                  <input
                    id="snapshotDate"
                    type="date"
                    value={snapshotDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setSnapshotDate(e.target.value)}
                    className="border border-hos-border rounded-lg px-3 py-2 bg-hos-bg-tertiary text-hos-text-primary focus:outline-none text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleComputeSnapshot}
                  disabled={computingSnapshot}
                  className="px-3 py-2 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
                >
                  {computingSnapshot ? 'Computing…' : snapshotDate ? `Compute snapshot for ${snapshotDate}` : 'Compute today\'s snapshot'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRecomputeClv}
                  disabled={recomputingClv}
                  className="px-3 py-2 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
                >
                  {recomputingClv ? 'Recomputing…' : 'Recompute CLV (all members)'}
                </button>
                <span className="text-xs text-hos-text-muted">Recalculates customer lifetime value for every loyalty member.</span>
              </div>

              <div>
                <p className="text-xs uppercase text-hos-text-muted mb-2">Export reports</p>
                <div className="flex flex-wrap gap-2">
                  {EXPORT_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleExport(type)}
                      disabled={exporting === type}
                      className="px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
                    >
                      {exporting === type ? 'Downloading…' : `Export ${type}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Cohort retention */}
            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-hos-text-secondary">Cohort retention</h2>
                <button
                  type="button"
                  onClick={loadCohorts}
                  disabled={loadingCohorts}
                  className="px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
                >
                  {loadingCohorts ? 'Loading…' : cohorts ? 'Refresh' : 'Load cohort data'}
                </button>
              </div>
              {cohorts === null ? (
                <p className="text-sm text-hos-text-muted">Click to load 6-month cohort retention data.</p>
              ) : cohorts.length === 0 ? (
                <p className="text-sm text-hos-text-muted">No cohort data available.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-hos-text-muted border-b border-hos-border">
                        <th className="py-2 pr-3">Cohort</th>
                        <th className="py-2 pr-3">Enrolled</th>
                        {cohorts[0]?.retention?.map((_: number, i: number) => (
                          <th key={i} className="py-2 pr-3 text-center">M{i + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.map((c: any) => (
                        <tr key={c.cohort} className="border-b border-hos-border/60">
                          <td className="py-2 pr-3 text-hos-text-secondary font-mono text-xs">{c.cohort}</td>
                          <td className="py-2 pr-3">{c.enrolled}</td>
                          {(c.retention || []).map((pct: number, i: number) => (
                            <td key={i} className="py-2 pr-3 text-center">
                              <span className={pct >= 50 ? 'text-green-400' : pct >= 25 ? 'text-amber-400' : 'text-hos-text-muted'}>
                                {(pct * 100).toFixed(0)}%
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-hos-text-muted">No data available.</p>
        )}
      </div>
            {confirmDialog && (
          <ConfirmDialog
            open
            title={confirmDialog.title}
            description={confirmDialog.description}
            tone={confirmDialog.tone}
            confirmLabel={confirmDialog.confirmLabel}
            onCancel={() => setConfirmDialog(null)}
            onConfirm={confirmDialog.onConfirm}
          />
        )}
</RouteGuard>
  );
}
