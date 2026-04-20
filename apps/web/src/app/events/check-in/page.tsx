'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function EventCheckInPage() {
  const toast = useToast();
  const [eventId, setEventId] = useState('');
  const [ticketCode, setTicketCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!eventId.trim()) {
      toast.error('Enter event ID');
      return;
    }
    setBusy(true);
    try {
      await apiClient.checkInEvent(eventId.trim(), {
        ticketCode: ticketCode.trim() || undefined,
        method: ticketCode.trim() ? 'TICKET_SCAN' : 'QR_SCAN',
      });
      toast.success('Checked in!');
      setTicketCode('');
    } catch (e: any) {
      toast.error(e?.message || 'Check-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-10 max-w-md">
          <Link href="/events" className="text-sm text-amber-400 hover:underline mb-6 inline-block">
            ← Events
          </Link>
          <h1 className="font-primary text-2xl text-amber-100 mb-4">Event check-in</h1>
          <p className="text-sm text-stone-500 mb-6 font-secondary">
            Enter the event ID from your confirmation (or scan flow). Optional ticket code if prompted.
          </p>
          <label className="block text-sm mb-2">
            <span className="text-stone-400">Event ID</span>
            <input
              className="mt-1 w-full rounded bg-stone-900 border border-stone-700 px-3 py-2 text-stone-100"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="UUID"
            />
          </label>
          <label className="block text-sm mb-4">
            <span className="text-stone-400">Ticket code (optional)</span>
            <input
              className="mt-1 w-full rounded bg-stone-900 border border-stone-700 px-3 py-2 text-stone-100"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              placeholder="8-character code"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-md bg-amber-600 px-4 py-2 text-stone-950 font-medium disabled:opacity-50"
          >
            {busy ? 'Checking in…' : 'Check in'}
          </button>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
