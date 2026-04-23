'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminBrandPartnershipDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetBrandPartnership(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: Error) => toast.error(e.message));
    apiClient
      .adminGetBrandPartnershipReport(id)
      .then((r) => setReport((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Failed to load report'),
      );
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const campaigns = (row?.campaigns as Record<string, unknown>[]) ?? [];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <Link href="/admin/brand-partnerships" className="text-sm text-violet-700">
            ← All partners
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{String(row.name)}</h1>
                  <p className="text-sm text-gray-500">
                    {String(row.status)} · {String(row.slug)}
                  </p>
                </div>
                <Link
                  href={`/admin/brand-partnerships/${id}/campaigns/new`}
                  className="rounded-md bg-violet-700 px-3 py-2 text-white text-sm"
                >
                  New campaign
                </Link>
              </div>
              <div className="border rounded-lg p-4 bg-white text-sm">
                <p className="font-medium mb-2">Budget</p>
                <p>
                  Spent {String(row.spentBudget)} / {String(row.totalBudget)} {String(row.currency)}
                </p>
              </div>
              {report && (
                <div className="border rounded-lg p-4 bg-white text-sm">
                  <p className="font-medium mb-2">Report snapshot</p>
                  <pre className="text-xs overflow-auto max-h-48">{JSON.stringify(report, null, 2)}</pre>
                </div>
              )}
              <div>
                <h2 className="text-lg font-medium mb-2">Campaigns</h2>
                <ul className="space-y-2">
                  {campaigns.map((c) => (
                    <li key={String(c.id)} className="border rounded p-2 bg-white flex justify-between">
                      <span>{String(c.name)}</span>
                      <span className="text-gray-500 text-xs">{String(c.status)}</span>
                      <Link
                        href={`/admin/brand-partnerships/campaigns/${String(c.id)}`}
                        className="text-violet-600 text-sm"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
