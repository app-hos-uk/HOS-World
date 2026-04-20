'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';

export default function MyEventsPage() {
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [past, setPast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([apiClient.getMyEventRsvps(), apiClient.getMyEventAttendances()])
      .then(([r, a]) => {
        setRsvps((r.data as any[]) || []);
        setPast((a.data as any[]) || []);
      })
      .catch(() => {
        setRsvps([]);
        setPast([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl">
          <Link href="/events" className="text-sm text-amber-400 hover:underline mb-6 inline-block">
            ← Events
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-6">My events</h1>
          {loading ? (
            <p className="text-stone-500">Loading…</p>
          ) : (
            <>
              <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-2">Upcoming RSVPs</h2>
              <ul className="space-y-3 mb-10">
                {rsvps.filter((x) => x.event && new Date(x.event.startsAt).getTime() >= now).length === 0 ? (
                  <li className="text-stone-500 text-sm">None</li>
                ) : (
                  rsvps
                    .filter((x) => x.event && new Date(x.event.startsAt).getTime() >= now)
                    .map((x) => (
                      <li key={x.id} className="border border-stone-800 rounded-lg p-3">
                        <Link href={`/events/${x.event.slug}`} className="text-amber-200 hover:underline">
                          {x.event.title}
                        </Link>
                        <p className="text-xs text-stone-500 mt-1">
                          {x.status} {x.ticketCode ? `· ${x.ticketCode}` : ''}
                        </p>
                      </li>
                    ))
                )}
              </ul>
              <h2 className="text-sm uppercase tracking-wide text-stone-500 mb-2">Past attendances</h2>
              <ul className="space-y-3">
                {past.length === 0 ? (
                  <li className="text-stone-500 text-sm">None yet</li>
                ) : (
                  past.map((x) => (
                    <li key={x.id} className="border border-stone-800 rounded-lg p-3">
                      <span className="text-stone-200">{x.event?.title}</span>
                      <p className="text-xs text-stone-500 mt-1">
                        +{x.pointsAwarded} pts · {new Date(x.checkedInAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
