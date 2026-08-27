'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';

type Item = { id: string; name: string; sku?: string | null; quantity: number; verified?: boolean };
type Group = {
  id: string;
  status: string;
  boxSizeName?: string | null;
  trackingCode?: string | null;
  labelUrl?: string | null;
  recipientName?: string | null;
  items: Item[];
};
type Order = {
  id: string;
  hosOrderNumber?: string;
  invoiceNumber?: string;
  status: string;
  groups?: Group[];
};

export default function BackofficeShippingPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [employeeName, setEmployeeName] = useState(
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '',
  );
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [weight, setWeight] = useState<Record<string, string>>({});
  const [trackScan, setTrackScan] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const r = await apiClient.listBackofficeStoreShipments();
      const payload = r.data as { items?: Order[] } | Order[] | null;
      const list = Array.isArray(payload) ? payload : (payload?.items ?? []);
      setOrders(list);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load packing queue');
    }
  }, [toast]);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 8000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-hos-text">Back office packing</h1>
        <p className="text-sm text-hos-text-muted mt-1">
          Receive the order, check off items, weigh the box, generate the Shippo label, then verify
          the HOS barcode against the carrier tracking barcode.
        </p>
      </div>
      <label className="block text-sm text-hos-text-secondary max-w-sm">
        Your name (chain of custody)
        <input
          className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg border-hos-border"
          value={employeeName}
          onChange={(e) => setEmployeeName(e.target.value)}
        />
      </label>

      {orders.length === 0 && <p className="text-hos-text-muted text-sm">No packing work right now.</p>}

      {orders.map((order) => (
        <div key={order.id} className="rounded-lg border border-hos-border p-4 bg-hos-bg-secondary space-y-4">
          <div className="flex justify-between gap-3">
            <div>
              <p className="font-semibold text-hos-text">{order.hosOrderNumber || order.id}</p>
              <p className="text-xs text-hos-text-muted">
                Invoice {order.invoiceNumber || '—'} · {order.status}
              </p>
            </div>
            <Link href={`/store/shipping/${order.id}`} className="text-xs text-violet-400 underline">
              Open
            </Link>
          </div>

          {(order.status === 'PAID' || order.status === 'SENT_TO_LOGISTICS') && (
            <button
              type="button"
              className="px-3 py-2 rounded bg-violet-600 text-white text-sm"
              onClick={async () => {
                try {
                  await apiClient.receiveStoreShipment(order.id, employeeName || 'Staff');
                  toast.success('Received by logistics');
                  load();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Receive failed');
                }
              }}
            >
              Scan received
            </button>
          )}

          {(order.groups || []).map((group, gi) => (
            <div key={group.id} className="border border-hos-border rounded p-3 space-y-2">
              <p className="text-sm font-medium text-hos-text">
                Box {gi + 1} · {group.boxSizeName || 'Box'} · {group.recipientName || ''} · {group.status}
              </p>
              {group.items.map((item) => {
                const key = item.id;
                return (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-hos-text-secondary">
                    <input
                      type="checkbox"
                      checked={Boolean(checked[key] || item.verified)}
                      onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
                    />
                    {item.name} ×{item.quantity} {item.sku ? `(${item.sku})` : ''}
                  </label>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded bg-emerald-700 text-white text-sm"
                  onClick={async () => {
                    try {
                      await apiClient.verifyStoreShipmentItems(group.id, {
                        verifiedItemIds: group.items
                          .filter((i) => checked[i.id] || i.verified)
                          .map((i) => i.id),
                        packedBy: employeeName,
                      });
                      toast.success('Items verified');
                      load();
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : 'Verify failed');
                    }
                  }}
                >
                  Seal package
                </button>
                <input
                  className="border rounded px-2 py-1 bg-hos-bg border-hos-border text-sm w-28"
                  placeholder="kg"
                  value={weight[group.id] || ''}
                  onChange={(e) => setWeight((w) => ({ ...w, [group.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="px-3 py-1.5 rounded border border-hos-border text-sm"
                  onClick={async () => {
                    try {
                      await apiClient.setStoreShipmentGroupWeight(group.id, {
                        weightKg: Number(weight[group.id]),
                      });
                      const r = await apiClient.generateStoreShipmentLabel(group.id);
                      toast.success('Label generated');
                      const data = r.data as { groups?: Group[] };
                      const g = (data.groups || []).find((x) => x.id === group.id);
                      if (g?.labelUrl) window.open(g.labelUrl, '_blank');
                      load();
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : 'Label failed');
                    }
                  }}
                >
                  Weigh & generate label
                </button>
              </div>
              {group.trackingCode && (
                <div className="space-y-2">
                  <p className="text-xs text-hos-text-muted">Carrier tracking: {group.trackingCode}</p>
                  {group.labelUrl && (
                    <a href={group.labelUrl} target="_blank" rel="noreferrer" className="text-xs text-violet-400 underline">
                      Open label
                    </a>
                  )}
                  <input
                    className="w-full border rounded px-2 py-1 bg-hos-bg border-hos-border text-sm"
                    placeholder="Scan carrier tracking barcode"
                    value={trackScan[group.id] || ''}
                    onChange={(e) => setTrackScan((s) => ({ ...s, [group.id]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded bg-violet-600 text-white text-sm"
                    onClick={async () => {
                      try {
                        await apiClient.verifyStoreShipmentLabel(group.id, {
                          hosOrderNumber: order.hosOrderNumber || '',
                          carrierTrackingNumber: trackScan[group.id] || group.trackingCode || '',
                        });
                        toast.success('Label linked to this order');
                        load();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : 'Mismatch');
                      }
                    }}
                  >
                    Verify HOS + carrier barcodes
                  </button>
                </div>
              )}
            </div>
          ))}

          {order.status === 'READY_FOR_PICKUP' && (
            <button
              type="button"
              className="px-3 py-2 rounded bg-stone-700 text-white text-sm"
              onClick={async () => {
                try {
                  await apiClient.carrierPickupStoreShipment(order.id);
                  toast.success('Handed to carrier');
                  load();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : 'Pickup failed');
                }
              }}
            >
              Carrier collected
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
