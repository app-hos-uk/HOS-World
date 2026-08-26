'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

export default function ShipLookupPage() {
  return (
    <Suspense fallback={<p className="text-stone-400">Loading…</p>}>
      <ShipLookupInner />
    </Suspense>
  );
}

function ShipLookupInner() {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const { isAuthenticated } = useAuth();
  const storeId = search.get('store') || '';
  const [q, setQ] = useState(search.get('q') || '');
  const [loading, setLoading] = useState(false);

  const find = async () => {
    if (!q.trim()) {
      toast.error('Enter your House of Spells shipping order number or email');
      return;
    }
    setLoading(true);
    try {
      const r = await apiClient.lookupStoreShipment(q.trim(), storeId || undefined);
      const data = r.data as { shipmentId?: string };
      if (!data?.shipmentId) throw new Error('Order not found');
      if (!isAuthenticated) {
        router.push(`/login?redirect=/ship/request/${data.shipmentId}`);
        return;
      }
      await apiClient.attachStoreShipmentByLogin(data.shipmentId);
      router.push(`/ship/request/${data.shipmentId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not find that shipping order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Find your shipping order</h1>
        <p className="text-sm text-stone-400 mt-2">
          Enter the House of Spells shipping order number shown at the counter, or the email on your
          receipt.
        </p>
      </div>
      <input
        className="w-full border rounded px-3 py-3 bg-stone-900 border-stone-700"
        placeholder="HOS-NYC-260826-0145 or email"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button
        type="button"
        disabled={loading}
        onClick={find}
        className="w-full py-3 rounded bg-violet-600 text-white disabled:opacity-50"
      >
        {loading ? 'Looking up…' : 'Continue'}
      </button>
    </div>
  );
}
