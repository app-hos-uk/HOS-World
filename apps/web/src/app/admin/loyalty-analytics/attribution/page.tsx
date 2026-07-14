'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

export default function AttributionPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient
      .adminGetCampaignAttribution({ limit: 50 })
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load attribution data'))
      .finally(() => setLoading(false));
  }, []);

  const campaigns = data?.campaigns ?? [];
  const totals = data?.totals;

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Link href="/admin/loyalty-analytics" className="text-sm text-violet-400">← Health</Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Campaign ROI</h1>
          {loading ? <p className="text-hos-text-muted">Loading…</p> : error ? <p className="text-red-400 text-sm">{error}</p> : (
            <>
              {totals && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="border rounded p-3 bg-hos-bg-secondary"><p className="text-hos-text-muted">Orders</p><p className="text-xl font-semibold">{totals.orders}</p></div>
                  <div className="border rounded p-3 bg-hos-bg-secondary"><p className="text-hos-text-muted">Revenue</p><p className="text-xl font-semibold">${Number(totals.revenue).toFixed(2)}</p></div>
                  <div className="border rounded p-3 bg-hos-bg-secondary"><p className="text-hos-text-muted">Points</p><p className="text-xl font-semibold">{totals.points}</p></div>
                  <div className="border rounded p-3 bg-hos-bg-secondary"><p className="text-hos-text-muted">Cost</p><p className="text-xl font-semibold">${Number(totals.cost).toFixed(2)}</p></div>
                  <div className="border rounded p-3 bg-hos-bg-secondary"><p className="text-hos-text-muted">Avg ROI</p><p className="text-xl font-semibold">{totals.avgRoi}x</p></div>
                </div>
              )}
              <table className="admin-table border rounded bg-hos-bg-secondary">
                <thead className="bg-hos-bg-secondary"><tr>
                  <th>Campaign</th>
                  <th>Type</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Points</th>
                  <th>ROI</th>
                </tr></thead>
                <tbody>
                  {campaigns.map((c: any) => (
                    <tr key={c.campaignId} className="border-t">
                      <td>{c.campaignName}</td>
                      <td>{c.campaignType}</td>
                      <td>{c.totalOrders}</td>
                      <td>${Number(c.totalRevenue).toFixed(2)}</td>
                      <td>{c.totalPoints}</td>
                      <td>{c.roi}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
          </RouteGuard>
  );
}
