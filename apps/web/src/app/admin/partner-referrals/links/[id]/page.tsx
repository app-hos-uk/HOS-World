'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDateTime } from '@/hooks/useDateTime';
import {
  PRIMARY_BTN,
  SECONDARY_BTN,
  QrPreview,
  StatusBadge,
  asList,
  asRecord,
  copyText,
  num,
  str,
  unwrapUrl,
} from '../../_shared';

export default function AdminPartnerReferralLinkDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const { formatDate, formatDateTime } = useDateTime();
  const [link, setLink] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [fullUrl, setFullUrl] = useState('');
  const [conversions, setConversions] = useState<Record<string, unknown>[]>([]);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetPartnerReferralLink(id)
      .then((r) => {
        const data = asRecord(r.data) ?? null;
        setLink(data);
        const embedded = data ? asList(data.conversions) : [];
        if (embedded.length) setConversions(embedded);
        const nestedUrl = unwrapUrl(data);
        if (nestedUrl) setFullUrl(nestedUrl);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'));
    apiClient
      .adminGetPartnerReferralLinkReport(id)
      .then((r) => {
        const data = asRecord(r.data) ?? null;
        setReport(data);
        const recent = asList(data?.recentConversions ?? data?.conversions);
        if (recent.length) setConversions(recent);
      })
      .catch(() => {
        /* report is optional */
      });
    apiClient
      .adminGetPartnerReferralLinkUrl(id)
      .then((r) => {
        const url = unwrapUrl(r.data) || unwrapUrl(r);
        if (url) setFullUrl(url);
      })
      .catch(() => {
        /* URL can be derived from the link payload */
      });
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const displayUrl = useMemo(() => {
    if (fullUrl) return fullUrl;
    const code = link?.code != null ? String(link.code) : '';
    if (!code || !origin) return '';
    return `${origin}/ref/${encodeURIComponent(code)}`;
  }, [fullUrl, link, origin]);

  const totals = asRecord(report?.totals) ?? {};
  const rates = asRecord(report?.rates) ?? {};
  const clicks = num(totals.clicks ?? link?.totalClicks);
  const registrations = num(totals.registrations ?? link?.totalRegistrations);
  const conversionsCount = num(totals.conversions ?? link?.totalConversions);
  const conversionRate = num(
    rates.registrationToConversion ?? report?.conversionRate ?? (registrations > 0 ? (conversionsCount / registrations) * 100 : 0),
  );

  const partner = asRecord(link?.partner) ?? asRecord(report?.partner);
  const partnerId = partner?.id != null ? String(partner.id) : link?.partnerId != null ? String(link.partnerId) : '';

  const toggleActive = async () => {
    if (!link) return;
    setToggling(true);
    try {
      await apiClient.adminUpdatePartnerReferralLink(id, { isActive: !link.isActive });
      toast.success(link.isActive ? 'Link paused' : 'Link activated');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update link');
    } finally {
      setToggling(false);
    }
  };

  const copyUrl = async () => {
    if (!displayUrl) return;
    const ok = await copyText(displayUrl);
    if (ok) toast.success('URL copied');
    else toast.error('Could not copy URL');
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-5xl mx-auto text-stone-100 space-y-6">
        <Link
          href={partnerId ? `/admin/partner-referrals/${partnerId}` : '/admin/partner-referrals'}
          className="text-sm text-amber-200 font-secondary hover:text-amber-100"
        >
          ← Partner
        </Link>

        {link ? (
          <>
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <h1 className="font-primary text-2xl text-amber-100">{str(link.name)}</h1>
                <p className="font-secondary text-sm text-stone-400 mt-1 font-mono">{str(link.code)}</p>
              </div>
              <button type="button" disabled={toggling} onClick={() => void toggleActive()} className={SECONDARY_BTN}>
                {link.isActive === false ? 'Activate' : 'Pause'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-6 space-y-3">
                <h2 className="font-primary text-lg text-amber-100">Link URL</h2>
                <p className="font-secondary text-sm text-stone-300 break-all">{displayUrl || '—'}</p>
                <button type="button" onClick={() => void copyUrl()} className={PRIMARY_BTN} disabled={!displayUrl}>
                  Copy URL
                </button>
                <div className="font-secondary text-sm text-stone-400 space-y-1 pt-2">
                  <p>Target: {str(link.targetUrl)}</p>
                  <p>UTM source: {str(link.utmSource)}</p>
                  <p>UTM medium: {str(link.utmMedium)}</p>
                  {link.expiresAt ? <p>Expires: {formatDate(String(link.expiresAt))}</p> : null}
                  <p>
                    Status:{' '}
                    {link.isActive === false ? (
                      <StatusBadge status="PAUSED" />
                    ) : (
                      <StatusBadge status="ACTIVE" />
                    )}
                  </p>
                </div>
              </div>
              <div className="bg-stone-900 border border-stone-800 rounded-lg p-6">
                <h2 className="font-primary text-lg text-amber-100 mb-3">QR Code</h2>
                <QrPreview value={displayUrl} size={240} downloadName={`${str(link.code, 'partner-link')}-qr.svg`} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Clicks', value: clicks },
                { label: 'Registrations', value: registrations },
                { label: 'Conversions', value: conversionsCount },
                { label: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%` },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-stone-900 border border-stone-800 rounded-lg p-6">
                  <p className="text-xs uppercase tracking-wide text-stone-400 font-secondary">{kpi.label}</p>
                  <p className="font-primary text-2xl text-amber-100 mt-2">{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-lg p-6 font-secondary text-sm space-y-2">
              <h2 className="font-primary text-lg text-amber-100 mb-2">Incentive config</h2>
              <p>Signup bonus points: {num(link.signupBonusPoints)}</p>
              <p>
                Points multiplier:{' '}
                {link.pointsMultiplier != null ? `${num(link.pointsMultiplier)}x` : '—'}
                {link.multiplierDays != null ? ` for ${num(link.multiplierDays)} days` : ''}
              </p>
              <p>Coupon: {str(link.couponCode)}</p>
              <p>
                Discount:{' '}
                {num(link.discountPercent) > 0
                  ? `${num(link.discountPercent)}%`
                  : num(link.discountFixedAmount) > 0
                    ? num(link.discountFixedAmount)
                    : '—'}
              </p>
              <p>Max redemptions: {link.maxRedemptions != null ? num(link.maxRedemptions) : 'Unlimited'}</p>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-lg p-6">
              <h2 className="font-primary text-lg text-amber-100 mb-4">Recent conversions</h2>
              {conversions.length === 0 ? (
                <p className="font-secondary text-stone-500 text-sm">No conversions yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm font-secondary divide-y divide-stone-800">
                    <thead>
                      <tr className="text-stone-400 text-xs uppercase">
                        <th className="text-left p-2">User</th>
                        <th className="text-left p-2">Bonus</th>
                        <th className="text-left p-2">Coupon</th>
                        <th className="text-left p-2">First order</th>
                        <th className="text-left p-2">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800">
                      {conversions.map((row) => {
                        const user = asRecord(row.user);
                        return (
                          <tr key={String(row.id)}>
                            <td className="p-2">{str(user?.email ?? row.userId)}</td>
                            <td className="p-2">{num(row.signupBonusAwarded)}</td>
                            <td className="p-2">{str(row.couponApplied)}</td>
                            <td className="p-2">
                              {row.firstOrderTotal != null ? num(row.firstOrderTotal) : '—'}
                            </td>
                            <td className="p-2">
                              {row.createdAt ? formatDateTime(String(row.createdAt)) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="font-secondary text-stone-400">Loading…</p>
        )}
      </div>
    </RouteGuard>
  );
}
