'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function LoyaltyPreferencesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [optInEmail, setOptInEmail] = useState(true);
  const [optInSms, setOptInSms] = useState(false);
  const [optInWhatsApp, setOptInWhatsApp] = useState(false);
  const [optInPush, setOptInPush] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.getLoyaltyPreferences();
      const d = r.data as any;
      if (d) {
        setOptInEmail(!!d.optInEmail);
        setOptInSms(!!d.optInSms);
        setOptInWhatsApp(!!d.optInWhatsApp);
        setOptInPush(!!d.optInPush);
      }
    } catch {
      toast.error('Could not load preferences');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.updateLoyaltyPreferences({
        optInEmail,
        optInSms,
        optInWhatsApp,
        optInPush,
      });
      toast.success('Preferences saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-lg">
          <Link href="/loyalty" className="text-amber-200/80 text-sm hover:underline mb-6 inline-block">
            ← Back to loyalty
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-2">Message preferences</h1>
          <p className="font-secondary text-stone-400 text-sm mb-8">
            Choose how we may reach you about offers and programme updates.
          </p>
          {loading ? (
            <p className="text-stone-500">Loading…</p>
          ) : (
            <div className="space-y-4 rounded-lg border border-stone-800 bg-stone-900/50 p-6">
              {([
                ['Email', optInEmail, setOptInEmail],
                ['SMS', optInSms, setOptInSms],
                ['WhatsApp', optInWhatsApp, setOptInWhatsApp],
                ['Push notifications', optInPush, setOptInPush],
              ] as [string, boolean, (v: boolean) => void][]).map(([label, val, set]) => (
                <label key={label} className="flex items-center justify-between gap-4 cursor-pointer">
                  <span className="font-secondary">{label}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-amber-600"
                    checked={val}
                    onChange={(e) => set(e.target.checked)}
                  />
                </label>
              ))}
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="mt-4 w-full rounded-md bg-amber-600 px-4 py-2 text-stone-950 font-medium hover:bg-amber-500 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
