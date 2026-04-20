'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function EventDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const toast = useToast();
  const [ev, setEv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    apiClient
      .getEventBySlug(slug)
      .then((r) => setEv(r.data))
      .catch(() => setEv(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const rsvp = async () => {
    if (!ev?.id) return;
    try {
      await apiClient.rsvpEvent(ev.id, { guestCount: 0 });
      toast.success('RSVP confirmed');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not RSVP');
    }
  };

  const cancel = async () => {
    if (!ev?.id) return;
    try {
      await apiClient.cancelEventRsvp(ev.id);
      toast.success('RSVP cancelled');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-10 max-w-2xl">
        <Link href="/events" className="text-sm text-amber-400 hover:underline mb-6 inline-block">
          ← All events
        </Link>
        {loading ? (
          <p className="text-stone-500">Loading…</p>
        ) : !ev ? (
          <p className="text-red-400">Event not found.</p>
        ) : (
          <article className="space-y-4">
            <h1 className="font-primary text-3xl text-amber-100">{ev.title}</h1>
            <p className="text-stone-400 font-secondary text-sm">
              {new Date(ev.startsAt).toLocaleString()} — {new Date(ev.endsAt).toLocaleString()}
            </p>
            {ev.shortDescription && <p className="text-stone-300 font-secondary">{ev.shortDescription}</p>}
            {ev.description && (
              <div className="prose prose-invert text-sm font-secondary whitespace-pre-wrap">{ev.description}</div>
            )}
            <p className="text-amber-200/90 text-sm">Earn {ev.attendancePoints} points when you attend.</p>
            {ev.virtualUrl && (
              <p className="text-sm">
                <a href={ev.virtualUrl} className="text-amber-400 underline" target="_blank" rel="noreferrer">
                  Join link
                </a>
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-4">
              {ev.userRsvp?.status === 'CONFIRMED' || ev.userRsvp?.status === 'WAITLISTED' ? (
                <>
                  <span className="text-sm text-stone-400">
                    Status: {ev.userRsvp.status}
                    {ev.userRsvp.ticketCode ? ` · Code: ${ev.userRsvp.ticketCode}` : ''}
                  </span>
                  {ev.userRsvp.status === 'CONFIRMED' && (
                    <button
                      type="button"
                      onClick={cancel}
                      className="rounded-md border border-stone-600 px-3 py-1.5 text-sm"
                    >
                      Cancel RSVP
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={rsvp}
                  disabled={!ev.userCanRsvp}
                  className="rounded-md bg-amber-600 px-4 py-2 text-stone-950 font-medium disabled:opacity-40"
                >
                  RSVP
                </button>
              )}
              <Link href="/events/check-in" className="rounded-md border border-stone-600 px-4 py-2 text-sm self-center">
                Check-in
              </Link>
            </div>
          </article>
        )}
      </main>
      <Footer />
    </div>
  );
}
