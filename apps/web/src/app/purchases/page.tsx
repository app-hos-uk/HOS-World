'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDateTime } from '@/hooks/useDateTime';
import { useCurrency } from '@/contexts/CurrencyContext';
import { DEFAULT_CURRENCY } from '@/lib/regionConfig';

export type PurchaseHistoryLine = {
  name: string;
  quantity: number;
  price: number;
};

export type PurchaseHistoryItem = {
  id: string;
  type: 'online' | 'in-store';
  date: string;
  storeName?: string | null;
  orderNumber?: string | null;
  items: PurchaseHistoryLine[];
  total: number;
  currency: string;
  pointsEarned: number;
  status: string;
  paidWithLoyaltyVoucher?: boolean;
};

type PurchaseHistoryPayload = {
  items?: PurchaseHistoryItem[];
  total?: number;
  page?: number;
  limit?: number;
  summary?: {
    onlineCount?: number;
    inStoreCount?: number;
    completedCount?: number;
    totalSpent?: number;
    totalPointsEarned?: number;
  };
};

function parsePurchaseHistory(
  res: { data?: unknown; pagination?: { total?: number } } | null,
): { rows: PurchaseHistoryItem[]; total: number } {
  const data = res?.data as PurchaseHistoryPayload | PurchaseHistoryItem[] | null;
  if (Array.isArray(data)) {
    return { rows: data, total: res?.pagination?.total ?? data.length };
  }
  if (data && Array.isArray(data.items)) {
    return {
      rows: data.items,
      total: typeof data.total === 'number' ? data.total : (res?.pagination?.total ?? data.items.length),
    };
  }
  return { rows: [], total: 0 };
}

function statusClass(status: string) {
  switch ((status || '').toUpperCase()) {
    case 'PENDING':
      return 'bg-yellow-500/15 text-yellow-300';
    case 'PROCESSING':
    case 'SHIPPED':
    case 'FULFILLED':
      return 'bg-amber-500/15 text-amber-200';
    case 'DELIVERED':
    case 'COMPLETED':
    case 'PAID':
      return 'bg-emerald-500/15 text-emerald-300';
    case 'CANCELLED':
    case 'REFUNDED':
      return 'bg-red-500/15 text-red-300';
    default:
      return 'bg-stone-800 text-stone-300';
  }
}

function formatItems(items: PurchaseHistoryLine[]) {
  if (!items?.length) return '—';
  const preview = items
    .slice(0, 2)
    .map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`)
    .join(', ');
  const extra = items.length > 2 ? ` +${items.length - 2} more` : '';
  return `${preview}${extra}`;
}

export default function PurchaseHistoryPage() {
  const { formatDate } = useDateTime();
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PurchaseHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getPurchaseHistory({ page, limit });
      const parsed = parsePurchaseHistory(res);
      setRows(parsed.rows);
      setTotal(parsed.total);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load purchase history';
      toast.error(message);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-5xl">
          <Link
            href="/customer/dashboard"
            className="text-sm text-amber-200/80 font-secondary hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="font-primary text-3xl text-amber-100 mt-3 mb-2">Purchase history</h1>
          <p className="font-secondary text-stone-400 mb-8">
            Online orders and in-store visits linked to your Enchanted Circle account, including
            purchases paid with loyalty point vouchers.
          </p>

          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-stone-800 bg-stone-900/40 px-6 py-12 text-center">
              <p className="font-secondary text-stone-400 mb-4">No purchases yet.</p>
              <Link
                href="/products"
                className="inline-block rounded-lg bg-amber-500 px-5 py-2 text-sm font-medium text-stone-950 hover:bg-amber-400"
              >
                Browse the shop
              </Link>
            </div>
          ) : (
            <>
              <div className="md:hidden space-y-3">
                {rows.map((row) => (
                  <PurchaseCard
                    key={`${row.type}-${row.id}`}
                    row={row}
                    formatDate={formatDate}
                    formatPrice={formatPrice}
                  />
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-lg border border-stone-800">
                <table className="w-full text-sm font-secondary">
                  <thead className="bg-stone-900 text-stone-400">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Store / Order#</th>
                      <th className="px-3 py-2 text-left font-medium">Items</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium">Points</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.type}-${row.id}`} className="border-t border-stone-800 text-stone-200">
                        <td className="px-3 py-3 text-xs text-stone-400 whitespace-nowrap">
                          {row.date
                            ? formatDate(row.date, { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <TypeBadges row={row} />
                        </td>
                        <td className="px-3 py-3">
                          {row.type === 'in-store' ? (
                            <div>
                              <p className="text-stone-100">{row.storeName || 'In-store'}</p>
                              {row.orderNumber && (
                                <p className="text-xs text-stone-500">#{row.orderNumber}</p>
                              )}
                            </div>
                          ) : row.orderNumber ? (
                            <Link
                              href={`/orders/${row.id}`}
                              className="text-amber-200/90 hover:underline"
                            >
                              #{row.orderNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-stone-400 max-w-[16rem]">
                          {formatItems(row.items)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-amber-100">
                          {formatPrice(row.total, row.currency || DEFAULT_CURRENCY)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-stone-300">
                          {row.pointsEarned > 0 ? `+${row.pointsEarned}` : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(row.status)}`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {total > limit && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-stone-600 px-3 py-1.5 text-sm font-secondary disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-stone-500 font-secondary">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-stone-600 px-3 py-1.5 text-sm font-secondary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}

function TypeBadges({ row }: { row: PurchaseHistoryItem }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {row.type === 'in-store' ? (
        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-200 border border-amber-600/40">
          In-store
        </span>
      ) : (
        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-800 text-stone-200 border border-stone-600">
          Online
        </span>
      )}
      {row.paidWithLoyaltyVoucher && (
        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-100 border border-amber-500/50">
          Paid with loyalty points
        </span>
      )}
    </div>
  );
}

function PurchaseCard({
  row,
  formatDate,
  formatPrice,
}: {
  row: PurchaseHistoryItem;
  formatDate: (value: string, opts?: { day: 'numeric'; month: 'short'; year: 'numeric' }) => string;
  formatPrice: (amount: number, fromCurrency?: string) => string;
}) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-900/50 p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-stone-500 font-secondary">
            {row.date ? formatDate(row.date, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
          </p>
          {row.type === 'in-store' ? (
            <p className="font-primary text-stone-100 mt-1">{row.storeName || 'In-store'}</p>
          ) : (
            <Link href={`/orders/${row.id}`} className="font-primary text-amber-100 hover:underline">
              Order #{row.orderNumber || row.id.slice(0, 8)}
            </Link>
          )}
        </div>
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusClass(row.status)}`}>
          {row.status}
        </span>
      </div>
      <TypeBadges row={row} />
      <p className="font-secondary text-xs text-stone-400 mt-3">{formatItems(row.items)}</p>
      <div className="flex items-center justify-between mt-3">
        <p className="font-secondary text-amber-100 tabular-nums">
          {formatPrice(row.total, row.currency || DEFAULT_CURRENCY)}
        </p>
        <p className="font-secondary text-xs text-stone-500">
          {row.pointsEarned > 0 ? `+${row.pointsEarned} pts` : 'No points'}
        </p>
      </div>
    </div>
  );
}
