'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { FandomRadar } from '@/components/loyalty/FandomRadar';
import { clearPendingReferral, getPendingReferralCode } from '@/lib/referralAttribution';

export default function LoyaltyDashboardPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [fandomProfile, setFandomProfile] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p, f] = await Promise.all([
        apiClient.getLoyaltyMembership().catch(() => null),
        apiClient.getLoyaltyTierProgress().catch(() => null),
        apiClient.getLoyaltyFandomProfile().catch(() => null),
      ]);
      setMembership(m?.data ?? null);
      setProgress(p?.data ?? null);
      setFandomProfile((f?.data as Record<string, number>) ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enroll = async () => {
    try {
      const referralCode = getPendingReferralCode();
      await apiClient.enrollLoyalty(referralCode ? { referralCode } : undefined);
      clearPendingReferral();
      toast.success('Welcome to The Enchanted Circle!');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not enroll');
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
          <h1 className="font-primary text-3xl text-amber-100 mb-2">The Enchanted Circle</h1>
          <p className="font-secondary text-stone-400 mb-8">
            Your House of Spells loyalty programme — earn on qualifying purchases, redeem on checkout and at our
            stores.
          </p>

          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : !membership ? (
            <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
              <p className="font-secondary mb-4">You are not enrolled yet.</p>
              <button
                type="button"
                onClick={enroll}
                className="rounded-md bg-amber-600 px-4 py-2 text-stone-950 font-medium hover:bg-amber-500"
              >
                Join the programme
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
                <div className="flex flex-wrap gap-4 justify-between items-start">
                  <div>
                    <p className="text-sm text-stone-500 font-secondary">Tier</p>
                    <p className="font-primary text-xl text-amber-200">{membership.tier?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 font-secondary">Points balance</p>
                    <p className="font-primary text-xl">{membership.currentBalance}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-500 font-secondary">Lifetime earned</p>
                    <p className="font-primary text-xl">{membership.totalPointsEarned}</p>
                  </div>
                </div>
                {progress?.nextTier && (
                  <div className="mt-6">
                    <div className="flex justify-between text-sm font-secondary text-stone-400 mb-1">
                      <span>Progress to {progress.nextTier.name}</span>
                      <span>{progress.progressPercent ?? 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-stone-800 overflow-hidden">
                      <div
                        className="h-full bg-amber-600 transition-all"
                        style={{ width: `${progress.progressPercent ?? 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-stone-500 mt-1 font-secondary">
                      {progress.pointsToNext ?? 0} points to go
                    </p>
                  </div>
                )}
              </div>
              {fandomProfile && Object.keys(fandomProfile).length > 0 && (
                <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
                  <p className="text-sm text-stone-500 font-secondary mb-3">Your fandom affinity</p>
                  <FandomRadar profile={fandomProfile} className="mb-4" />
                  <ul className="space-y-2 font-secondary text-sm">
                    {Object.entries(fandomProfile)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([name, score]) => (
                        <li key={name} className="flex justify-between gap-4">
                          <span className="text-stone-300">{name}</span>
                          <span className="text-amber-200/90">{Math.round(score * 100)}%</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/events"
                  className="rounded-md border border-amber-700/50 px-4 py-2 font-secondary hover:bg-stone-800 text-amber-100/90"
                >
                  Events
                </Link>
                <Link
                  href="/events/my-events"
                  className="rounded-md border border-stone-600 px-4 py-2 font-secondary hover:bg-stone-800"
                >
                  My events
                </Link>
                <Link
                  href="/quiz"
                  className="rounded-md border border-stone-600 px-4 py-2 font-secondary hover:bg-stone-800"
                >
                  Quizzes
                </Link>
                <Link
                  href="/loyalty/rewards"
                  className="rounded-md border border-stone-600 px-4 py-2 font-secondary hover:bg-stone-800"
                >
                  Rewards
                </Link>
                <Link
                  href="/loyalty/referral"
                  className="rounded-md border border-stone-600 px-4 py-2 font-secondary hover:bg-stone-800"
                >
                  Referrals
                </Link>
                <Link
                  href="/loyalty/ambassador"
                  className="rounded-md border border-amber-700/40 px-4 py-2 font-secondary hover:bg-stone-800 text-amber-100/90"
                >
                  Ambassadors
                </Link>
                <Link
                  href="/loyalty/card"
                  className="rounded-md border border-stone-600 px-4 py-2 font-secondary hover:bg-stone-800"
                >
                  Digital card
                </Link>
                <Link
                  href="/loyalty/preferences"
                  className="rounded-md border border-stone-600 px-4 py-2 font-secondary hover:bg-stone-800"
                >
                  Message preferences
                </Link>
                <Link
                  href="/loyalty/messages"
                  className="rounded-md border border-stone-600 px-4 py-2 font-secondary hover:bg-stone-800"
                >
                  Message history
                </Link>
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
