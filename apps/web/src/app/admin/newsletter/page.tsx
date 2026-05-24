'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

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
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <RouteGuard allowedRoles={[...ALLOWED_ROLES]}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Newsletter Subscriptions</h1>
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
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hos-border bg-hos-bg-secondary">
                      {subscriptions.map((sub) => (
                        <tr key={sub.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-white">
                            {sub.email}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                sub.status === 'subscribed'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-hos-bg-tertiary text-white'
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
      </AdminLayout>
    </RouteGuard>
  );
}
