'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

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
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const toast = useToast();

  useEffect(() => {
    apiClient
      .getLoyaltyReferralInfo()
      .then((r) => setInfo((r.data as ReferralInfo) || null))
      .catch((e: any) => setError(e?.message || 'Failed to load referral info'))
      .finally(() => setLoading(false));
  }, []);

  const referralCode = info?.code || info?.referralCode || '';
  // The API always returns shareUrl, but a stale cached response should still
  // leave the customer with a working link.
  const shareUrl =
    info?.shareUrl ||
    (referralCode && typeof window !== 'undefined'
      ? `${window.location.origin}/ref/${encodeURIComponent(referralCode)}`
      : '');
  const shareMessage = `Join me on House of Spells with my referral code ${referralCode} — we both earn loyalty points. ${shareUrl}`;

  const copy = useCallback(
    async (value: string, kind: 'code' | 'link') => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(kind);
        setTimeout(() => setCopied(null), 2000);
      } catch {
        toast.error('Could not copy — please copy it manually');
      }
    },
    [toast],
  );

  const nativeShare = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.share) {
      await copy(shareUrl, 'link');
      return;
    }
    try {
      await navigator.share({ title: 'House of Spells referral', text: shareMessage, url: shareUrl });
    } catch {
      // Dismissing the OS share sheet is a normal outcome, not an error.
    }
  }, [copy, shareMessage, shareUrl]);

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
          ) : !referralCode ? (
            <p className="font-secondary text-stone-500">No referral code yet. Enroll in The Enchanted Circle first.</p>
          ) : (
            <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6 font-secondary space-y-4">
              <div>
                <p className="text-stone-500 text-sm mb-1">Your code</p>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-primary text-xl text-amber-200 tracking-wide">{referralCode}</p>
                  <button
                    type="button"
                    onClick={() => copy(referralCode, 'code')}
                    className="px-3 py-1.5 text-xs rounded-lg border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 transition-colors"
                  >
                    {copied === 'code' ? '✓ Copied' : 'Copy code'}
                  </button>
                </div>
              </div>

              {shareUrl && (
                <div>
                  <p className="text-stone-500 text-sm mb-1">Share link</p>
                  <p className="text-amber-100/90 text-sm break-all mb-2">{shareUrl}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copy(shareUrl, 'link')}
                      className="px-3 py-1.5 text-xs rounded-lg border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 transition-colors"
                    >
                      {copied === 'link' ? '✓ Copied' : 'Copy link'}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 text-xs rounded-lg border border-stone-700 text-stone-200 hover:bg-stone-800 transition-colors"
                    >
                      WhatsApp
                    </a>
                    <a
                      href={`mailto:?subject=${encodeURIComponent('Join me on House of Spells')}&body=${encodeURIComponent(shareMessage)}`}
                      className="px-3 py-1.5 text-xs rounded-lg border border-stone-700 text-stone-200 hover:bg-stone-800 transition-colors"
                    >
                      Email
                    </a>
                    <button
                      type="button"
                      onClick={nativeShare}
                      className="px-3 py-1.5 text-xs rounded-lg border border-stone-700 text-stone-200 hover:bg-stone-800 transition-colors"
                    >
                      Share…
                    </button>
                  </div>
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
                    {info!.recentReferrals.map((r) => (
                      <li key={`${r.name}-${r.date}`} className="flex justify-between gap-2">
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
