'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DataExport } from '@/components/DataExport';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useMoney } from '@/hooks/useMoney';
import { useDateTime } from '@/hooks/useDateTime';

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 200;
const RETRYABLE = ['FAILED', 'PENDING'];

type Voucher = {
  id: string;
  membershipId: string;
  storeId: string;
  cardNumber?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  clientId?: string | null;
  externalTransactionId?: string | null;
  issuedAt?: string | null;
  createdAt?: string | null;
  metadata?: { lastError?: string; recoveredAfterError?: string } | null;
  membership?: { user?: { email?: string } | null } | null;
  store?: { name?: string; code?: string } | null;
};

function flatten(v: Voucher) {
  return {
    createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : '',
    issuedAt: v.issuedAt ? new Date(v.issuedAt).toISOString() : '',
    member: v.membership?.user?.email || v.membershipId,
    store: v.store?.name || v.storeId,
    amount: Number(v.amount).toFixed(2),
    currency: v.currency,
    cardNumber: v.cardNumber || '',
    status: v.status,
    externalTransactionId: v.externalTransactionId || '',
    clientId: v.clientId || '',
    lastError: v.metadata?.lastError || '',
  };
}

export default function AdminLoyaltyPosVouchersPage() {
  const { formatDateTime } = useDateTime();
  const { formatMoney } = useMoney();
  const toast = useToast();
  const [rows, setRows] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetLoyaltyPosVouchers({
        status: status || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setRows(Array.isArray(res?.data) ? (res.data as Voucher[]) : []);
      setTotal((res as any)?.pagination?.total ?? 0);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  }, [status, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const retry = useCallback(
    async (voucher: Voucher) => {
      setRetryingId(voucher.id);
      try {
        const res = await apiClient.adminRetryLoyaltyPosVoucher(voucher.id);
        const issued = (res?.data as { status?: string } | undefined)?.status;
        toast.success(
          issued === 'ISSUED'
            ? 'Gift card issued — points are now settled at the till'
            : `Retry finished with status ${issued || 'unknown'}`,
        );
        await load();
      } catch (e: any) {
        toast.error(e?.message || 'Retry failed');
      } finally {
        setRetryingId(null);
      }
    },
    [load, toast],
  );

  const cancelVoucher = useCallback(
    async (voucher: Voucher) => {
      if (!window.confirm('Void this voucher in Lightspeed and restore member points?')) return;
      setCancellingId(voucher.id);
      try {
        await apiClient.adminCancelLoyaltyPosVoucher(voucher.id, 'admin_void');
        toast.success('Voucher cancelled and points restored');
        await load();
      } catch (e: any) {
        toast.error(e?.message || 'Cancel failed');
      } finally {
        setCancellingId(null);
      }
    },
    [load, toast],
  );

  const fetchAllForExport = useCallback(async () => {
    const all: Voucher[] = [];
    let current = 1;
    let pages = 1;
    do {
      const res = await apiClient.adminGetLoyaltyPosVouchers({
        status: status || undefined,
        page: current,
        limit: EXPORT_PAGE_SIZE,
      });
      all.push(...(Array.isArray(res?.data) ? (res.data as Voucher[]) : []));
      pages = Math.max(1, (res as any)?.pagination?.totalPages ?? 1);
      current += 1;
    } while (current <= pages && current <= 50);
    return all.map(flatten);
  }, [status]);

  const exportColumns = useMemo(
    () => [
      { key: 'createdAt', header: 'Created' },
      { key: 'issuedAt', header: 'Issued' },
      { key: 'member', header: 'Member' },
      { key: 'store', header: 'Store' },
      { key: 'amount', header: 'Amount' },
      { key: 'currency', header: 'Currency' },
      { key: 'cardNumber', header: 'Card Number' },
      { key: 'status', header: 'Status' },
      { key: 'externalTransactionId', header: 'Lightspeed Txn' },
      { key: 'clientId', header: 'Client ID' },
      { key: 'lastError', header: 'Last Error' },
    ],
    [],
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hos-text-primary">POS Vouchers</h1>
          <p className="text-hos-text-secondary mt-1 text-sm font-ui">
            Points redeemed in-store as Lightspeed gift cards (HOS ledger of record). Failed
            issuances can be retried here — points are re-debited only if the burn was reversed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary text-sm"
          >
            <option value="">All statuses</option>
            {['PENDING', 'ISSUED', 'FAILED', 'REVERSED', 'RECONCILED'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <DataExport
            data={rows.map(flatten)}
            columns={exportColumns}
            filename="loyalty-pos-vouchers"
            resolveData={fetchAllForExport}
            showJson={false}
          />
        </div>
      </div>

      {loading ? (
        <p className="text-hos-text-secondary">Loading…</p>
      ) : (
        <div className="overflow-x-auto border border-hos-border rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-hos-bg-secondary text-hos-text-secondary font-ui">
              <tr>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Member</th>
                <th className="px-3 py-2">Store</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Card</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="border-t border-hos-border text-hos-text-primary">
                  <td className="px-3 py-2 font-ui text-xs">
                    {v.createdAt ? formatDateTime(v.createdAt) : '—'}
                  </td>
                  <td className="px-3 py-2 font-ui text-xs">
                    {v.membership?.user?.email || v.membershipId}
                  </td>
                  <td className="px-3 py-2 font-ui text-xs">{v.store?.name || v.storeId}</td>
                  <td className="px-3 py-2 font-ui">
                    {formatMoney(Number(v.amount), v.currency)}
                  </td>
                  <td className="px-3 py-2 font-ui text-xs">
                    {v.cardNumber ? `****${String(v.cardNumber).slice(-4)}` : '—'}
                  </td>
                  <td className="px-3 py-2 font-ui text-xs">
                    <span
                      className={
                        v.status === 'FAILED'
                          ? 'text-red-400'
                          : v.status === 'ISSUED' || v.status === 'RECONCILED'
                            ? 'text-green-400'
                            : 'text-amber-400'
                      }
                    >
                      {v.status}
                    </span>
                    {v.metadata?.lastError && (
                      <span
                        className="block max-w-xs truncate text-hos-text-secondary"
                        title={v.metadata.lastError}
                      >
                        {v.metadata.lastError}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    {RETRYABLE.includes(v.status) ? (
                      <button
                        type="button"
                        onClick={() => retry(v)}
                        disabled={retryingId === v.id}
                        className="px-3 py-1 border border-hos-border rounded text-xs font-ui hover:bg-hos-bg-secondary disabled:opacity-40"
                      >
                        {retryingId === v.id ? 'Retrying…' : 'Retry issuance'}
                      </button>
                    ) : v.status === 'ISSUED' ? (
                      <button
                        type="button"
                        onClick={() => cancelVoucher(v)}
                        disabled={cancellingId === v.id}
                        className="px-3 py-1 border border-red-500/50 text-red-400 rounded text-xs font-ui hover:bg-red-500/10 disabled:opacity-40"
                      >
                        {cancellingId === v.id ? 'Cancelling…' : 'Void voucher'}
                      </button>
                    ) : (
                      <span className="text-hos-text-secondary text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-hos-text-secondary">
                    No vouchers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border border-hos-border rounded text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-hos-text-secondary font-ui self-center">Page {page}</span>
          <button
            type="button"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border border-hos-border rounded text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </RouteGuard>
  );
}
