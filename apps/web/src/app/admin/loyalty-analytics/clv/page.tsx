'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

export default function ClvReportPage() {
  const [dist, setDist] = useState<any[]>([]);
  const [top, setTop] = useState<any[]>([]);
  const [churn, setChurn] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const errs: string[] = [];
    Promise.all([
      apiClient.adminGetClvDistribution().catch((e: unknown) => {
        errs.push(e instanceof Error ? e.message : 'Failed to load CLV distribution');
        return null;
      }),
      apiClient.adminGetClvTop(30).catch((e: unknown) => {
        errs.push(e instanceof Error ? e.message : 'Failed to load top members');
        return null;
      }),
      apiClient.adminGetChurnReport().catch((e: unknown) => {
        errs.push(e instanceof Error ? e.message : 'Failed to load churn report');
        return null;
      }),
    ]).then(([d, t, c]) => {
      setDist(Array.isArray(d?.data) ? d.data : []);
      setTop(Array.isArray(t?.data) ? t.data : []);
      setChurn(c?.data ?? null);
      if (errs.length) setErrors(errs);
      setLoading(false);
    });
  }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <Link href="/admin/loyalty-analytics" className="text-sm text-violet-700">← Health</Link>
          <h1 className="text-2xl font-semibold text-gray-900">CLV report</h1>
          {loading ? <p className="text-gray-500">Loading…</p> : (
            <>
              {errors.length > 0 && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
                  {errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
              <div>
                <h2 className="text-lg font-medium mb-2">Distribution</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {dist.map((b: any) => (
                    <div key={b.bucket} className="border rounded-lg p-3 bg-white">
                      <p className="text-gray-500">{b.bucket}</p>
                      <p className="text-xl font-semibold">{b.count}</p>
                      <p className="text-xs text-gray-400">avg £{Number(b.avgClv).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-lg font-medium mb-2">Top members</h2>
                <table className="min-w-full text-sm border rounded bg-white">
                  <thead className="bg-gray-50"><tr>
                    <th className="text-left px-3 py-2">Name</th>
                    <th className="px-3 py-2">CLV</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Spend</th>
                    <th className="px-3 py-2">Orders</th>
                  </tr></thead>
                  <tbody>
                    {top.map((m: any) => (
                      <tr key={m.membershipId} className="border-t">
                        <td className="px-3 py-2">{m.name}</td>
                        <td className="px-3 py-2">£{Number(m.clvScore).toFixed(2)}</td>
                        <td className="px-3 py-2">{m.tier}</td>
                        <td className="px-3 py-2">£{Number(m.totalSpend).toFixed(2)}</td>
                        <td className="px-3 py-2">{m.purchaseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {churn && (
                <div>
                  <h2 className="text-lg font-medium mb-2">Churn risk</h2>
                  <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                    <div className="border rounded p-3 bg-white"><p className="text-gray-500">Healthy</p><p className="text-xl font-semibold text-emerald-600">{churn.healthy}</p></div>
                    <div className="border rounded p-3 bg-white"><p className="text-gray-500">At risk</p><p className="text-xl font-semibold text-amber-600">{churn.atRisk}</p></div>
                    <div className="border rounded p-3 bg-white"><p className="text-gray-500">Churned</p><p className="text-xl font-semibold text-red-600">{churn.churned}</p></div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
