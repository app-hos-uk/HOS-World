'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { CustomerQr } from '@/components/CustomerQr';

type ConfirmedInvoice = {
  number: string;
  totalAmount: number;
  currency: string;
  saleDate: string | Date;
};

type CreatedOrder = {
  shipmentId?: string;
  hosOrderNumber?: string;
  lookupUrl?: string;
  claimUrl?: string;
  emailQueued?: boolean;
  customerEmail?: string;
  existingOrder?: boolean;
  items?: Array<{ id?: string; sku?: string | null; name: string; quantity: number }>;
  confirmedInvoice?: ConfirmedInvoice;
};

export default function StoreShippingPage() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const assignedStoreId = user?.storeId || '';
  const staffLockedToStore = user?.role === 'STORE_STAFF' && Boolean(assignedStoreId);
  const [storeId, setStoreId] = useState(assignedStoreId);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<CreatedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const submit = async () => {
    const resolvedStoreId = staffLockedToStore ? assignedStoreId : storeId.trim();
    if (!resolvedStoreId || !invoiceNumber.trim()) {
      toast.error('Store and invoice number are required');
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
        ...(email.trim() ? { email: email.trim() } : {}),
        shippingConsent: true,
      });
      const payload = (r.data || {}) as CreatedOrder;
      setResult(payload);
      if (payload.existingOrder) {
        toast.success('Customer already registered — opening the existing order');
      } else {
        toast.success(
          payload.emailQueued
            ? 'Invoice imported — magic link emailed to the customer'
            : 'Invoice imported — share the QR or magic link with the customer',
        );
      }
      if (payload.shipmentId) {
        router.push(`/store/shipping/${payload.shipmentId}`);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create shipping order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-hos-text">Shipping counter</h1>
        <p className="text-sm text-hos-text-muted mt-1">
          Scan or enter the Lightspeed invoice. Customer email and items are imported automatically.
          The customer then scans the store QR or opens the magic link on their phone.
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
          <div className="mt-1 flex gap-2">
            <input
              className="flex-1 border rounded px-3 py-2 bg-hos-bg border-hos-border"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Scan barcode or type the receipt number"
            />
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="px-3 py-2 rounded border border-violet-500 text-violet-300 text-sm"
            >
              Scan
            </button>
          </div>
        </label>
        <label className="block text-sm text-hos-text-secondary">
          Customer email (optional fallback)
          <input
            type="email"
            className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Only needed if Lightspeed has no customer email"
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
          {loading ? 'Importing invoice…' : 'Create shipping order'}
        </button>
      </div>

      {result?.hosOrderNumber && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm space-y-2">
          <p className="font-medium text-emerald-300">{result.hosOrderNumber}</p>
          <p className="text-hos-text-muted text-xs">
            Email: {result.customerEmail || '—'}
            {result.confirmedInvoice
              ? ` · Invoice ${result.confirmedInvoice.number}`
              : ''}
          </p>
          {result.lookupUrl && (
            <CustomerQr value={result.lookupUrl} size={176} className="flex flex-col items-start gap-1" />
          )}
        </div>
      )}

      {scanning && (
        <BarcodeScanner
          onScan={(text) => {
            setInvoiceNumber(text);
            setScanning(false);
            toast.success('Barcode captured');
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </div>
  );
}
