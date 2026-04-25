'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

type Tab = 'dashboard' | 'ugc' | 'leaderboard' | 'achievements';

export default function AmbassadorHubPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [eligibility, setEligibility] = useState<Record<string, unknown> | null>(null);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [ugcList, setUgcList] = useState<Record<string, unknown>[]>([]);
  const [leaderboard, setLeaderboard] = useState<Record<string, unknown>[]>([]);
  const [achievements, setAchievements] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabDataError, setTabDataError] = useState<string | null>(null);
  const [enrollName, setEnrollName] = useState('');
  const [enrollBio, setEnrollBio] = useState('');
  const [ugcType, setUgcType] = useState('PHOTO');
  const [ugcTitle, setUgcTitle] = useState('');
  const [lbPeriod, setLbPeriod] = useState('week');

  const enrolled = Boolean(eligibility && (eligibility as { enrolled?: boolean }).enrolled);

  useEffect(() => {
    apiClient
      .getAmbassadorEligibility()
      .then((r) => setEligibility((r.data as Record<string, unknown>) || null))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!enrolled) return;
    setTabDataError(null);
    if (tab === 'dashboard') {
      apiClient
        .getAmbassadorDashboard()
        .then((r) => setDashboard((r.data as Record<string, unknown>) || null))
        .catch((e: unknown) =>
          setTabDataError(e instanceof Error ? e.message : 'Failed to load dashboard'),
        );
    }
    if (tab === 'ugc') {
      apiClient
        .listAmbassadorUgc()
        .then((r) => {
          const d = r.data as { items?: Record<string, unknown>[] };
          setUgcList(d?.items ?? []);
        })
        .catch((e: unknown) =>
          setTabDataError(e instanceof Error ? e.message : 'Failed to load UGC'),
        );
    }
    if (tab === 'leaderboard') {
      apiClient
        .getAmbassadorLeaderboard({ period: lbPeriod })
        .then((r) => setLeaderboard((r.data as Record<string, unknown>[]) || []))
        .catch((e: unknown) =>
          setTabDataError(e instanceof Error ? e.message : 'Failed to load leaderboard'),
        );
    }
    if (tab === 'achievements') {
      apiClient
        .getAmbassadorAchievements()
        .then((r) => setAchievements((r.data as Record<string, unknown>[]) || []))
        .catch((e: unknown) =>
          setTabDataError(e instanceof Error ? e.message : 'Failed to load achievements'),
        );
    }
  }, [enrolled, tab, lbPeriod]);

  async function enroll(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiClient.enrollAmbassador({ displayName: enrollName, bio: enrollBio || undefined });
      const el = await apiClient.getAmbassadorEligibility();
      setEligibility((el.data as Record<string, unknown>) || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Enroll failed');
    }
  }

  async function submitUgc(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiClient.submitAmbassadorUgc({ type: ugcType, title: ugcTitle || undefined });
      const r = await apiClient.listAmbassadorUgc();
      const d = r.data as { items?: Record<string, unknown>[] };
      setUgcList(d?.items ?? []);
      setUgcTitle('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    }
  }

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
          <Link href="/loyalty" className="text-amber-500 text-sm font-secondary mb-4 inline-block">
            ← Back
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-2">Ambassador programme</h1>
          <p className="font-secondary text-stone-500 text-sm mb-8">
            Unlock at Dragon Keeper tier — share, create, earn.
          </p>

          {loading ? (
            <p className="font-secondary text-stone-500">Loading…</p>
          ) : !enrolled ? (
            <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6 font-secondary space-y-4">
              {error && <p className="text-red-400 text-sm">{error}</p>}
              {eligibility && !(eligibility as { eligible?: boolean }).eligible ? (
                <p className="text-stone-400">
                  You need tier level {(eligibility as { requiredTierLevel?: number }).requiredTierLevel}{' '}
                  or higher. Current:{' '}
                  {(eligibility as { currentTier?: { name?: string } }).currentTier?.name ?? '—'}
                </p>
              ) : (
                <form onSubmit={enroll} className="space-y-3 max-w-md">
                  <div>
                    <label className="text-stone-500 text-sm block mb-1">Display name</label>
                    <input
                      className="w-full rounded bg-stone-900 border border-stone-700 px-3 py-2"
                      value={enrollName}
                      onChange={(e) => setEnrollName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-stone-500 text-sm block mb-1">Bio (optional)</label>
                    <textarea
                      className="w-full rounded bg-stone-900 border border-stone-700 px-3 py-2"
                      rows={3}
                      value={enrollBio}
                      onChange={(e) => setEnrollBio(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded bg-amber-600 hover:bg-amber-500 text-stone-950 px-4 py-2 text-sm font-medium"
                  >
                    Join as ambassador
                  </button>
                </form>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-6 border-b border-stone-800 pb-2">
                {(['dashboard', 'ugc', 'leaderboard', 'achievements'] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded text-sm font-secondary capitalize ${
                      tab === t
                        ? 'bg-amber-600/20 text-amber-200 border border-amber-700/50'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <Link
                  href="/loyalty/ambassador/profile"
                  className="ml-auto text-sm text-amber-500 hover:text-amber-400 font-secondary"
                >
                  Edit profile →
                </Link>
              </div>

              {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
              {tabDataError && <p className="text-red-400 text-sm mb-4">{tabDataError}</p>}

              {tab === 'dashboard' && dashboard && (
                <div className="space-y-6 font-secondary text-sm">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="rounded border border-stone-800 bg-stone-900/40 p-3">
                      <p className="text-stone-500 text-xs">Ambassador tier</p>
                      <p className="text-amber-200 text-lg">
                        {String((dashboard.ambassador as Record<string, unknown>)?.tier ?? '—')}
                      </p>
                    </div>
                    <div className="rounded border border-stone-800 bg-stone-900/40 p-3">
                      <p className="text-stone-500 text-xs">Referral signups</p>
                      <p className="text-amber-200 text-lg">
                        {String(
                          (dashboard.ambassador as Record<string, unknown>)?.totalReferralSignups ?? 0,
                        )}
                      </p>
                    </div>
                    <div className="rounded border border-stone-800 bg-stone-900/40 p-3">
                      <p className="text-stone-500 text-xs">Ambassador points</p>
                      <p className="text-amber-200 text-lg">
                        {String(
                          (dashboard.ambassador as Record<string, unknown>)?.totalPointsEarnedAsAmb ?? 0,
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="rounded border border-stone-800 bg-stone-900/40 p-4">
                    <p className="text-stone-500 text-xs mb-2">Loyalty referrals</p>
                    <pre className="text-xs text-stone-300 overflow-auto whitespace-pre-wrap">
                      {JSON.stringify(dashboard.loyaltyReferrals, null, 2)}
                    </pre>
                  </div>
                  <div className="rounded border border-stone-800 bg-stone-900/40 p-4">
                    <p className="text-stone-500 text-xs mb-2">Recent activity</p>
                    <ul className="space-y-2 text-stone-300">
                      {((dashboard.recentActivity as Record<string, unknown>[]) || []).slice(0, 8).map(
                        (a) => (
                          <li key={`${String(a.type)}-${String(a.date)}`}>
                            {String(a.description)} —{' '}
                            <span className="text-amber-200/90">{String(a.pointsEarned)}</span> pts
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {tab === 'ugc' && (
                <div className="space-y-6">
                  <form onSubmit={submitUgc} className="rounded border border-stone-800 bg-stone-900/40 p-4 space-y-3 font-secondary text-sm">
                    <p className="text-amber-100/90 font-primary">Submit content</p>
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="bg-stone-900 border border-stone-700 rounded px-2 py-1"
                        value={ugcType}
                        onChange={(e) => setUgcType(e.target.value)}
                      >
                        {['PHOTO', 'VIDEO', 'REVIEW', 'STORY', 'UNBOXING', 'SOCIAL_POST'].map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                      <input
                        className="flex-1 min-w-[12rem] bg-stone-900 border border-stone-700 rounded px-2 py-1"
                        placeholder="Title"
                        value={ugcTitle}
                        onChange={(e) => setUgcTitle(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded bg-amber-600 hover:bg-amber-500 text-stone-950 px-3 py-1.5 text-sm"
                    >
                      Submit
                    </button>
                  </form>
                  <ul className="space-y-2 font-secondary text-sm">
                    {ugcList.map((u) => (
                      <li
                        key={String(u.id)}
                        className="rounded border border-stone-800 bg-stone-900/30 px-3 py-2 flex justify-between"
                      >
                        <span>{String(u.type)} — {String(u.title || 'Untitled')}</span>
                        <span className="text-stone-500">{String(u.status)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === 'leaderboard' && (
                <div className="font-secondary text-sm">
                  <div className="flex gap-2 mb-4">
                    {['week', 'month', 'all'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setLbPeriod(p)}
                        className={`px-2 py-1 rounded capitalize ${
                          lbPeriod === p ? 'bg-amber-600/30 text-amber-100' : 'text-stone-500'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <ol className="space-y-2">
                    {leaderboard.map((row) => (
                      <li
                        key={String((row as { userId?: string }).userId)}
                        className="flex justify-between border-b border-stone-800/80 py-2"
                      >
                        <span>
                          {String((row as { rank?: number }).rank)}.{' '}
                          {String((row as { displayName?: string }).displayName)}
                        </span>
                        <span className="text-amber-200">{String((row as { points?: number }).points)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {tab === 'achievements' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-secondary text-sm">
                  {achievements.map((a) => (
                    <div
                      key={String(a.id)}
                      className="rounded border border-stone-800 bg-stone-900/40 p-3"
                    >
                      <p className="text-amber-100">{String(a.name)}</p>
                      <p className="text-stone-500 text-xs mt-1">{String(a.description || '')}</p>
                      <p className="text-amber-200/80 text-xs mt-2">+{String(a.pointsAwarded)} pts</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
