'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DataExport } from '@/components/DataExport';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { flattenLedgerRow, LEDGER_EXPORT_COLUMNS } from '@/lib/loyaltyLedgerExport';
import { useMoney } from '@/hooks/useMoney';
import { useDateTime } from '@/hooks/useDateTime';

const EXPORT_PAGE_SIZE = 200;

type PosSaleItem = {
  id?: string;
  name?: string;
  quantity: number;
  unitPrice: number | string;
  totalPrice: number | string;
};

type PosSale = {
  id: string;
  saleDate: string;
  totalAmount: number | string;
  currency?: string;
  loyaltyPointsEarned?: number;
  status: string;
  store?: { name?: string; code?: string } | null;
  items?: PosSaleItem[];
};

const SALE_STATUS_BADGE: Record<string, string> = {
  IMPORTED: 'bg-blue-500/20 text-blue-300',
  imported: 'bg-blue-500/20 text-blue-300',
  matched: 'bg-emerald-500/20 text-emerald-300',
  MATCHED: 'bg-emerald-500/20 text-emerald-300',
  unmatched: 'bg-amber-500/20 text-amber-300',
  UNMATCHED: 'bg-amber-500/20 text-amber-300',
  VOIDED: 'bg-red-500/20 text-red-300',
  error: 'bg-red-500/20 text-red-300',
  ERROR: 'bg-red-500/20 text-red-300',
};

function num(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function AdminLoyaltyMemberLedgerPage() {
  const { formatDate, formatDateTime } = useDateTime();
  const { formatMoney } = useMoney();
  const params = useParams();
  const userId = String(params?.userId || '');
  const toast = useToast();
  const [instruments, setInstruments] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [adjustDelta, setAdjustDelta] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');

  const [sales, setSales] = useState<PosSale[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const instRes = await apiClient.adminGetLoyaltyMemberInstruments(userId);
      setInstruments(instRes?.data ?? null);
      const membershipId = (instRes?.data as any)?.membership?.id;
      if (membershipId) {
        const txRes = await apiClient.adminGetLoyaltyTransactions(membershipId, {
          type: type || undefined,
          limit: 100,
        });
        setTxs(Array.isArray(txRes?.data) ? (txRes.data as any[]) : []);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load member');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, type]);

  const loadPurchaseHistory = useCallback(async () => {
    if (!userId) return;
    try {
      setSalesLoading(true);
      setSalesError(null);
      const res = await fetch(
        `/api/proxy/admin/pos/sales?customerId=${encodeURIComponent(userId)}&limit=20`,
        { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
      );
      if (!res.ok) {
        throw new Error(`Failed to load purchase history (${res.status})`);
      }
      const body = await res.json();
      const payload = body?.data;
      const items: PosSale[] = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      setSales(items);
      setSalesTotal(
        typeof payload?.total === 'number' ? payload.total : items.length,
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load purchase history';
      setSalesError(message);
      setSales([]);
      setSalesTotal(0);
    } finally {
      setSalesLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void loadPurchaseHistory();
  }, [loadPurchaseHistory]);

  const membershipId = instruments?.membership?.id as string | undefined;

  const fetchAllForExport = useCallback(async () => {
    if (!membershipId) return [];
    const all: any[] = [];
    let page = 1;
    let pages = 1;
    do {
      const res = await apiClient.adminGetLoyaltyTransactions(membershipId, {
        type: type || undefined,
        page,
        limit: EXPORT_PAGE_SIZE,
      });
      all.push(...(Array.isArray(res?.data) ? (res.data as any[]) : []));
      pages = Math.max(1, (res as any)?.pagination?.totalPages ?? 1);
      page += 1;
    } while (page <= pages);
    return all.map(flattenLedgerRow);
  }, [membershipId, type]);

  const exportRows = useMemo(() => txs.map(flattenLedgerRow), [txs]);

  const purchaseSummary = useMemo(() => {
    const pageSpend = sales.reduce((sum, s) => sum + num(s.totalAmount), 0);
    const totalTransactions = salesTotal || sales.length;
    const avg = sales.length > 0 ? pageSpend / sales.length : 0;
    return { pageSpend, totalTransactions, avg, isPartial: salesTotal > sales.length };
  }, [sales, salesTotal]);

  const adjust = async () => {
    try {
      await apiClient.adminAdjustLoyaltyPoints(userId, Number(adjustDelta), adjustReason || 'Admin adjust');
      toast.success('Points adjusted');
      setAdjustDelta('0');
      setAdjustReason('');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Adjust failed');
    }
  };

  const m = instruments?.membership;

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-4">
        <Link href="/admin/loyalty/members" className="text-sm text-hos-gold font-ui">
          ← Members
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-hos-text-primary mb-1">Member ledger</h1>
      <p className="text-hos-text-secondary text-sm font-ui mb-6">
        {m?.user?.email || userId}
      </p>

      {loading ? (
        <p className="text-hos-text-secondary">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Card Number</p>
              <p className="text-sm text-hos-text-primary font-mono break-all">{m?.cardNumber || '—'}</p>
            </div>
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Balance</p>
              <p className="text-lg text-hos-text-primary font-ui">{m?.currentBalance ?? 0} pts</p>
            </div>
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Total earned</p>
              <p className="text-lg text-hos-text-primary font-ui">{m?.totalPointsEarned ?? 0}</p>
            </div>
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Tier</p>
              <p className="text-lg text-hos-text-primary font-ui">{m?.tier?.name || '—'}</p>
            </div>
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Active HOS GCs</p>
              <p className="text-lg text-hos-text-primary font-ui">
                {(instruments?.giftCards || []).length}
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 border border-hos-border rounded-lg bg-hos-bg-secondary flex flex-wrap gap-2 items-end">
            <label className="text-sm text-hos-text-secondary font-ui">
              Delta
              <input
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                className="block mt-1 px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
              />
            </label>
            <label className="text-sm text-hos-text-secondary font-ui flex-1 min-w-[200px]">
              Reason
              <input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="block mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
              />
            </label>
            <button
              type="button"
              onClick={adjust}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded font-semibold text-sm"
            >
              Adjust
            </button>
          </div>

          <div className="mb-3 flex gap-2 items-center">
            <h2 className="text-lg text-hos-gold font-display">Transactions</h2>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="ml-auto px-2 py-1 bg-hos-bg border border-hos-border-input rounded text-sm text-hos-text-primary"
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
              filename={`loyalty-ledger-${m?.user?.email || userId}`}
              resolveData={fetchAllForExport}
              showJson={false}
            />
          </div>

          <div className="overflow-x-auto border border-hos-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-hos-bg-secondary text-hos-text-secondary font-ui">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Points</th>
                  <th className="px-3 py-2 text-left">Channel</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-hos-border text-hos-text-primary">
                    <td className="px-3 py-2 font-ui text-xs">
                      {t.createdAt ? formatDateTime(t.createdAt) : '—'}
                    </td>
                    <td className="px-3 py-2 font-ui text-xs">{t.type}</td>
                    <td className="px-3 py-2 font-ui">{t.points}</td>
                    <td className="px-3 py-2 font-ui text-xs">{t.channel}</td>
                    <td className="px-3 py-2 font-ui text-xs">{t.source}</td>
                    <td className="px-3 py-2 font-ui text-xs">{t.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Purchase History */}
          <div className="mt-8">
            <h2 className="text-lg text-hos-gold font-display mb-3">Purchase History</h2>

            {salesLoading ? (
              <p className="text-hos-text-secondary text-sm font-ui">Loading purchase history…</p>
            ) : salesError ? (
              <div className="p-4 border border-hos-border rounded-lg bg-hos-bg-secondary">
                <p className="text-red-300 text-sm font-ui">{salesError}</p>
                <button
                  type="button"
                  onClick={() => void loadPurchaseHistory()}
                  className="mt-2 text-sm text-hos-gold font-ui hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : sales.length === 0 ? (
              <div className="p-6 border border-hos-border rounded-lg bg-hos-bg-secondary text-center">
                <p className="text-hos-text-secondary text-sm font-ui">
                  No purchase history found
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
                    <p className="text-xs text-hos-text-secondary font-ui">
                      {purchaseSummary.isPartial ? 'Spend (shown)' : 'Total Spend'}
                    </p>
                    <p className="text-lg text-hos-text-primary font-ui">
                      {formatMoney(purchaseSummary.pageSpend)}
                    </p>
                  </div>
                  <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
                    <p className="text-xs text-hos-text-secondary font-ui">Total Transactions</p>
                    <p className="text-lg text-hos-text-primary font-ui">
                      {purchaseSummary.totalTransactions}
                    </p>
                  </div>
                  <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
                    <p className="text-xs text-hos-text-secondary font-ui">
                      {purchaseSummary.isPartial ? 'Avg (shown)' : 'Avg Transaction Value'}
                    </p>
                    <p className="text-lg text-hos-text-primary font-ui">
                      {formatMoney(purchaseSummary.avg)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto border border-hos-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-hos-bg-secondary text-hos-text-secondary font-ui">
                      <tr>
                        <th className="px-3 py-2 text-left w-8" />
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Store</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Items Count</th>
                        <th className="px-3 py-2 text-right">Points Earned</th>
                        <th className="px-3 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((sale) => {
                        const expanded = expandedSaleId === sale.id;
                        const itemCount = sale.items?.length ?? 0;
                        return (
                          <Fragment key={sale.id}>
                            <tr
                              className="border-t border-hos-border text-hos-text-primary cursor-pointer hover:bg-hos-bg-tertiary transition-colors"
                              onClick={() =>
                                setExpandedSaleId(expanded ? null : sale.id)
                              }
                            >
                              <td className="px-3 py-2 text-hos-text-muted font-ui text-xs">
                                {expanded ? '▾' : '▸'}
                              </td>
                              <td className="px-3 py-2 font-ui text-xs">
                                {sale.saleDate ? formatDate(sale.saleDate) : '—'}
                              </td>
                              <td className="px-3 py-2 font-ui text-xs">
                                {sale.store?.name || sale.store?.code || '—'}
                              </td>
                              <td className="px-3 py-2 font-ui text-right">
                                {formatMoney(num(sale.totalAmount), sale.currency)}
                              </td>
                              <td className="px-3 py-2 font-ui text-right">{itemCount}</td>
                              <td className="px-3 py-2 font-ui text-right">
                                {sale.loyaltyPointsEarned && sale.loyaltyPointsEarned > 0
                                  ? `+${sale.loyaltyPointsEarned}`
                                  : '—'}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                    SALE_STATUS_BADGE[sale.status] ??
                                    'bg-hos-bg-tertiary text-hos-text-muted'
                                  }`}
                                >
                                  {sale.status}
                                </span>
                              </td>
                            </tr>
                            {expanded && (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="px-6 py-3 bg-hos-bg-tertiary border-t border-hos-border"
                                >
                                  {sale.items && sale.items.length > 0 ? (
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="text-hos-text-muted text-xs font-ui">
                                          <th className="text-left py-1 pr-4">Name</th>
                                          <th className="text-right py-1 pr-4">Qty</th>
                                          <th className="text-right py-1 pr-4">Unit price</th>
                                          <th className="text-right py-1">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-hos-text-primary font-ui">
                                        {sale.items.map((li, idx) => (
                                          <tr
                                            key={li.id ?? idx}
                                            className="border-t border-hos-border/50"
                                          >
                                            <td className="py-1 pr-4">{li.name || '—'}</td>
                                            <td className="py-1 pr-4 text-right">
                                              {li.quantity}
                                            </td>
                                            <td className="py-1 pr-4 text-right">
                                              {formatMoney(num(li.unitPrice), sale.currency)}
                                            </td>
                                            <td className="py-1 text-right">
                                              {formatMoney(num(li.totalPrice), sale.currency)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-hos-text-muted text-xs font-ui">
                                      No line items available.
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {(instruments?.posVouchers || []).length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg text-hos-gold font-display mb-2">POS vouchers</h2>
              <ul className="space-y-1 text-sm font-ui text-hos-text-secondary">
                {instruments.posVouchers.map((v: any) => (
                  <li key={v.id}>
                    {v.status} · {formatMoney(Number(v.amount), v.currency)} ·{' '}
                    {v.createdAt ? formatDate(v.createdAt) : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </RouteGuard>
  );
}
