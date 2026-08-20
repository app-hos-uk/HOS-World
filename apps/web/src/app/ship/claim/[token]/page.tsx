'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

export default function ShipClaimPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const [ctx, setCtx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attaching, setAttaching] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiClient
      .getStoreShipmentClaim(token)
      .then((r) => setCtx(r.data))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Invalid claim link'))
      .finally(() => setLoading(false));
  }, [token, toast]);

  const attach = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/ship/claim/${token}`);
      return;
    }
    setAttaching(true);
    try {
      const r = await apiClient.attachStoreShipmentClaim(token);
      const shipmentId = (r.data as { shipmentId?: string })?.shipmentId || ctx?.shipmentId;
      toast.success('Claim verified — continue to shipping');
      if (shipmentId) router.push(`/ship/request/${shipmentId}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not attach claim');
    } finally {
      setAttaching(false);
    }
  };

  if (loading) return <p className="p-8 text-hos-text-muted">Loading claim…</p>;

  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-semibold text-hos-text">Ship your purchase</h1>
      {ctx && (
        <div className="rounded-lg border border-hos-border p-4 bg-hos-bg-secondary space-y-2 text-sm">
          <p>
            <span className="text-hos-text-muted">Store:</span> {ctx.storeName}
          </p>
          <p>
            <span className="text-hos-text-muted">Invoice:</span> {ctx.invoiceNumber}
          </p>
          <p>
            <span className="text-hos-text-muted">Email:</span> {ctx.email}
          </p>
          <p>
            <span className="text-hos-text-muted">Status:</span> {ctx.status}
          </p>
        </div>
      )}

      {!isAuthenticated ? (
        <div className="space-y-3">
          <p className="text-hos-text-secondary text-sm">
            Sign in or create an account with the same email used at the till to continue.
          </p>
          <Link
            href={`/login?redirect=/ship/claim/${token}`}
            className="inline-block px-4 py-2 rounded bg-violet-600 text-white"
          >
            Sign in to continue
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-hos-text-secondary">
            Signed in as {user?.email}. We will verify it matches this claim.
          </p>
          <button
            type="button"
            disabled={attaching}
            onClick={attach}
            className="px-4 py-2 rounded bg-violet-600 text-white disabled:opacity-50"
          >
            {attaching ? 'Verifying…' : 'Continue to shipping'}
          </button>
        </div>
      )}
    </div>
  );
}
