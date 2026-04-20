'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function AttributionPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .adminGetCampaignAttribution({ limit: 50 })
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const campaigns = data?.campaigns ?? [];
  const totals = data?.totals;

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <Link href="/admin/loyalty-analytics" className="text-sm text-violet-700">← Health</Link>
          <h1 className="text-2xl font-semibold text-gray-900">Campaign ROI</h1>
          {loading ? <p className="text-gray-500">Loading…</p> : (
            <>
              {totals && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="border rounded p-3 bg-white"><p className="text-gray-500">Orders</p><p className="text-xl font-semibold">{totals.orders}</p></div>
                  <div className="border rounded p-3 bg-white"><p className="text-gray-500">Revenue</p><p className="text-xl font-semibold">£{Number(totals.revenue).toFixed(2)}</p></div>
                  <div className="border rounded p-3 bg-white"><p className="text-gray-500">Points</p><p className="text-xl font-semibold">{totals.points}</p></div>
                  <div className="border rounded p-3 bg-white"><p className="text-gray-500">Cost</p><p className="text-xl font-semibold">£{Number(totals.cost).toFixed(2)}</p></div>
                  <div className="border rounded p-3 bg-white"><p className="text-gray-500">Avg ROI</p><p className="text-xl font-semibold">{totals.avgRoi}x</p></div>
                </div>
              )}
              <table className="min-w-full text-sm border rounded bg-white">
                <thead className="bg-gray-50"><tr>
                  <th className="text-left px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Orders</th>
                  <th className="px-3 py-2">Revenue</th>
                  <th className="px-3 py-2">Points</th>
                  <th className="px-3 py-2">ROI</th>
                </tr></thead>
                <tbody>
                  {campaigns.map((c: any) => (
                    <tr key={c.campaignId} className="border-t">
                      <td className="px-3 py-2">{c.campaignName}</td>
                      <td className="px-3 py-2">{c.campaignType}</td>
                      <td className="px-3 py-2">{c.totalOrders}</td>
                      <td className="px-3 py-2">£{Number(c.totalRevenue).toFixed(2)}</td>
                      <td className="px-3 py-2">{c.totalPoints}</td>
                      <td className="px-3 py-2">{c.roi}x</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
