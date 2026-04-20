'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

type ReferralInfo = {
  referralCode?: string;
  code?: string;
  shareUrl?: string;
  conversions?: number;
  convertedReferrals?: number;
  pendingReferrals?: number;
  totalReferrals?: number;
  totalPointsEarned?: number;
  recentReferrals?: { name: string; status: string; date: string; pointsEarned: number }[];
};

export default function LoyaltyReferralPage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getLoyaltyReferralInfo()
      .then((r) => setInfo((r.data as ReferralInfo) || null))
      .catch((e: any) => setError(e?.message || 'Failed to load referral info'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
          <Link href="/loyalty" className="text-amber-500 text-sm font-secondary mb-4 inline-block">
            ← Back
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-6">Referrals</h1>
          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : error ? (
            <p className="font-secondary text-red-400">{error}</p>
          ) : !info?.code && !info?.referralCode ? (
            <p className="font-secondary text-stone-500">No referral code yet. Enroll in The Enchanted Circle first.</p>
          ) : (
            <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6 font-secondary space-y-3">
              <div>
                <p className="text-stone-500 text-sm mb-1">Your code</p>
                <p className="font-primary text-xl text-amber-200">{info!.code || info!.referralCode}</p>
              </div>
              {info!.shareUrl && (
                <div>
                  <p className="text-stone-500 text-sm mb-1">Share link</p>
                  <p className="text-amber-100/90 text-sm break-all">{info!.shareUrl}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-stone-800">
                <p>
                  Converted:{' '}
                  <span className="text-amber-200">{info!.convertedReferrals ?? info!.conversions ?? 0}</span>
                </p>
                <p>
                  Pending: <span className="text-amber-200">{info!.pendingReferrals ?? 0}</span>
                </p>
                <p>
                  Total invites: <span className="text-amber-200">{info!.totalReferrals ?? 0}</span>
                </p>
                <p>
                  Points from referrals: <span className="text-amber-200">{info!.totalPointsEarned ?? 0}</span>
                </p>
              </div>
              {info!.recentReferrals && info!.recentReferrals.length > 0 && (
                <div className="pt-2 border-t border-stone-800">
                  <p className="text-stone-500 text-sm mb-2">Recent</p>
                  <ul className="text-sm space-y-1">
                    {info!.recentReferrals.map((r, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{r.name}</span>
                        <span className="text-stone-500">
                          {r.status}
                          {r.pointsEarned > 0 && <span className="text-amber-200 ml-2">+{r.pointsEarned}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
