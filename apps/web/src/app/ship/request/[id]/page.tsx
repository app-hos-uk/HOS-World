'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { RouteGuard } from '@/components/RouteGuard';

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

type Address = {
  id: string;
  firstName?: string;
  lastName?: string;
  street: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
};

type InvoiceItem = {
  id: string;
  sku?: string | null;
  name: string;
  quantity: number;
};

type Group = {
  id: string;
  status: string;
  boxSizeName?: string | null;
  customerPrice?: number;
  recipientName?: string;
  trackingCode?: string | null;
  carrierName?: string | null;
  labelUrl?: string | null;
  items: Array<{ id: string; name: string; quantity: number }>;
};

type Progress = {
  id: string;
  hosOrderNumber?: string;
  invoiceNumber?: string;
  status: string;
  nextAction?: string;
  customerName?: string;
  customerPhone?: string;
  claimEmail?: string;
  currency?: string;
  totalCustomerCharge?: number;
  onlinePaymentEnabled?: boolean;
  invoiceItems?: InvoiceItem[];
  groups?: Group[];
  user?: { firstName?: string; lastName?: string; phone?: string; email?: string };
};

function PaymentForm({ clientSecret, onSuccess }: { clientSecret: string; onSuccess: () => void }) {
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
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      <button
        type="button"
        disabled={paying || !stripe}
        onClick={handlePay}
        className="w-full py-2 rounded bg-violet-600 text-white disabled:opacity-50"
      >
        {paying ? 'Paying…' : 'Pay shipping'}
      </button>
    </div>
  );
}

export default function ShipRequestPage() {
  return (
    <RouteGuard allowedRoles={['CUSTOMER']} showAccessDenied>
      <ShipRequestInner />
    </RouteGuard>
  );
}

function ShipRequestInner() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { user, isAuthenticated } = useAuth();
  const [order, setOrder] = useState<Progress | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [multi, setMulti] = useState(false);
  const [itemAddress, setItemAddress] = useState<Record<string, string>>({});
  const [carry, setCarry] = useState<Record<string, boolean>>({});
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const profileSeeded = useRef(false);
  const initializedIdRef = useRef<string | null>(null);
  const SLOW_POLL_STATUSES = ['DELIVERED', 'CANCELLED', 'BLOCKED', 'HANDED_TO_CARRIER', 'IN_TRANSIT'];

  const loadProgress = useCallback(async () => {
    if (!id || !isAuthenticated) return;
    try {
      const [progress, addr] = await Promise.all([
        apiClient.getStoreShipmentProgress(id),
        apiClient.getAddresses(),
      ]);
      const data = progress.data as Progress;
      setOrder(data);
      setAddresses((addr.data as Address[]) || []);
      if (!profileSeeded.current) {
        profileSeeded.current = true;
        setFirstName((prev) => prev || data.user?.firstName || '');
        setLastName((prev) => prev || data.user?.lastName || '');
        setPhone((prev) => prev || data.customerPhone || data.user?.phone || '');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load shipping order');
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated, toast]);

  useEffect(() => {
    if (!id || !isAuthenticated || initializedIdRef.current === id) return;
    initializedIdRef.current = id;
    profileSeeded.current = false;
    setOrder(null);
    setLoading(true);
    setClientSecret(null);
    (async () => {
      try { await apiClient.attachStoreShipmentByLogin(id); } catch { /* already attached */ }
      await apiClient.resolveStoreShipmentSale(id).catch(() => undefined);
      await loadProgress();
    })();
  }, [id, isAuthenticated, loadProgress]);

  useEffect(() => {
    if (!initializedIdRef.current) return;
    const interval = SLOW_POLL_STATUSES.includes(order?.status || '') ? 30000 : 5000;
    const t = window.setInterval(loadProgress, interval);
    return () => window.clearInterval(t);
  }, [loadProgress, order?.status]);

  const saveProfile = async () => {
    if (!id) return;
    try {
      await apiClient.updateStoreShipmentProfile(id, { firstName, lastName, phone });
      toast.success('Profile saved');
      loadProgress();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save profile');
    }
  };

  const assign = async () => {
    if (!id || !order) return;
    const items = order.invoiceItems || [];
    if (!addresses.length) {
      toast.error('Add a shipping address first');
      return;
    }
    const defaultAddress = addresses[0].id;
    const byAddress = new Map<string, Array<{ posSaleItemId: string; quantity: number }>>();
    const carryInHand: Array<{ posSaleItemId: string; quantity: number }> = [];
    for (const item of items) {
      if (carry[item.id]) {
        carryInHand.push({ posSaleItemId: item.id, quantity: item.quantity });
        continue;
      }
      const addressId = multi ? itemAddress[item.id] || defaultAddress : defaultAddress;
      const list = byAddress.get(addressId) || [];
      list.push({ posSaleItemId: item.id, quantity: item.quantity });
      byAddress.set(addressId, list);
    }
    if (byAddress.size === 0) {
      toast.error('Select at least one item to ship');
      return;
    }
    try {
      await apiClient.assignStoreShipmentItems(id, {
        assignments: [...byAddress.entries()].map(([addressId, assigned]) => ({
          addressId,
          items: assigned,
        })),
        carryInHand,
      });
      toast.success('Items assigned — staff will confirm the box charge');
      loadProgress();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not assign items');
    }
  };

  const startPay = async () => {
    if (!id || !order?.onlinePaymentEnabled) return;
    try {
      const r = await apiClient.authorizeShipment(id, {});
      const data = r.data as { clientSecret?: string; alreadyPaid?: boolean };
      if (data.alreadyPaid) {
        await apiClient.confirmStoreShipmentPayment(id);
        toast.success('Shipping is already paid');
        loadProgress();
        return;
      }
      if (!data.clientSecret) {
        toast.error('Could not start payment');
        return;
      }
      setClientSecret(data.clientSecret);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Payment could not start');
    }
  };

  const afterPay = async () => {
    if (!id) return;
    try {
      await apiClient.confirmStoreShipmentPayment(id);
      setClientSecret(null);
      toast.success('Your House of Spells shipping order has been received');
      loadProgress();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not record payment');
    }
  };

  if (loading && !order) {
    return <p className="text-stone-400">Loading your shipping order…</p>;
  }
  if (!order) {
    return <p className="text-red-300">Shipping order not found.</p>;
  }

  const paid = ['PAID', 'SENT_TO_LOGISTICS', 'PACKING', 'PACKED', 'LABEL_CREATED', 'READY_FOR_PICKUP', 'HANDED_TO_CARRIER', 'IN_TRANSIT', 'DELIVERED'].includes(
    order.status,
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ship your purchase</h1>
        <p className="text-sm text-stone-400 mt-1">
          {order.hosOrderNumber || 'Shipping order'} · Invoice {order.invoiceNumber || '—'}
        </p>
      </div>

      <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
        <p className="font-medium">Your details</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            className="border rounded px-3 py-2 bg-stone-950 border-stone-700"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 bg-stone-950 border-stone-700"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2 bg-stone-950 border-stone-700 sm:col-span-2"
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <p className="text-xs text-stone-500">Email: {order.claimEmail || user?.email}</p>
        <button type="button" onClick={saveProfile} className="px-4 py-2 rounded bg-stone-700 text-sm">
          Save profile
        </button>
      </div>

      <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">Shipping addresses</p>
          <Link
            href={`/account/addresses?action=add&returnUrl=/ship/request/${id}`}
            className="text-sm text-violet-400 underline"
          >
            Add address
          </Link>
        </div>
        {addresses.length === 0 ? (
          <p className="text-sm text-stone-400">Add every destination you need, including gift addresses.</p>
        ) : (
          <ul className="text-sm text-stone-300 space-y-1">
            {addresses.map((a) => (
              <li key={a.id}>
                {a.street}, {a.city} {a.postalCode}
              </li>
            ))}
          </ul>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
          Ship items to multiple addresses
        </label>
      </div>

      <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
        <p className="font-medium">Items from your invoice</p>
        <p className="text-xs text-stone-500">
          Uncheck “Carry in hand” for items that should ship. If you chose multiple addresses, pick a
          destination for each item.
        </p>
        <ul className="divide-y divide-stone-800">
          {(order.invoiceItems || []).map((item) => (
            <li key={item.id} className="py-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  {item.name} {item.sku ? <span className="text-stone-500">({item.sku})</span> : null}
                </span>
                <span className="text-stone-400">×{item.quantity}</span>
              </div>
              <label className="flex items-center gap-2 text-xs text-stone-400">
                <input
                  type="checkbox"
                  checked={Boolean(carry[item.id])}
                  onChange={(e) => setCarry((c) => ({ ...c, [item.id]: e.target.checked }))}
                />
                Carry in hand
              </label>
              {multi && !carry[item.id] && (
                <select
                  className="w-full border rounded px-2 py-1 bg-stone-950 border-stone-700 text-sm"
                  value={itemAddress[item.id] || addresses[0]?.id || ''}
                  onChange={(e) => setItemAddress((m) => ({ ...m, [item.id]: e.target.value }))}
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.street}, {a.city}
                    </option>
                  ))}
                </select>
              )}
            </li>
          ))}
        </ul>
        {!paid && (
          <button type="button" onClick={assign} className="w-full py-2 rounded bg-violet-600 text-white">
            Confirm items &amp; addresses
          </button>
        )}
      </div>

      {(order.groups || []).length > 0 && (
        <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
          <p className="font-medium">Your shipments</p>
          {order.groups!.map((g, i) => (
            <div key={g.id} className="text-sm text-stone-300">
              <p>
                Box {i + 1}: {g.boxSizeName || 'Waiting for staff to choose a box'} — {g.recipientName}
              </p>
              {g.customerPrice ? (
                <p className="text-stone-400">
                  {order.currency} {Number(g.customerPrice).toFixed(2)}
                </p>
              ) : null}
              {g.trackingCode && (
                <p className="text-emerald-300">
                  {g.carrierName} {g.trackingCode}
                  {g.labelUrl ? (
                    <>
                      {' '}
                      <a href={g.labelUrl} className="underline" target="_blank" rel="noreferrer">
                        track
                      </a>
                    </>
                  ) : null}
                </p>
              )}
            </div>
          ))}
          {order.status === 'CUSTOMER_DETAILS_REQUIRED' && (
            <p className="text-amber-300 text-sm">Staff is confirming the box size and House of Spells shipping charge.</p>
          )}
        </div>
      )}

      {order.status === 'AWAITING_PAYMENT' && !order.onlinePaymentEnabled && (
        <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-2">
          <p className="font-medium">
            Shipping charge: {order.currency} {Number(order.totalCustomerCharge || 0).toFixed(2)}
          </p>
          <p className="text-sm text-stone-300">
            Please pay at the shipping counter — cash or the card machine there. Online card
            payment is not available. This screen updates when staff confirm payment.
          </p>
        </div>
      )}

      {order.status === 'AWAITING_PAYMENT' && order.onlinePaymentEnabled && !clientSecret && (
        <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50 space-y-3">
          <p className="font-medium">
            Shipping charge: {order.currency} {Number(order.totalCustomerCharge || 0).toFixed(2)}
          </p>
          <button type="button" onClick={startPay} className="w-full py-2 rounded bg-violet-600 text-white">
            Pay online
          </button>
        </div>
      )}

      {order.onlinePaymentEnabled && clientSecret && stripePromise && (
        <div className="rounded-lg border border-stone-700 p-4 bg-stone-900/50">
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentForm clientSecret={clientSecret} onSuccess={afterPay} />
          </Elements>
        </div>
      )}

      {paid && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
          <p className="font-medium text-emerald-200">Your House of Spells shipping order has been received.</p>
          <p className="text-sm text-stone-300">
            Order {order.hosOrderNumber}. You can leave the store — we will pack and send tracking when
            the carrier label is created.
          </p>
        </div>
      )}
    </div>
  );
}
