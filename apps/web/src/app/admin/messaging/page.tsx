'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
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

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Message logs</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              className="border rounded px-2 py-1 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="">All channels</option>
              <option value="EMAIL">EMAIL</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WHATSAPP</option>
              <option value="PUSH">PUSH</option>
              <option value="IN_APP">IN_APP</option>
            </select>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="SENT">SENT</option>
              <option value="FAILED">FAILED</option>
              <option value="SKIPPED_CONSENT">SKIPPED_CONSENT</option>
            </select>
          </div>
          {error && <p className="text-red-600 mb-4">{error}</p>}
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-2">Total: {total}</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-left">
                    <tr>
                      <th className="px-2 py-2">Time</th>
                      <th className="px-2 py-2">Channel</th>
                      <th className="px-2 py-2">Template</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id} className="border-t border-gray-100">
                        <td className="px-2 py-1 whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                        <td className="px-2 py-1">{m.channel}</td>
                        <td className="px-2 py-1">{m.templateSlug}</td>
                        <td className="px-2 py-1">{m.status}</td>
                        <td className="px-2 py-1 font-mono truncate max-w-[120px]">{m.userId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
