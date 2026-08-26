'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DEFAULT_CURRENCY } from '@/lib/regionConfig';

type BoxSize = {
  id: string;
  name: string;
  label: string;
  customerPrice: string | number;
  packagingCost: string | number;
  currency: string;
};

type Group = {
  id: string;
  recipientName?: string;
  boxSizeId?: string | null;
  boxSizeName?: string | null;
  recommendedBoxName?: string;
  customerPrice?: number;
  destinationSnapshot?: Record<string, string>;
  shippingTier?: { name?: string; code?: string; currency?: string } | null;
  pricesByBox?: Record<string, number>;
  items: Array<{ id: string; name: string; sku?: string | null; quantity: number }>;
};

type Progress = {
  id: string;
  hosOrderNumber?: string;
  invoiceNumber?: string;
  status: string;
  nextAction?: string;
  claimEmail?: string;
  customerName?: string;
  currency?: string;
  totalCustomerCharge?: number;
  paymentMethod?: string | null;
  onlinePaymentEnabled?: boolean;
  lookupUrl?: string;
  invoiceItems?: Array<{ id: string; name: string; sku?: string | null; quantity: number }>;
  groups?: Group[];
  boxSizes?: BoxSize[];
};

export default function StaffShippingOrderPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [order, setOrder] = useState<Progress | null>(null);
  const [boxPick, setBoxPick] = useState<Record<string, string>>({});
  const [customPrice, setCustomPrice] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'OTHER'>('CASH');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await apiClient.getStaffStoreShipment(id);
      const data = r.data as Progress;
      setOrder(data);
      const next: Record<string, string> = {};
      for (const g of data.groups || []) {
        if (g.boxSizeId) next[g.id] = g.boxSizeId;
        else {
          const rec = (data.boxSizes || []).find((b) => b.name === g.recommendedBoxName);
          if (rec) next[g.id] = rec.id;
        }
      }
      setBoxPick((prev) => ({ ...next, ...prev }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 5000);
    return () => window.clearInterval(t);
  }, [load]);

  const saveQuote = async () => {
    if (!id || !order?.groups?.length) return;
    try {
      await apiClient.setStoreShipmentBoxSizes(id, {
        groups: order.groups.map((g) => ({
          groupId: g.id,
          boxSizeId: boxPick[g.id],
          customPrice: customPrice[g.id] ? Number(customPrice[g.id]) : undefined,
        })),
      });
      toast.success('Quote sent to the customer');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not save box sizes');
    }
  };

  const printSlip = () => {
    window.open(`/api/proxy/store-shipment/${id}/slip`, '_blank');
  };

  const confirmPayment = async () => {
    if (!id) return;
    setConfirming(true);
    try {
      await apiClient.staffConfirmShipmentPayment(id, { method: payMethod });
      toast.success('Payment confirmed — you can print the shipping slip');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not confirm payment');
    } finally {
      setConfirming(false);
    }
  };

  const liveQuote = (order?.groups || []).reduce((sum, group) => {
    const boxId = boxPick[group.id];
    if (!boxId) return sum;
    const box = (order?.boxSizes || []).find((b) => b.id === boxId);
    if (box?.name === 'CUSTOM' && customPrice[group.id]) {
      return sum + Number(customPrice[group.id] || 0);
    }
    const tierPrice = group.pricesByBox?.[boxId];
    return sum + (tierPrice != null ? Number(tierPrice) : Number(box?.customerPrice || 0));
  }, 0);

  if (loading && !order) return <p className="text-hos-text-muted">Loading order…</p>;
  if (!order) return <p className="text-red-300">Order not found</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-hos-text-muted">
            <Link href="/store/shipping" className="underline">
              Shipping counter
            </Link>
          </p>
          <h1 className="text-xl font-semibold text-hos-text">{order.hosOrderNumber || order.id}</h1>
          <p className="text-sm text-hos-text-muted">
            Invoice {order.invoiceNumber || '—'} · {order.claimEmail || '—'} · {order.status}
          </p>
        </div>
        {order.lookupUrl && (
          <img
            alt="Customer QR"
            className="bg-white p-2 rounded w-32 h-32"
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(order.lookupUrl)}`}
          />
        )}
      </div>

      <div className="rounded-lg border border-hos-border p-4 bg-hos-bg-secondary space-y-2">
        <p className="font-medium text-hos-text">Invoice items</p>
        <ul className="text-sm text-hos-text-secondary divide-y divide-hos-border">
          {(order.invoiceItems || []).map((item) => (
            <li key={item.id} className="py-2 flex justify-between">
              <span>
                {item.name} {item.sku ? <span className="text-hos-text-muted">({item.sku})</span> : null}
              </span>
              <span>×{item.quantity}</span>
            </li>
          ))}
        </ul>
      </div>

      {(!order.groups || order.groups.length === 0) && (
        <p className="text-sm text-amber-300">
          Waiting for the customer to add addresses and assign items on their phone…
        </p>
      )}

      {(order.groups || []).map((group, i) => {
        const dest = group.destinationSnapshot || {};
        return (
          <div key={group.id} className="rounded-lg border border-hos-border p-4 bg-hos-bg-secondary space-y-3">
            <p className="font-medium text-hos-text">
              Shipment {i + 1}: {group.recipientName || 'Customer'}
            </p>
            <p className="text-xs text-hos-text-muted">
              {[dest.street, dest.city, dest.postalCode, dest.country].filter(Boolean).join(', ')}
              {group.shippingTier?.name ? ` · ${group.shippingTier.name}` : ''}
            </p>
            <ul className="text-sm text-hos-text-secondary">
              {group.items.map((item) => (
                <li key={item.id}>
                  {item.name} ×{item.quantity}
                </li>
              ))}
            </ul>
            <label className="block text-sm text-hos-text-secondary">
              Box size {group.recommendedBoxName ? `(recommended ${group.recommendedBoxName})` : ''}
              <select
                className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
                value={boxPick[group.id] || ''}
                onChange={(e) => setBoxPick((p) => ({ ...p, [group.id]: e.target.value }))}
              >
                <option value="">Select box</option>
                {(order.boxSizes || []).map((b) => {
                  const tierPrice = group.pricesByBox?.[b.id];
                  const price = tierPrice != null ? Number(tierPrice) : Number(b.customerPrice);
                  return (
                    <option key={b.id} value={b.id}>
                      {b.label} — {group.shippingTier?.currency || b.currency} {price.toFixed(2)}
                    </option>
                  );
                })}
              </select>
            </label>
            {(order.boxSizes || []).find((b) => b.id === boxPick[group.id])?.name === 'CUSTOM' && (
              <input
                className="w-full border rounded px-3 py-2 bg-hos-bg border-hos-border text-sm"
                placeholder="Custom price"
                value={customPrice[group.id] || ''}
                onChange={(e) => setCustomPrice((p) => ({ ...p, [group.id]: e.target.value }))}
              />
            )}
          </div>
        );
      })}

      {(order.groups || []).length > 0 && (
        <button
          type="button"
          onClick={saveQuote}
          className="w-full py-2 rounded bg-violet-600 text-white"
        >
          Finalize quote
          {liveQuote > 0
            ? ` — ${order.groups?.[0]?.shippingTier?.currency || order.currency || DEFAULT_CURRENCY} ${liveQuote.toFixed(2)}`
            : order.totalCustomerCharge
              ? ` — ${order.currency} ${Number(order.totalCustomerCharge).toFixed(2)}`
              : ''}
        </button>
      )}

      {order.status === 'AWAITING_PAYMENT' && (
        <div className="rounded-lg border border-emerald-500/30 p-4 bg-hos-bg-secondary space-y-3">
          <p className="font-medium text-hos-text">
            Collect {order.currency || DEFAULT_CURRENCY} {Number(order.totalCustomerCharge || 0).toFixed(2)} at the counter
          </p>
          <p className="text-sm text-hos-text-muted">
            Cash or the standalone card machine — not Lightspeed POS
            {order.onlinePaymentEnabled ? '. Online Stripe payment is also enabled.' : '.'}
          </p>
          <label className="block text-sm text-hos-text-secondary">
            Payment method
            <select
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as 'CASH' | 'CARD' | 'OTHER')}
            >
              <option value="CASH">Cash</option>
              <option value="CARD">Card (standalone machine)</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <button
            type="button"
            onClick={confirmPayment}
            disabled={confirming}
            className="w-full py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
          >
            {confirming ? 'Confirming…' : 'Confirm payment received'}
          </button>
        </div>
      )}

      {order.paymentMethod && ['PAID', 'PACKING', 'PACKED', 'LABEL_CREATED', 'READY_FOR_PICKUP'].includes(order.status) && (
        <p className="text-sm text-hos-text-muted">
          Payment recorded:{' '}
          {order.paymentMethod === 'CASH'
            ? 'Cash'
            : order.paymentMethod === 'CARD'
              ? 'Card (standalone machine)'
              : 'Other'}
        </p>
      )}

      {['PAID', 'PACKING', 'PACKED', 'LABEL_CREATED', 'READY_FOR_PICKUP'].includes(order.status) && (
        <button
          type="button"
          onClick={printSlip}
          className="w-full py-2 rounded border border-hos-border text-hos-text"
        >
          Print shipping slip
        </button>
      )}
    </div>
  );
}
