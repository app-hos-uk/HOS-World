'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [message, setMessage] = useState('Confirming…');

  useEffect(() => {
    if (!token) {
      setMessage('This unsubscribe link is invalid or incomplete.');
      return;
    }
    apiClient
      .getMessagingUnsubscribe(token)
      .then((r) => setMessage(r.message || 'Your preferences were updated.'))
      .catch(() => setMessage('We could not process this link. It may have expired.'));
  }, [token]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-stone-950 text-stone-100 px-6">
      <h1 className="font-primary text-xl text-amber-100 mb-4">House of Spells</h1>
      <p className="font-secondary text-stone-300 text-center max-w-md">{message}</p>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-stone-950 text-stone-300">
          Loading…
        </main>
      }
    >
      <UnsubscribeInner />
    </Suspense>
  );
}
