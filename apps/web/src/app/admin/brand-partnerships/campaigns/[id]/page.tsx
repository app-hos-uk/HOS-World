'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminBrandCampaignDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [row, setRow] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetBrandCampaign(id)
      .then((r) => setRow((r.data as Record<string, unknown>) || null))
      .catch((e: Error) => toast.error(e.message));
    apiClient
      .adminGetBrandCampaignReport(id)
      .then((r) => setReport((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Failed to load report'),
      );
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const p = row?.partnership as Record<string, unknown> | undefined;

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Link href="/admin/brand-partnerships/campaigns" className="text-sm text-violet-700">
            ← Campaigns
          </Link>
          {row ? (
            <>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{String(row.name)}</h1>
                  <p className="text-sm text-gray-500">
                    {String(row.type)} · {String(row.status)}
                    {p?.name ? ` · ${String(p.name)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status === 'DRAFT' || row.status === 'SCHEDULED' ? (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-emerald-600 text-white"
                      onClick={() => act(() => apiClient.adminActivateBrandCampaign(id), 'Activated')}
                    >
                      Activate
                    </button>
                  ) : null}
                  {row.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="text-sm px-2 py-1 rounded bg-amber-600 text-white"
                      onClick={() => act(() => apiClient.adminPauseBrandCampaign(id), 'Paused')}
                    >
                      Pause
                    </button>
                  ) : null}
                  {row.status !== 'COMPLETED' && row.status !== 'CANCELLED' ? (
                    <>
                      <button
                        type="button"
                        className="text-sm px-2 py-1 rounded bg-gray-800 text-white"
                        onClick={() => act(() => apiClient.adminCompleteBrandCampaign(id), 'Completed')}
                      >
                        Complete
                      </button>
                      <button
                        type="button"
                        className="text-sm px-2 py-1 rounded border border-gray-400"
                        onClick={() => act(() => apiClient.adminCancelBrandCampaign(id), 'Cancelled')}
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-white text-xs overflow-auto">
                <pre>{JSON.stringify(row, null, 2)}</pre>
              </div>
              {report && (
                <div className="border rounded-lg p-4 bg-white text-sm">
                  <p className="font-medium mb-2">Report</p>
                  <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(report, null, 2)}</pre>
                </div>
              )}
            </>
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
