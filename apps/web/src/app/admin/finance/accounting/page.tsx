'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type CoaMapping = {
  onlineRevenue: string;
  onlineTax: string;
  stripeReceivable: string;
  stripeFees: string;
  refunds: string;
  pointsLiability: string;
  pointsBreakage: string;
  giftCardLiability: string;
  giftCardExpiryRevenue: string;
  loyaltyDiscount: string;
  currency: string;
};

const COA_FIELDS: Array<{ key: keyof CoaMapping; label: string }> = [
  { key: 'onlineRevenue', label: 'Online revenue' },
  { key: 'onlineTax', label: 'Online tax' },
  { key: 'stripeReceivable', label: 'Stripe receivable' },
  { key: 'stripeFees', label: 'Stripe fees' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'pointsLiability', label: 'Points liability' },
  { key: 'pointsBreakage', label: 'Points breakage' },
  { key: 'giftCardLiability', label: 'Gift card liability' },
  { key: 'giftCardExpiryRevenue', label: 'Gift card expiry revenue' },
  { key: 'loyaltyDiscount', label: 'Loyalty discount' },
  { key: 'currency', label: 'Currency' },
];

const STATUS_FILTERS = ['', 'PENDING', 'POSTING', 'POSTED', 'FAILED', 'DEAD'];

function statusBadgeClass(status: string) {
  switch (status) {
    case 'POSTED':
      return 'bg-green-500/15 text-green-400';
    case 'FAILED':
    case 'DEAD':
      return 'bg-red-500/15 text-red-400';
    case 'POSTING':
      return 'bg-amber-500/15 text-amber-400';
    default:
      return 'bg-hos-bg-tertiary text-hos-text-muted';
  }
}

export default function AccountingAdminPage() {
  const toast = useToast();
  const [status, setStatus] = useState<any>(null);
  const [outbox, setOutbox] = useState<any[]>([]);
  const [outboxTotal, setOutboxTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [coa, setCoa] = useState<CoaMapping | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCoa, setSavingCoa] = useState(false);
  const [draining, setDraining] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [journalDate, setJournalDate] = useState('');
  const [runningJournals, setRunningJournals] = useState(false);
  const [remoteAccounts, setRemoteAccounts] = useState<any[] | null>(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, outboxRes, coaRes] = await Promise.all([
        apiClient.getAccountingStatus(),
        apiClient.listAccountingOutbox({
          status: statusFilter || undefined,
          limit: 50,
        }),
        apiClient.getAccountingCoaMapping(),
      ]);
      setStatus(statusRes?.data ?? null);
      const payload = outboxRes?.data;
      setOutbox(Array.isArray(payload?.items) ? payload.items : []);
      setOutboxTotal(typeof payload?.total === 'number' ? payload.total : 0);
      setCoa((coaRes?.data as CoaMapping) ?? null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load accounting admin');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleConnect = async () => {
    try {
      const res = await apiClient.getAccountingConnectUrl();
      const url = res?.data?.url;
      if (!url) {
        toast.error('No connect URL returned');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message || 'Failed to get Xero connect URL');
    }
  };

  const handleDrain = async () => {
    try {
      setDraining(true);
      const res = await apiClient.drainAccountingOutbox();
      toast.success(res?.message || 'Outbox drain complete');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Drain failed — is ACCOUNTING_ENABLED + feature flag on?');
    } finally {
      setDraining(false);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      setRetryingId(id);
      await apiClient.retryAccountingOutbox(id);
      toast.success('Queued for retry');
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  const handleRunDailyJournals = async () => {
    try {
      setRunningJournals(true);
      const res = await apiClient.runAccountingDailyJournals(journalDate || undefined);
      const data = res?.data as
        | { periodDate?: string; enqueued?: string[]; skipped?: string[] }
        | undefined;
      const enqueued = data?.enqueued?.length ?? 0;
      const skipped = data?.skipped?.length ?? 0;
      toast.success(
        `${data?.periodDate ?? 'Period'}: ${enqueued} journal(s) enqueued${
          skipped ? `, ${skipped} skipped` : ''
        }`,
      );
      await load();
    } catch (err: any) {
      toast.error(err.message || 'Daily journal run failed');
    } finally {
      setRunningJournals(false);
    }
  };

  const loadRemoteAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const res = await apiClient.getAccountingRemoteAccounts();
      const list = Array.isArray(res?.data) ? res.data : (res?.data as any)?.accounts ?? [];
      setRemoteAccounts(list);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load remote accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleSaveCoa = async () => {
    if (!coa) return;
    try {
      setSavingCoa(true);
      const res = await apiClient.updateAccountingCoaMapping(coa);
      setCoa((res?.data as CoaMapping) ?? coa);
      toast.success('Chart of accounts mapping saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save CoA mapping');
    } finally {
      setSavingCoa(false);
    }
  };

  const connection = status?.connection;
  const enabled = Boolean(status?.enabled);

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Xero Accounting</h1>
            <p className="text-hos-text-muted mt-1">
              Ledger outbox, chart of accounts, and OAuth status. In-store POS sales stay on Lightspeed’s native Xero connector.
            </p>
          </div>
          <Link
            href="/admin/finance/three-way-recon"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary"
          >
            Three-way recon →
          </Link>
        </div>

        {loading && !status ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-4">
                <p className="text-xs uppercase text-hos-text-muted">Accounting gate</p>
                <p className={`mt-1 text-lg font-semibold ${enabled ? 'text-green-400' : 'text-amber-400'}`}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-xs text-hos-text-muted mt-2">
                  Env ACCOUNTING_ENABLED: {status?.accountingEnabledEnv ? 'on' : 'off'} · Flag ACCOUNTING_XERO:{' '}
                  {status?.featureFlag ? 'on' : 'off'}
                </p>
              </div>
              <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-4">
                <p className="text-xs uppercase text-hos-text-muted">Xero connection</p>
                <p className={`mt-1 text-lg font-semibold ${connection?.connected ? 'text-green-400' : 'text-hos-text-secondary'}`}>
                  {connection?.connected ? 'Connected' : 'Not connected'}
                </p>
                {connection?.tenantId && (
                  <p className="text-xs text-hos-text-muted mt-2 truncate">Tenant: {connection.tenantId}</p>
                )}
                <button
                  type="button"
                  onClick={handleConnect}
                  className="mt-3 px-3 py-1.5 text-sm rounded-lg bg-hos-gold text-[#1a1406] font-medium hover:opacity-90"
                >
                  Get connect URL
                </button>
              </div>
              <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-4">
                <p className="text-xs uppercase text-hos-text-muted">Outbox actions</p>
                <p className="mt-1 text-lg font-semibold text-hos-text-secondary">{outboxTotal} entries</p>
                <button
                  type="button"
                  onClick={handleDrain}
                  disabled={draining || !enabled}
                  className="mt-3 px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
                >
                  {draining ? 'Draining…' : 'Drain pending now'}
                </button>
              </div>
            </div>

            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
              <h2 className="text-lg font-semibold text-hos-text-secondary">Daily journals</h2>
              <p className="text-sm text-hos-text-muted mt-1">
                Journals post automatically for the previous UTC day. Re-run a specific day to
                backfill a missed period — posting is idempotent, so a repeat run will not
                double-post.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label
                    htmlFor="journalDate"
                    className="block text-xs uppercase text-hos-text-muted mb-1"
                  >
                    Period date
                  </label>
                  <input
                    id="journalDate"
                    type="date"
                    value={journalDate}
                    max={new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)}
                    onChange={(e) => setJournalDate(e.target.value)}
                    className="border border-hos-border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRunDailyJournals}
                  disabled={runningJournals || !enabled}
                  className="px-3 py-2 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
                >
                  {runningJournals
                    ? 'Running…'
                    : journalDate
                      ? `Run journals for ${journalDate}`
                      : 'Run journals for yesterday'}
                </button>
              </div>
            </div>

            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-hos-text-secondary">Ledger outbox</h2>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-hos-border bg-hos-bg-tertiary text-hos-text-primary"
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s || 'all'} value={s}>
                      {s || 'All statuses'}
                    </option>
                  ))}
                </select>
              </div>
              {outbox.length === 0 ? (
                <p className="text-sm text-hos-text-muted">No outbox entries.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-hos-text-muted border-b border-hos-border">
                        <th className="py-2 pr-3">Type</th>
                        <th className="py-2 pr-3">Period</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3">Xero journal</th>
                        <th className="py-2 pr-3">Error</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outbox.map((row) => (
                        <tr key={row.id} className="border-b border-hos-border/60">
                          <td className="py-2 pr-3 text-hos-text-secondary">{row.entryType}</td>
                          <td className="py-2 pr-3 text-hos-text-muted">
                            {row.periodDate ? String(row.periodDate).slice(0, 10) : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded text-xs ${statusBadgeClass(row.status)}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-hos-text-muted font-mono text-xs">
                            {row.xeroJournalId || '—'}
                          </td>
                          <td className="py-2 pr-3 text-red-400/90 max-w-[200px] truncate" title={row.lastError || ''}>
                            {row.lastError || '—'}
                          </td>
                          <td className="py-2">
                            {(row.status === 'FAILED' || row.status === 'DEAD') && (
                              <button
                                type="button"
                                onClick={() => handleRetry(row.id)}
                                disabled={retryingId === row.id || !enabled}
                                className="text-xs px-2 py-1 rounded border border-hos-border hover:bg-hos-bg-tertiary disabled:opacity-50"
                              >
                                {retryingId === row.id ? '…' : 'Retry'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-hos-bg-secondary rounded-lg border border-hos-border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-hos-text-secondary">Chart of accounts mapping</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={loadRemoteAccounts}
                    disabled={loadingAccounts || !enabled}
                    className="px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
                  >
                    {loadingAccounts ? 'Loading…' : remoteAccounts ? 'Refresh Xero accounts' : 'Load from Xero'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCoa}
                    disabled={!coa || savingCoa || !enabled}
                    title={!enabled ? 'Enable ACCOUNTING_ENABLED + ACCOUNTING_XERO to edit mapping' : undefined}
                    className="px-3 py-1.5 text-sm rounded-lg bg-hos-gold text-[#1a1406] font-medium hover:opacity-90 disabled:opacity-50"
                  >
                    {savingCoa ? 'Saving…' : 'Save mapping'}
                  </button>
                </div>
              </div>
              {remoteAccounts && (
                <datalist id="xero-accounts">
                  {remoteAccounts.map((a: any) => (
                    <option key={a.code || a.accountID} value={a.code ?? ''}>
                      {a.code} — {a.name} ({a.type})
                    </option>
                  ))}
                </datalist>
              )}
              {!coa ? (
                <p className="text-sm text-hos-text-muted">No CoA mapping loaded.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {COA_FIELDS.map(({ key, label }) => (
                    <label key={key} className="block text-sm">
                      <span className="text-hos-text-muted">{label}</span>
                      <input
                        list={remoteAccounts ? 'xero-accounts' : undefined}
                        value={coa[key] ?? ''}
                        onChange={(e) => setCoa({ ...coa, [key]: e.target.value })}
                        placeholder={remoteAccounts ? 'Type or pick account code…' : undefined}
                        className="mt-1 w-full px-3 py-2 rounded-lg border border-hos-border bg-hos-bg-tertiary text-hos-text-primary"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
