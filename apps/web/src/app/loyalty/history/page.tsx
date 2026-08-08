'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function LoyaltyHistoryPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.getLoyaltyTransactions({ page, limit });
      const data = res?.data as { items?: any[]; total?: number } | any[] | null;
      if (Array.isArray(data)) {
        setRows(data);
        setTotal((res as any)?.pagination?.total ?? data.length);
      } else if (data && Array.isArray(data.items)) {
        setRows(data.items);
        setTotal(typeof data.total === 'number' ? data.total : data.items.length);
      } else {
        setRows([]);
        setTotal(0);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load history');
      setRows([]);
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
        <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
          <Link href="/loyalty" className="text-sm text-amber-200/80 font-secondary hover:underline">
            ← Loyalty home
          </Link>
          <h1 className="font-primary text-3xl text-amber-100 mt-3 mb-2">Points history</h1>
          <p className="font-secondary text-stone-400 mb-8">
            Earns, redemptions, and adjustments on your Enchanted Circle account.
          </p>

          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="font-secondary text-stone-500">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-800">
              <table className="w-full text-sm font-secondary">
                <thead className="bg-stone-900 text-stone-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Points</th>
                    <th className="px-3 py-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-t border-stone-800 text-stone-200">
                      <td className="px-3 py-2 text-xs text-stone-400">
                        {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="px-3 py-2">{t.type}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {Number(t.points) > 0 ? `+${t.points}` : t.points}
                      </td>
                      <td className="px-3 py-2 text-xs text-stone-400">
                        {t.description || t.source || t.channel || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > limit && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-stone-600 px-3 py-1.5 text-sm disabled:opacity-40"
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
                className="rounded-md border border-stone-600 px-3 py-1.5 text-sm disabled:opacity-40"
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
