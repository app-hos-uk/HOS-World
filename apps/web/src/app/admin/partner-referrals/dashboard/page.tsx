'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { asList, asRecord, extractListPayload, num, str } from '../_shared';

export default function AdminPartnerReferralDashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [recentActivity, setRecentActivity] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiClient
      .adminGetPartnerReferralDashboard()
      .then(async (r) => {
        const next = asRecord(r.data) ?? asRecord(r) ?? null;
        if (cancelled) return;
        setData(next);
        const provided = asList(next?.recentActivity ?? next?.recentLinks ?? next?.recentConversions);
        if (provided.length) {
          setRecentActivity(provided);
          return;
        }
        const top = asList(next?.topPartners).slice(0, 5);
        const batches = await Promise.all(
          top.map((partner) =>
            apiClient
              .adminListPartnerReferralLinks(String(partner.id))
              .then((res) => extractListPayload(res).items)
              .catch(() => [] as Record<string, unknown>[]),
          ),
        );
        if (cancelled) return;
        const flattened = batches
          .flat()
          .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')))
          .slice(0, 10);
        setRecentActivity(flattened);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = [
    { label: 'Total Partners', value: num(data?.totalPartners ?? data?.partners) },
    { label: 'Active Links', value: num(data?.activeLinks) },
    { label: 'Total Registrations', value: num(data?.totalRegistrations) },
    { label: 'Total Conversions', value: num(data?.totalConversions) },
  ];

  const topPartners = asList(data?.topPartners);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-6xl mx-auto text-stone-100">
        <Link href="/admin/partner-referrals" className="text-sm text-amber-200 font-secondary hover:text-amber-100 mb-4 inline-block">
          ← Partners
        </Link>
        <h1 className="font-primary text-2xl text-amber-100 mb-6">Partner Referral Dashboard</h1>

        {error ? (
          <p className="text-red-400 text-sm font-secondary">{error}</p>
        ) : loading ? (
          <p className="font-secondary text-stone-400">Loading…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="bg-stone-900 border border-stone-800 rounded-lg p-6">
                  <p className="text-xs uppercase tracking-wide text-stone-400 font-secondary">{kpi.label}</p>
                  <p className="font-primary text-2xl text-amber-100 mt-2">{kpi.value.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-lg p-6">
              <h2 className="font-primary text-lg text-amber-100 mb-4">Top 10 Partners by registrations</h2>
              {topPartners.length === 0 ? (
                <p className="font-secondary text-stone-500 text-sm">No partner activity yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm font-secondary divide-y divide-stone-800">
                    <thead>
                      <tr className="text-stone-400 text-xs uppercase">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Type</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Registrations</th>
                        <th className="text-left p-2">Conversions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {topPartners.map((row) => (
                        <tr key={String(row.id)}>
                          <td className="p-2">
                            <Link href={`/admin/partner-referrals/${String(row.id)}`} className="text-amber-200 hover:text-amber-100">
                              {str(row.name)}
                            </Link>
                          </td>
                          <td className="p-2">{str(row.type)}</td>
                          <td className="p-2">{str(row.status)}</td>
                          <td className="p-2">{num(row.registrations ?? row.totalRegistrations)}</td>
                          <td className="p-2">{num(row.conversions ?? row.totalConversions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-lg p-6">
              <h2 className="font-primary text-lg text-amber-100 mb-4">Recent link activity</h2>
              {recentActivity.length === 0 ? (
                <p className="font-secondary text-stone-500 text-sm">No recent link activity.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm font-secondary divide-y divide-stone-800">
                    <thead>
                      <tr className="text-stone-400 text-xs uppercase">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Code</th>
                        <th className="text-left p-2">Clicks</th>
                        <th className="text-left p-2">Registrations</th>
                        <th className="text-left p-2">Conversions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {recentActivity.map((row, i) => (
                        <tr key={String(row.id ?? i)}>
                          <td className="p-2">
                            {row.id ? (
                              <Link href={`/admin/partner-referrals/links/${String(row.id)}`} className="text-amber-200 hover:text-amber-100">
                                {str(row.name ?? row.linkName)}
                              </Link>
                            ) : (
                              str(row.name ?? row.linkName)
                            )}
                          </td>
                          <td className="p-2 font-mono text-xs">{str(row.code)}</td>
                          <td className="p-2">{num(row.clicks ?? row.totalClicks)}</td>
                          <td className="p-2">{num(row.registrations ?? row.totalRegistrations)}</td>
                          <td className="p-2">{num(row.conversions ?? row.totalConversions)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
