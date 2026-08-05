'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

export default function AdminMessagingLogsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string> = { page: '1', limit: '50' };
    if (channel) params.channel = channel;
    if (status) params.status = status;
    apiClient
      .adminGetMessageLogs(params)
      .then((r: any) => {
        setItems(r.data?.items || []);
        setTotal(r.data?.total ?? 0);
      })
      .catch((e: any) => setError(e?.message || 'Failed to load message logs'))
      .finally(() => setLoading(false));
  }, [channel, status]);

  useEffect(() => {
    load();
  }, [load]);

  const statusBadgeClass = (s: string) => {
    if (s === 'SENT') return 'bg-green-500/15 text-green-300';
    if (s === 'FAILED') return 'bg-red-500/15 text-red-400';
    if (s === 'SKIPPED_CONSENT') return 'bg-amber-500/15 text-amber-300';
    return 'bg-hos-bg-tertiary text-hos-text-secondary';
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Message Logs</h1>
            <p className="mt-1 text-sm text-hos-text-muted">
              Review outbound messaging delivery status across channels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-hos-text-secondary">
              Channel
              <select
                className="rounded border border-hos-border px-3 py-1.5 text-sm focus:border-hos-gold focus:outline-none focus:ring-1 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="">All</option>
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="PUSH">PUSH</option>
                <option value="IN_APP">IN_APP</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-hos-text-secondary">
              Status
              <select
                className="rounded border border-hos-border px-3 py-1.5 text-sm focus:border-hos-gold focus:outline-none focus:ring-1 focus:ring-hos-gold/50 bg-hos-bg-secondary text-hos-text-secondary"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="SENT">SENT</option>
                <option value="FAILED">FAILED</option>
                <option value="SKIPPED_CONSENT">SKIPPED_CONSENT</option>
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
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-hos-text-muted">No message logs found.</div>
            ) : (
              <>
                <div className="border-b border-hos-border px-4 py-3">
                  <p className="text-sm text-hos-text-secondary">Total: {total}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-hos-border">
                    <thead className="bg-hos-bg-secondary">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Channel
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Template
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-hos-text-muted">
                          User
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hos-border bg-hos-bg-secondary">
                      {items.map((m) => (
                        <tr key={m.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-hos-text-secondary">
                            {new Date(m.createdAt).toLocaleString()}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-hos-text-secondary">
                            {m.channel}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-hos-text-muted">
                            {m.templateSlug}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(m.status)}`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-hos-text-muted truncate max-w-[160px]">
                            {m.userId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
          </RouteGuard>
  );
}
