'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

export default function EventsListingPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getEvents({ limit: 50 })
      .then((r) => {
        const d = r.data as { items?: any[] };
        setItems(d?.items || []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="font-primary text-3xl text-amber-100">Events & experiences</h1>
          <Link href="/events/my-events" className="text-sm text-amber-400 hover:underline">
            My events
          </Link>
        </div>
        {loading ? (
          <p className="text-stone-500 font-secondary">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-stone-500 font-secondary">No upcoming events right now.</p>
        ) : (
          <ul className="space-y-4">
            {items.map((e) => (
              <li key={e.id} className="rounded-lg border border-stone-800 bg-stone-900/50 p-4">
                <Link href={`/events/${e.slug}`} className="text-lg text-amber-200 hover:underline">
                  {e.title}
                </Link>
                <p className="text-sm text-stone-400 mt-1 font-secondary">
                  {new Date(e.startsAt).toLocaleString()} · {e.store?.name || e.type}
                  {e.spotsLeft != null ? ` · ${e.spotsLeft} spots left` : ''}
                </p>
                {e.tierRestricted && (
                  <span className="inline-block mt-2 text-xs bg-amber-900/40 text-amber-200 px-2 py-0.5 rounded">
                    Tier eligibility applies
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
