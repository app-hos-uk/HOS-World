'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

export default function LoyaltyMessagesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .getMessageHistory({ page: 1, limit: 50 })
      .then((r: any) => setItems(r.data?.items || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
          <Link href="/loyalty" className="text-amber-200/80 text-sm hover:underline mb-6 inline-block">
            ← Back to loyalty
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-2">Message history</h1>
          <p className="font-secondary text-stone-400 text-sm mb-6">
            Recent messages sent from The Enchanted Circle across channels.
          </p>
          {loading ? (
            <p className="text-stone-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-stone-500 font-secondary">No messages yet.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-stone-800 bg-stone-900/50 px-4 py-3 font-secondary text-sm"
                >
                  <div className="flex justify-between gap-2 text-stone-400 text-xs mb-1">
                    <span>{new Date(m.createdAt).toLocaleString()}</span>
                    <span>
                      {m.channel} · {m.status}
                    </span>
                  </div>
                  {m.templateSlug && <p className="text-amber-100/90">{m.templateSlug}</p>}
                  {m.subject && <p className="text-stone-300">{m.subject}</p>}
                </li>
              ))}
            </ul>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
