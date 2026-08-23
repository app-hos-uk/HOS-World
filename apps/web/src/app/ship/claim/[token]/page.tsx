'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

type ClaimContext = {
  shipmentId?: string;
  invoiceNumber?: string;
  status?: string;
  storeName?: string;
  emailMatchesInvoice?: boolean | null;
};

export default function ShipClaimPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const [ctx, setCtx] = useState<ClaimContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const requestIdRef = useRef(0);

  const loadClaim = useCallback(() => {
    if (!token) {
      setLoading(false);
      setLoadError('Claim link is missing.');
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const watchdog = window.setTimeout(() => {
      if (requestIdRef.current !== requestId) return;
      setLoading(false);
      setLoadError('This is taking too long. Try again.');
    }, 12000);
    apiClient
      .getStoreShipmentClaim(token)
      .then((r) => {
        if (requestIdRef.current !== requestId) return;
        window.clearTimeout(watchdog);
        const data = (r.data as ClaimContext) || null;
        if (!data?.shipmentId) {
          setCtx(null);
          setLoadError('Could not load this claim link.');
          return;
        }
        setCtx(data);
        setLoadError(null);
      })
      .catch((e) => {
        if (requestIdRef.current !== requestId) return;
        window.clearTimeout(watchdog);
        setCtx(null);
        const message = e instanceof Error ? e.message : 'Invalid claim link';
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (requestIdRef.current !== requestId) return;
        window.clearTimeout(watchdog);
        setLoading(false);
      });
  }, [token, toast]);

  useEffect(() => {
    if (!token) return;
    loadClaim();
  }, [token, isAuthenticated, user?.email, loadClaim]);

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

  if (loading && !ctx && !loadError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 space-y-4">
        <p className="text-hos-text-muted">Loading claim…</p>
        <button
          type="button"
          onClick={loadClaim}
          className="px-4 py-2 rounded bg-violet-600 text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  const continueButton = (
    <button
      type="button"
      disabled={attaching}
      onClick={attach}
      className="px-4 py-2 rounded bg-violet-600 text-white disabled:opacity-50"
    >
      {attaching ? 'Verifying…' : 'Continue to shipping'}
    </button>
  );

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
            <span className="text-hos-text-muted">Status:</span> {ctx.status}
          </p>
        </div>
      )}

      {loadError || !ctx ? (
        <div className="space-y-3">
          <p className="text-sm text-red-300">{loadError || 'Could not load this claim link.'}</p>
          <button
            type="button"
            onClick={loadClaim}
            className="px-4 py-2 rounded bg-violet-600 text-white"
          >
            Try again
          </button>
        </div>
      ) : !isAuthenticated ? (
        <div className="space-y-3">
          <p className="text-hos-text-secondary text-sm">
            Sign in or create an account with the same email as the Lightspeed customer on this
            invoice. We will not continue shipping if it does not match.
          </p>
          <Link
            href={`/login?redirect=/ship/claim/${token}`}
            className="inline-block px-4 py-2 rounded bg-violet-600 text-white"
          >
            Sign in to continue
          </Link>
        </div>
      ) : ctx.emailMatchesInvoice === false ? (
        <div className="space-y-3">
          <p className="text-sm text-red-300">
            Signed in as {user?.email}, which does not match the customer on this Lightspeed sale.
            Sign in with the email on the receipt to continue shipping.
          </p>
          <Link
            href={`/login?redirect=/ship/claim/${token}`}
            className="inline-block px-4 py-2 rounded bg-violet-600 text-white"
          >
            Sign in with the invoice email
          </Link>
        </div>
      ) : ctx.emailMatchesInvoice === true ? (
        <div className="space-y-2">
          <p className="text-sm text-hos-text-secondary">
            Signed in as {user?.email}. This matches the Lightspeed customer on the invoice.
          </p>
          {continueButton}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-hos-text-secondary">
            Signed in as {user?.email}. We could not pre-check the Lightspeed customer on this
            invoice. Continue will verify it before shipping.
          </p>
          <div className="flex flex-wrap gap-3">
            {continueButton}
            <button
              type="button"
              onClick={loadClaim}
              className="px-4 py-2 rounded border border-hos-border text-hos-text"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
