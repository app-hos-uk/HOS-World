'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useMoney } from '@/hooks/useMoney';
import { useDateTime } from '@/hooks/useDateTime';

type LastPosted = {
  id: string;
  periodDate: string;
  postedAt: string | null;
  xeroJournalId: string | null;
};

type ThreeWayReport = {
  asOf: string;
  pointsLiability: {
    totalPoints: number;
    redeemValuePerPoint: number;
    estimatedCurrencyLiability: number;
    currency: string;
  };
  giftCards: {
    issuedVoucherCount: number;
    issuedAmount: number;
    failedCount: number;
    openDiscrepancyCount: number;
  };
  xero: {
    accountingEnabled: boolean;
    connected: boolean;
    coa: { pointsLiability: string; giftCardLiability: string };
    lastPostedByType: Record<string, LastPosted | null>;
  };
  notes: string[];
};

export default function ThreeWayReconPage() {
  const toast = useToast();
  const { formatMoney, currency: regionCurrency } = useMoney();
  const { formatDate, formatDateTime } = useDateTime();
  const [report, setReport] = useState<ThreeWayReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getThreeWayRecon();
      setReport((res?.data as ThreeWayReport) ?? null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load three-way recon');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const currency = report?.pointsLiability.currency || regionCurrency;

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Three-way reconciliation</h1>
            <p className="text-hos-text-muted mt-1">
              HOS points wallet · Lightspeed gift-card vouchers · Xero liability journals
            </p>
            {report?.asOf && (
              <p className="text-xs text-hos-text-muted mt-1">
                As of {formatDateTime(report.asOf)}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            <Link
              href="/admin/finance/accounting"
              className="px-4 py-2 text-sm font-medium rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary"
            >
              Accounting admin →
            </Link>
          </div>
        </div>

        {loading && !report ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : !report ? (
          <p className="text-hos-text-muted">No report available.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <section className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-hos-text-muted">
                  1 · HOS points wallet
                </h2>
                <p className="mt-3 text-3xl font-bold text-hos-text-secondary">
                  {report.pointsLiability.totalPoints.toLocaleString()}
                </p>
                <p className="text-sm text-hos-text-muted">points outstanding</p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-hos-text-muted">Redeem value / pt</dt>
                    <dd className="text-hos-text-secondary">
                      {formatMoney(report.pointsLiability.redeemValuePerPoint, currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-hos-text-muted">Est. liability</dt>
                    <dd className="font-medium text-hos-text-secondary">
                      {formatMoney(report.pointsLiability.estimatedCurrencyLiability, currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-hos-text-muted">Xero CoA</dt>
                    <dd className="font-mono text-hos-text-secondary">
                      {report.xero.coa.pointsLiability}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-hos-text-muted">
                  2 · LS gift cards (bridge)
                </h2>
                <p className="mt-3 text-3xl font-bold text-hos-text-secondary">
                  {formatMoney(report.giftCards.issuedAmount, currency)}
                </p>
                <p className="text-sm text-hos-text-muted">
                  {report.giftCards.issuedVoucherCount} issued vouchers outstanding
                </p>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-hos-text-muted">Failed issues</dt>
                    <dd className={report.giftCards.failedCount > 0 ? 'text-red-400' : 'text-hos-text-secondary'}>
                      {report.giftCards.failedCount}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-hos-text-muted">Open GC discrepancies</dt>
                    <dd
                      className={
                        report.giftCards.openDiscrepancyCount > 0 ? 'text-amber-400' : 'text-hos-text-secondary'
                      }
                    >
                      {report.giftCards.openDiscrepancyCount}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-hos-text-muted">Xero CoA</dt>
                    <dd className="font-mono text-hos-text-secondary">
                      {report.xero.coa.giftCardLiability}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-hos-text-muted">
                  3 · Xero journals
                </h2>
                <p className="mt-3 text-lg font-semibold text-hos-text-secondary">
                  {report.xero.connected ? 'Connected' : 'Not connected'}
                  <span className="text-sm font-normal text-hos-text-muted ml-2">
                    · {report.xero.accountingEnabled ? 'posting on' : 'posting off'}
                  </span>
                </p>
                <ul className="mt-4 space-y-3 text-sm">
                  {Object.entries(report.xero.lastPostedByType).map(([type, row]) => (
                    <li key={type} className="border-t border-hos-border/50 pt-2">
                      <p className="font-medium text-hos-text-secondary">{type}</p>
                      {row ? (
                        <p className="text-hos-text-muted text-xs mt-0.5">
                          Period {row.periodDate}
                          {row.xeroJournalId ? ` · ${row.xeroJournalId}` : ''}
                          {row.postedAt ? ` · ${formatDate(row.postedAt)}` : ''}
                        </p>
                      ) : (
                        <p className="text-hos-text-muted text-xs mt-0.5">No POSTED entry yet</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {report.notes?.length > 0 && (
              <div className="bg-hos-bg-tertiary/50 rounded-lg border border-hos-border p-4">
                <h3 className="text-sm font-medium text-hos-text-secondary mb-2">Notes</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-hos-text-muted">
                  {report.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </RouteGuard>
  );
}
