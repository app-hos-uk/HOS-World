'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

export default function AmbassadorProfileEditPage() {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [commissionAsPoints, setCommissionAsPoints] = useState(true);
  const [tier, setTier] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getAmbassadorProfile()
      .then((r) => {
        const p = r.data as Record<string, unknown>;
        setDisplayName(String(p.displayName ?? ''));
        setBio(String(p.bio ?? ''));
        setProfileImage(String(p.profileImage ?? ''));
        setCommissionAsPoints(Boolean(p.commissionAsPoints ?? true));
        setTier(String(p.tier ?? ''));
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiClient.updateAmbassadorProfile({
        displayName: displayName || undefined,
        bio: bio || undefined,
        profileImage: profileImage || undefined,
        commissionAsPoints,
      });
      setMsg('Saved');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-lg">
          <Link href="/loyalty/ambassador" className="text-amber-500 text-sm font-secondary mb-4 inline-block">
            ← Hub
          </Link>
          <h1 className="font-primary text-xl text-amber-100 mb-2">Ambassador profile</h1>
          <p className="text-stone-500 text-sm font-secondary mb-6">Tier: {tier || '—'}</p>
          {err && <p className="text-red-400 text-sm mb-2">{err}</p>}
          {msg && <p className="text-emerald-400 text-sm mb-2">{msg}</p>}
          <form onSubmit={save} className="space-y-4 font-secondary text-sm">
            <div>
              <label className="text-stone-500 block mb-1">Display name</label>
              <input
                className="w-full rounded bg-stone-900 border border-stone-700 px-3 py-2"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-stone-500 block mb-1">Bio</label>
              <textarea
                className="w-full rounded bg-stone-900 border border-stone-700 px-3 py-2"
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div>
              <label className="text-stone-500 block mb-1">Profile image URL</label>
              <input
                className="w-full rounded bg-stone-900 border border-stone-700 px-3 py-2"
                value={profileImage}
                onChange={(e) => setProfileImage(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-stone-300">
              <input
                type="checkbox"
                checked={commissionAsPoints}
                onChange={(e) => setCommissionAsPoints(e.target.checked)}
              />
              Convert influencer commissions to points (when available)
            </label>
            <button
              type="submit"
              className="rounded bg-amber-600 hover:bg-amber-500 text-stone-950 px-4 py-2"
            >
              Save
            </button>
          </form>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
