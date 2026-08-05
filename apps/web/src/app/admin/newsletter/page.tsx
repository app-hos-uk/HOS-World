'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Subscription {
  id: string;
  email: string;
  userId: string | null;
  status: string;
  source: string | null;
  subscribedAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
}

const ALLOWED_ROLES = ['ADMIN', 'MARKETING', 'CMS_EDITOR'] as const;

export default function AdminNewsletterPage() {
  const toast = useToast();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsubscribingEmail, setUnsubscribingEmail] = useState<string | null>(null);

  const fetchSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.newsletterGetSubscriptions({
        status: statusFilter || undefined,
        page,
        limit,
      });
      if (res?.data) {
        const d = res.data as { data: Subscription[]; total: number; page: number; limit: number; totalPages: number };
        setSubscriptions(d.data || []);
        setTotal(d.total ?? 0);
        setPage(d.page ?? page);
        setTotalPages(d.totalPages ?? 0);
      }
    } catch (err: unknown) {
      setError(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to load subscriptions');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [page, statusFilter]);

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return s;
    }
  };

  const handleUnsubscribe = async (email: string) => {
    if (!confirm(`Unsubscribe ${email} from the newsletter?`)) return;
    setUnsubscribingEmail(email);
    try {
      await apiClient.newsletterUnsubscribe(email);
      toast.success('Unsubscribed successfully');
      // If this was the last row on a later page, step back so the table is not empty.
      if (subscriptions.length <= 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      } else {
        await fetchSubscriptions();
      }
    } catch (err: unknown) {
      toast.error(
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Failed to unsubscribe',
      );
    } finally {
      setUnsubscribingEmail(null);
    }
  };

  return (
    <RouteGuard allowedRoles={[...ALLOWED_ROLES]}>
              <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Newsletter Subscriptions</h1>
            <p className="mt-1 text-sm text-hos-text-muted">
              View and manage newsletter subscribers. Visible to Admin, Marketing, and CMS Editor.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-hos-text-secondary">
              Status
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded border border-hos-border px-3 py-1.5 text-sm focus:border-hos-gold focus:outline-none focus:ring-1 focus:ring-hos-gold/50"
              >
                <option value="">All</option>
                <option value="subscribed">Subscribed</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
            </label>
          </div>

          {error && (
            <div className="rounded-md bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-hos-border bg-hos-bg-secondary shadow">
            {loading ? (
              <div className="p-8 text-center text-hos-text-muted">Loading…</div>
            ) : subscriptions.length === 0 ? (
              <div className="p-8 text-center text-hos-text-muted">No subscriptions found.</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Source
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Subscribed
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Unsubscribed
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hos-border bg-hos-bg-secondary">
                      {subscriptions.map((sub) => (
                        <tr key={sub.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-hos-text-secondary">
                            {sub.email}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                sub.status === 'subscribed'
                                  ? 'bg-green-500/15 text-green-300'
                                  : 'bg-hos-bg-tertiary text-hos-text-secondary'
                              }`}
                            >
                              {sub.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-hos-text-muted">
                            {sub.source || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-hos-text-muted">
                            {formatDate(sub.subscribedAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-hos-text-muted">
                            {sub.unsubscribedAt ? formatDate(sub.unsubscribedAt) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                            {sub.status === 'subscribed' ? (
                              <button
                                type="button"
                                onClick={() => handleUnsubscribe(sub.email)}
                                disabled={unsubscribingEmail === sub.email}
                                className="text-red-400 hover:text-red-300 disabled:opacity-50"
                              >
                                {unsubscribingEmail === sub.email ? 'Unsubscribing…' : 'Unsubscribe'}
                              </button>
                            ) : (
                              <span className="text-hos-text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-hos-border bg-hos-bg-secondary px-4 py-3">
                    <p className="text-sm text-hos-text-secondary">
                      Showing page {page} of {totalPages} ({total} total)
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded border border-hos-border bg-hos-bg-secondary px-3 py-1 text-sm font-medium text-hos-text-secondary shadow-sm hover:bg-hos-bg-tertiary disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded border border-hos-border bg-hos-bg-secondary px-3 py-1 text-sm font-medium text-hos-text-secondary shadow-sm hover:bg-hos-bg-tertiary disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
          </RouteGuard>
  );
}
