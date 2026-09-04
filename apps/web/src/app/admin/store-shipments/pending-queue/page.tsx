'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type QueueItem = {
  id: string;
  hosOrderNumber?: string;
  invoiceNumber?: string;
  claimEmail?: string;
  status: string;
  customerName?: string;
  store?: { name?: string; code?: string };
  createdAt: string;
  claimTokenExpiresAt?: string;
};

function timeSince(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isExpired(dateStr?: string) {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

export default function PendingCustomerQueuePage() {
  const toast = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.listPendingCustomerQueue({ page, limit });
      const data = r.data as { items?: QueueItem[]; pagination?: { total?: number } };
      setItems(data?.items || []);
      setTotal(data?.pagination?.total || 0);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pending Customer Queue</h1>
          <p className="text-sm text-hos-text-muted mt-1">
            Shipping orders awaiting customer registration or data completion.
            {total > 0 && ` ${total} total.`}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-sm text-violet-400 underline disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && items.length === 0 ? (
        <p className="text-hos-text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-hos-border p-8 text-center">
          <p className="text-hos-text-secondary">No shipments are waiting for customer registration.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-hos-border text-left">
                  <th className="py-2 pr-4">HOS Order</th>
                  <th className="py-2 pr-4">Invoice</th>
                  <th className="py-2 pr-4">Store</th>
                  <th className="py-2 pr-4">Customer Email</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Claim Link</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const expired = isExpired(row.claimTokenExpiresAt);
                  return (
                    <tr key={row.id} className="border-b border-hos-border/50">
                      <td className="py-2 pr-4 font-mono text-xs">
                        {row.hosOrderNumber || '—'}
                      </td>
                      <td className="py-2 pr-4">{row.invoiceNumber || '—'}</td>
                      <td className="py-2 pr-4">{row.store?.name || '—'}</td>
                      <td className="py-2 pr-4">{row.claimEmail || '—'}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs bg-amber-900/30 text-amber-400">
                          {row.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-hos-text-muted text-xs">
                        {timeSince(row.createdAt)}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {expired ? (
                          <span className="text-red-400">Expired</span>
                        ) : (
                          <span className="text-green-400">Active</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-sm text-violet-400 disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm text-hos-text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-sm text-violet-400 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
