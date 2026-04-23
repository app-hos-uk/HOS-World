'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminAmbassadorsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListAmbassadors({
        status: status || undefined,
        tier: tier || undefined,
        search: search || undefined,
        limit: 100,
      })
      .then((r) => {
        const d = r.data as { items?: Record<string, unknown>[] };
        setRows(d?.items ?? []);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => setLoading(false));
  }, [toast, status, tier, search]);

  useEffect(() => {
    load();
  }, [load]);

  const suspend = async (id: string) => {
    try {
      await apiClient.adminSuspendAmbassador(id);
      toast.success('Suspended');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const reactivate = async (id: string) => {
    try {
      await apiClient.adminReactivateAmbassador(id);
      toast.success('Reactivated');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-6xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Ambassadors</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="GRADUATED">GRADUATED</option>
            </select>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="">All tiers</option>
              <option value="ADVOCATE">ADVOCATE</option>
              <option value="CHAMPION">CHAMPION</option>
              <option value="LEGEND">LEGEND</option>
            </select>
            <button
              type="button"
              className="text-sm px-3 py-1 rounded bg-gray-800 text-white"
              onClick={() => load()}
            >
              Apply
            </button>
            <Link href="/admin/ambassadors/dashboard" className="text-sm text-violet-700 ml-auto">
              Programme dashboard →
            </Link>
          </div>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Tier</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Referrals</th>
                    <th className="text-left p-2">Points</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const id = String(row.id);
                    const u = row.user as Record<string, string> | undefined;
                    const name =
                      row.displayName ||
                      [u?.firstName, u?.lastName].filter(Boolean).join(' ') ||
                      u?.email ||
                      id;
                    return (
                      <tr key={id} className="border-t">
                        <td className="p-2">
                          <Link href={`/admin/ambassadors/${id}`} className="text-violet-700">
                            {String(name)}
                          </Link>
                        </td>
                        <td className="p-2">{String(row.tier)}</td>
                        <td className="p-2">{String(row.status)}</td>
                        <td className="p-2">{String(row.totalReferralSignups ?? 0)}</td>
                        <td className="p-2">{String(row.totalPointsEarnedAsAmb ?? 0)}</td>
                        <td className="p-2 space-x-2">
                          {row.status === 'ACTIVE' ? (
                            <button
                              type="button"
                              className="text-amber-700"
                              onClick={() => suspend(id)}
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-emerald-700"
                              onClick={() => reactivate(id)}
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
