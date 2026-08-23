'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

type ConfirmedInvoice = {
  number: string;
  totalAmount: number;
  currency: string;
  saleDate: string | Date;
};

export default function StoreShippingPage() {
  const toast = useToast();
  const { user } = useAuth();
  const assignedStoreId = user?.storeId || '';
  const staffLockedToStore = user?.role === 'STORE_STAFF' && Boolean(assignedStoreId);
  const [storeId, setStoreId] = useState(assignedStoreId);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [claimUrl, setClaimUrl] = useState('');
  const [emailQueued, setEmailQueued] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedInvoice | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const resolvedStoreId = staffLockedToStore ? assignedStoreId : storeId.trim();
    if (!resolvedStoreId || !invoiceNumber.trim() || !email.trim()) {
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
        storeId: resolvedStoreId,
        invoiceNumber: invoiceNumber.trim(),
        email: email.trim(),
        shippingConsent: true,
      });
      const payload = r.data as {
        claimUrl?: string;
        emailQueued?: boolean;
        resent?: boolean;
        confirmedInvoice?: ConfirmedInvoice;
      };
      const url = payload?.claimUrl || '';
      const emailed = Boolean(payload?.emailQueued);
      setClaimUrl(url);
      setEmailQueued(emailed);
      setConfirmed(payload?.confirmedInvoice || null);
      toast.success(
        emailed
          ? payload?.resent
            ? 'Invoice confirmed — claim link resent to the customer'
            : 'Invoice confirmed — claim link emailed to the customer'
          : 'Invoice confirmed — copy the claim link below (email could not be queued)',
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
          After the Lightspeed sale is completed, enter the invoice or receipt number and the
          customer email from that sale. We confirm both before emailing the shipping claim link.
          Product details are loaded later, after they sign in.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-hos-border p-4 bg-hos-bg-secondary">
        <label className="block text-sm text-hos-text-secondary">
          Store ID
          <input
            className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border disabled:opacity-70"
            value={staffLockedToStore ? assignedStoreId : storeId}
            onChange={(e) => setStoreId(e.target.value)}
            disabled={staffLockedToStore}
            readOnly={staffLockedToStore}
          />
        </label>
        <label className="block text-sm text-hos-text-secondary">
          Invoice / receipt number
          <input
            className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="As shown on the Lightspeed receipt"
          />
        </label>
        <label className="block text-sm text-hos-text-secondary">
          Customer email
          <input
            type="email"
            className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Must match the Lightspeed customer on this invoice"
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
          {loading ? 'Checking invoice…' : 'Confirm invoice & send claim link'}
        </button>
      </div>

      {claimUrl && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm break-all space-y-2">
          <p className="font-medium text-emerald-300">Claim link</p>
          {confirmed && (
            <p className="text-hos-text-muted text-xs">
              Confirmed invoice {confirmed.number}
              {confirmed.totalAmount != null
                ? ` · ${confirmed.currency || ''} ${Number(confirmed.totalAmount).toFixed(2)}`
                : ''}
            </p>
          )}
          <p className="text-hos-text-muted text-xs">
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
