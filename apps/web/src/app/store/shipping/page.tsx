'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

export default function StoreShippingPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [storeId, setStoreId] = useState(user?.storeId || '');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [claimUrl, setClaimUrl] = useState('');
  const [emailQueued, setEmailQueued] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!storeId.trim() || !invoiceNumber.trim() || !email.trim()) {
      toast.error('Store, invoice, and email are required');
      return;
    }
    if (!consent) {
      toast.error('Customer must consent to shipping');
      return;
    }
    setLoading(true);
    try {
      const r = await apiClient.createStoreShipmentClaim({
        storeId: storeId.trim(),
        invoiceNumber: invoiceNumber.trim(),
        email: email.trim(),
        shippingConsent: true,
      });
      const payload = r.data as { claimUrl?: string; emailQueued?: boolean };
      const url = payload?.claimUrl || '';
      const emailed = Boolean(payload?.emailQueued);
      setClaimUrl(url);
      setEmailQueued(emailed);
      toast.success(
        emailed
          ? 'Claim link emailed to the customer'
          : 'Claim link created — copy it below (email could not be queued)',
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create claim');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-hos-text">Ship purchase home</h1>
        <p className="text-sm text-hos-text-muted mt-1">
          After the Lightspeed sale completes, capture consent. We email the customer a shipping
          claim link and also show it here so you can copy it if needed.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-hos-border p-4 bg-hos-bg-secondary">
        <label className="block text-sm text-hos-text-secondary">
          Store ID
          <input
            className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          />
        </label>
        <label className="block text-sm text-hos-text-secondary">
          Invoice / receipt number
          <input
            className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </label>
        <label className="block text-sm text-hos-text-secondary">
          Customer email
          <input
            type="email"
            className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-hos-text-secondary">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Customer consents to ship their purchase and receive shipping communications
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={submit}
          className="w-full py-2 rounded bg-violet-600 text-white disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Send shipping claim link'}
        </button>
      </div>

      {claimUrl && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm break-all">
          <p className="font-medium text-emerald-300 mb-2">Claim link</p>
          <p className="text-hos-text-muted text-xs mb-2">
            {emailQueued
              ? 'Also emailed to the customer. Copy this if they need it at the till.'
              : 'Email was not sent. Copy this link and share it with the customer.'}
          </p>
          <a href={claimUrl} className="text-violet-300 underline">
            {claimUrl}
          </a>
        </div>
      )}
    </div>
  );
}
