'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DataExport } from '@/components/DataExport';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { flattenLedgerRow, LEDGER_EXPORT_COLUMNS } from '@/lib/loyaltyLedgerExport';

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 200;
/** Ledgers can be very large; cap a single export and tell the user to narrow the range. */
const EXPORT_MAX_PAGES = 100;

export default function AdminLoyaltyTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyTransactions(undefined, {
        type: type || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setTransactions(Array.isArray(res?.data) ? (res.data as any[]) : []);
      const pagination = (res as any)?.pagination;
      setTotal(pagination?.total ?? 0);
      setTotalPages(Math.max(1, pagination?.totalPages ?? 1));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [toast, page, type, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchAllForExport = useCallback(async () => {
    const all: any[] = [];
    let current = 1;
    let pages = 1;
    do {
      const res = await apiClient.adminGetLoyaltyTransactions(undefined, {
        type: type || undefined,
        from: from || undefined,
        to: to || undefined,
        page: current,
        limit: EXPORT_PAGE_SIZE,
      });
      all.push(...(Array.isArray(res?.data) ? (res.data as any[]) : []));
      pages = Math.max(1, (res as any)?.pagination?.totalPages ?? 1);
      current += 1;
    } while (current <= pages && current <= EXPORT_MAX_PAGES);
    if (pages > EXPORT_MAX_PAGES) {
      toast.warning(
        `Export capped at ${(EXPORT_MAX_PAGES * EXPORT_PAGE_SIZE).toLocaleString()} rows — narrow the date range for a complete period export.`,
      );
    }
    return all.map(flattenLedgerRow);
  }, [type, from, to, toast]);

  const exportRows = useMemo(() => transactions.map(flattenLedgerRow), [transactions]);

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hos-text-secondary">Points Transactions</h1>
          <p className="text-hos-text-secondary mt-1">
            Recent loyalty point transactions across all members
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-hos-text-muted font-ui">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="ml-1 px-2 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary text-sm"
            />
          </label>
          <label className="text-xs text-hos-text-muted font-ui">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="ml-1 px-2 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary text-sm"
            />
          </label>
          <select
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value);
            }}
            className="px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary text-sm"
          >
            <option value="">All types</option>
            {['EARN', 'BURN', 'EXPIRE', 'ADJUST', 'BONUS', 'TRANSFER'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <DataExport
            data={exportRows}
            columns={LEDGER_EXPORT_COLUMNS}
            filename="loyalty-ledger"
            resolveData={fetchAllForExport}
            showJson={false}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
        </div>
      ) : (
        <div className="bg-hos-bg-secondary border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-hos-bg-secondary border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Action</th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary">Points</th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary">
                    Balance After
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-hos-bg-tertiary">
                    <td className="px-4 py-3 text-hos-text-muted text-xs whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-hos-text-secondary text-xs">
                      {tx.membership?.user?.email ? (
                        <a
                          href={`/admin/loyalty/members/${tx.membership.userId}`}
                          className="hover:text-hos-gold"
                        >
                          {tx.membership.user.email}
                        </a>
                      ) : (
                        tx.membershipId?.slice(0, 8) || '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          tx.type === 'EARN'
                            ? 'bg-green-500/15 text-green-400'
                            : tx.type === 'BURN' || tx.type === 'REDEEM'
                              ? 'bg-red-500/15 text-red-400'
                              : tx.type === 'ADJUST'
                                ? 'bg-amber-500/15 text-amber-400'
                                : tx.type === 'EXPIRE'
                                  ? 'bg-hos-bg-tertiary text-hos-text-secondary'
                                  : 'bg-hos-gold/20 text-hos-gold'
                        }`}
                      >
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-hos-text-secondary">
                      {tx.source || tx.action || '—'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-semibold ${
                        tx.points > 0
                          ? 'text-green-400'
                          : tx.points < 0
                            ? 'text-red-400'
                            : 'text-hos-text-secondary'
                      }`}
                    >
                      {tx.points > 0 ? '+' : ''}
                      {tx.points}
                    </td>
                    <td className="px-4 py-3 text-right text-hos-text-secondary">
                      {tx.balanceAfter != null
                        ? Number(tx.balanceAfter).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-hos-text-muted text-xs max-w-[200px] truncate">
                      {tx.description || tx.reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length === 0 && (
            <div className="p-8 text-center text-hos-text-muted">No transactions recorded yet.</div>
          )}
          {total > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-hos-border">
              <p className="text-sm text-hos-text-muted">
                {total.toLocaleString()} total · page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </RouteGuard>
  );
}
