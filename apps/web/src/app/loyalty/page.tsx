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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [membership, setMembership] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [fandomProfile, setFandomProfile] = useState<Record<string, number> | null>(null);
  const [brandCampaigns, setBrandCampaigns] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        apiClient.getLoyaltyMembership(),
        apiClient.getLoyaltyTierProgress(),
        apiClient.getLoyaltyFandomProfile(),
        apiClient.getActiveBrandCampaigns(),
      ]);

      const [mResult, pResult, fResult, bResult] = results;

      const membershipDisabled =
        mResult.status === 'rejected' &&
        (String(mResult.reason?.message ?? '').toLowerCase().includes('disabled') ||
         String(mResult.reason?.message ?? '').toLowerCase().includes('not enabled'));

      if (membershipDisabled) {
        setLoadError('The loyalty program is currently unavailable. Please try again later.');
        setMembership(null);
      } else if (mResult.status === 'rejected') {
        const msg = mResult.reason?.message || 'Failed to load loyalty data';
        const isNotEnrolled = msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not enrolled');
        if (!isNotEnrolled) {
          setLoadError(msg);
        }
        setMembership(null);
      } else {
        setMembership(mResult.value?.data ?? null);
      }

      setProgress(pResult.status === 'fulfilled' ? (pResult.value?.data ?? null) : null);
      setFandomProfile(fResult.status === 'fulfilled' ? ((fResult.value?.data as Record<string, number>) ?? null) : null);
      const bd = bResult.status === 'fulfilled' ? bResult.value?.data : null;
      setBrandCampaigns(Array.isArray(bd) ? (bd as Record<string, unknown>[]) : []);
    } catch (e: any) {
      setLoadError(e?.message || 'Something went wrong loading loyalty data');
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
            Your House of Spells loyalty program — earn on qualifying purchases, redeem on checkout and at our
            stores.
          </p>

          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : loadError ? (
            <div className="rounded-lg border border-red-900/40 bg-red-950/30 p-6">
              <p className="font-secondary text-red-300 mb-3">{loadError}</p>
              <button
                type="button"
                onClick={load}
                className="rounded-md border border-red-700/50 px-4 py-2 text-sm font-secondary text-red-200 hover:bg-red-950/50"
              >
                Retry
              </button>
            </div>
          ) : !membership ? (
            <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
              <p className="font-secondary mb-4">You are not enrolled yet.</p>
              <button
                type="button"
                onClick={enroll}
                className="rounded-md bg-amber-600 px-4 py-2 text-stone-950 font-medium hover:bg-amber-500"
              >
                Join the program
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
              {brandCampaigns.length > 0 && (
                <div className="rounded-lg border border-amber-900/40 bg-stone-900/50 p-6">
                  <p className="text-sm text-amber-200/80 font-secondary mb-3">Brand promotions</p>
                  <ul className="space-y-3 font-secondary text-sm">
                    {brandCampaigns.map((c) => (
                      <li
                        key={String(c.id)}
                        className="flex flex-col gap-1 border-b border-stone-800/80 pb-3 last:border-0 last:pb-0"
                      >
                        <span className="text-stone-100 font-medium">
                          {String(c.name ?? 'Promotion')}
                        </span>
                        <span className="text-stone-500 text-xs">
                          {String(c.type)} ·{' '}
                          {c.multiplier != null ? `${c.multiplier}× points` : ''}
                          {c.bonusPoints != null ? `+${c.bonusPoints} pts` : ''}
                          {c.multiplier == null && c.bonusPoints == null ? 'Live offer' : ''}
                        </span>
                        {c.partner && typeof c.partner === 'object' && c.partner !== null ? (
                          <span className="text-amber-100/70 text-xs">
                            Partner:{' '}
                            {String((c.partner as Record<string, unknown>).name ?? '')}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
