'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { RouteGuard } from '@/components/RouteGuard';

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

type Rate = {
  providerId: string;
  providerName: string;
  serviceCode: string;
  serviceName: string;
  rate: number;
  currency: string;
};

type Address = {
  id: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

type ShipmentState = {
  status: string;
  allReady?: boolean;
  enrichment?: Array<{ sku?: string | null; name?: string; status?: string; reason?: string }>;
};

function PaymentForm({
  clientSecret,
  onSuccess,
}: {
  clientSecret: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const toast = useToast();
  const [paying, setPaying] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setPaying(true);
    try {
      const card = elements.getElement(CardElement);
      if (!card) throw new Error('Card element missing');
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
      });
      if (error) throw new Error(error.message);
      if (paymentIntent?.status === 'succeeded') {
        toast.success('Payment successful');
        onSuccess();
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-stone-700 p-3 bg-stone-900">
        <CardElement
          options={{
            style: {
              base: { fontSize: '16px', color: '#e7e5e4', '::placeholder': { color: '#78716c' } },
            },
          }}
        />
      </div>
      <button
        type="button"
        disabled={paying || !stripe}
        onClick={handlePay}
        className="w-full py-2.5 rounded bg-violet-600 text-white font-medium disabled:opacity-50"
      >
        {paying ? 'Processing…' : 'Pay for shipping'}
      </button>
    </div>
  );
}

export default function ShipRequestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [shipment, setShipment] = useState<ShipmentState | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [addressSet, setAddressSet] = useState(false);

  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);

  const [purchasing, setPurchasing] = useState(false);
  const [result, setResult] = useState<{ trackingCode: string; labelUrl?: string } | null>(null);

  const resolveSale = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await apiClient.resolveStoreShipmentSale(id);
      const data = r.data as ShipmentState;
      setShipment(data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load shipment');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/ship/request/${id}`);
      return;
    }
    resolveSale();
    apiClient
      .getAddresses()
      .then((r) => setAddresses((r.data as Address[]) || []))
      .catch(() => undefined);
  }, [id, isAuthenticated, resolveSale, router]);

  const doSetAddress = async () => {
    if (!selectedAddress || !id) return;
    try {
      await apiClient.setShipmentAddress(id, selectedAddress);
      setAddressSet(true);
      toast.success('Address saved');
      const r = await apiClient.getStoreShipmentRates(id);
      setRates((r.data as Rate[]) || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to set address');
    }
  };

  const doAuthorize = async () => {
    if (!selectedRate || !id) return;
    try {
      const r = await apiClient.authorizeShipment(id, {
        carrier: selectedRate.providerId,
        service: selectedRate.serviceCode,
        amount: selectedRate.rate,
        currency: selectedRate.currency,
      });
      const data = r.data as { clientSecret?: string };
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Authorization failed');
    }
  };

  const doPurchaseLabel = async () => {
    if (!id) return;
    setPurchasing(true);
    try {
      const r = await apiClient.purchaseShipmentLabel(id);
      const data = r.data as { trackingCode: string; labelUrl?: string };
      setResult(data);
      toast.success('Label purchased — check your email for tracking');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Label purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return <p className="p-8 text-stone-500">Loading shipment…</p>;
  }

  if (result) {
    return (
      <RouteGuard allowedRoles={['CUSTOMER']}>
        <div className="max-w-lg mx-auto py-10 space-y-6 text-center">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-6 space-y-3">
            <p className="text-xl font-semibold text-emerald-300">Shipping label purchased</p>
            <p className="text-stone-300 text-sm">
              Tracking: <span className="font-mono font-semibold">{result.trackingCode}</span>
            </p>
            {result.labelUrl && (
              <a
                href={result.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 px-4 py-2 rounded bg-violet-600 text-white text-sm"
              >
                Download label
              </a>
            )}
          </div>
          <Link href="/" className="text-sm text-violet-400 hover:underline">
            Return to home
          </Link>
        </div>
      </RouteGuard>
    );
  }

  const status = shipment?.status || 'DRAFT';

  return (
    <RouteGuard allowedRoles={['CUSTOMER']}>
      <div className="max-w-lg mx-auto py-8 space-y-6">
        <div>
          <Link href="/" className="text-sm text-violet-400 hover:underline">
            ← Home
          </Link>
          <h1 className="text-2xl font-semibold mt-2 text-stone-100">Complete your shipping</h1>
          <p className="text-sm text-stone-400 mt-1">Shipment {id}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
          <span className={status !== 'PENDING_ENRICHMENT' ? 'text-violet-400' : ''}>
            1. Verify items
          </span>
          <span>→</span>
          <span className={addressSet ? 'text-violet-400' : ''}>2. Address</span>
          <span>→</span>
          <span className={rates.length > 0 ? 'text-violet-400' : ''}>3. Select rate</span>
          <span>→</span>
          <span className={paymentDone ? 'text-violet-400' : ''}>4. Pay</span>
          <span>→</span>
          <span>5. Label</span>
        </div>

        {/* Status / enrichment */}
        {status === 'PENDING_ENRICHMENT' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            We are confirming your items with the store. We will email you when it is ready — you can
            also refresh this page.
            <button
              type="button"
              onClick={resolveSale}
              className="block mt-2 text-violet-400 underline text-xs"
            >
              Refresh
            </button>
          </div>
        )}

        {status === 'BLOCKED' && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 space-y-2">
            <p>
              This shipment is blocked. The store may have restricted certain items from shipping.
              Contact support for help.
            </p>
            {Array.isArray(shipment?.enrichment) && shipment.enrichment.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-red-200">
                {shipment.enrichment
                  .filter((row) => row.status === 'BLOCKED')
                  .map((row, i) => (
                    <li key={`${row.sku || 'item'}-${i}`}>
                      {row.name || row.sku || 'Item'} is not eligible to ship.
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}

        {/* Step 2: Address */}
        {shipment?.allReady && !addressSet && status !== 'BLOCKED' && (
          <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
            <p className="font-medium text-stone-200">Where should we ship to?</p>
            {addresses.length > 0 ? (
              <>
                <select
                  value={selectedAddress}
                  onChange={(e) => setSelectedAddress(e.target.value)}
                  className="w-full border rounded px-3 py-2 bg-stone-900 border-stone-700 text-stone-200"
                >
                  <option value="">Select an address</option>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.line1}, {a.city} {a.postalCode}, {a.country}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedAddress}
                  onClick={doSetAddress}
                  className="w-full py-2 rounded bg-violet-600 text-white disabled:opacity-50"
                >
                  Use this address
                </button>
              </>
            ) : (
              <div className="text-sm text-stone-400">
                <p>You have no saved addresses.</p>
                <Link href="/account/addresses" className="text-violet-400 underline">
                  Add an address first
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Rate selection */}
        {addressSet && rates.length > 0 && !clientSecret && (
          <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
            <p className="font-medium text-stone-200">Choose a shipping option</p>
            <ul className="space-y-2">
              {rates.map((rate) => {
                const key = `${rate.providerId}-${rate.serviceCode}`;
                const active = selectedRate && `${selectedRate.providerId}-${selectedRate.serviceCode}` === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => setSelectedRate(rate)}
                      className={`w-full text-left border rounded p-3 text-sm transition-colors ${
                        active
                          ? 'border-violet-500 bg-violet-500/10 text-stone-100'
                          : 'border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-600'
                      }`}
                    >
                      <span className="font-medium">{rate.providerName}</span>
                      <span className="mx-2 text-stone-500">·</span>
                      {rate.serviceName}
                      <span className="float-right font-semibold">
                        {rate.currency} {rate.rate.toFixed(2)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {selectedRate && (
              <button
                type="button"
                onClick={doAuthorize}
                className="w-full py-2 rounded bg-violet-600 text-white"
              >
                Continue to payment — {selectedRate.currency} {selectedRate.rate.toFixed(2)}
              </button>
            )}
          </div>
        )}

        {/* Step 4: Payment */}
        {clientSecret && !paymentDone && stripePromise && (
          <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
            <p className="font-medium text-stone-200">Pay for shipping</p>
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <PaymentForm clientSecret={clientSecret} onSuccess={() => setPaymentDone(true)} />
            </Elements>
          </div>
        )}

        {/* Step 5: Purchase label */}
        {paymentDone && !result && (
          <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
            <p className="font-medium text-stone-200">Payment complete — purchase your label</p>
            <p className="text-sm text-stone-400">
              Once purchased, the carrier label and tracking number will be emailed to you.
            </p>
            <button
              type="button"
              disabled={purchasing}
              onClick={doPurchaseLabel}
              className="w-full py-2.5 rounded bg-emerald-600 text-white font-medium disabled:opacity-50"
            >
              {purchasing ? 'Purchasing…' : 'Purchase shipping label'}
            </button>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
