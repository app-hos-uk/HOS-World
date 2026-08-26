'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type Summary = Record<string, number>;
type Financials = {
  shippingRevenue: number;
  actualCarrierCost: number;
  packagingCost: number;
  profit: number;
  averageShippingCost: number;
  averageBoxesPerOrder: number;
  paidOrders: number;
};
type Operations = {
  averageCounterMinutes: number;
  averagePackingMinutes: number;
  waitingOver30Min: number;
  waitingOver2Hours: number;
  missingItemAlerts: number;
  addressProblems: number;
  labelErrors: number;
};

export default function ShippingDashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fin, setFin] = useState<Financials | null>(null);
  const [ops, setOps] = useState<Operations | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, f, o] = await Promise.all([
          apiClient.getShippingDashboardSummary(),
          apiClient.getShippingDashboardFinancials(),
          apiClient.getShippingDashboardOperations(),
        ]);
        setSummary(s.data as Summary);
        setFin(f.data as Financials);
        setOps(o.data as Operations);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Dashboard failed');
      }
    })();
  }, [toast]);

  const card = (label: string, value: string | number) => (
    <div className="rounded border border-hos-border p-4 bg-hos-bg-secondary">
      <p className="text-xs text-hos-text-muted">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-semibold">In-store shipping dashboard</h1>
      <section className="space-y-3">
        <h2 className="font-medium">Today&apos;s shipping</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {card('Created', summary?.created ?? '—')}
          {card('Awaiting details', summary?.customerDetailsRequired ?? '—')}
          {card('Awaiting payment', summary?.awaitingPayment ?? '—')}
          {card('Paid', summary?.paid ?? '—')}
          {card('Waiting for packing', summary?.waitingForPacking ?? '—')}
          {card('Packing', summary?.packing ?? '—')}
          {card('Ready for carrier', summary?.readyForCarrier ?? '—')}
          {card('Shipped', summary?.shipped ?? '—')}
          {card('Delivered', summary?.delivered ?? '—')}
          {card('Problem orders', summary?.problemOrders ?? '—')}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Financial</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {card('Shipping revenue', fin?.shippingRevenue ?? '—')}
          {card('Carrier cost', fin?.actualCarrierCost ?? '—')}
          {card('Packaging cost', fin?.packagingCost ?? '—')}
          {card('Profit / loss', fin?.profit ?? '—')}
          {card('Avg shipping cost', fin?.averageShippingCost ?? '—')}
          {card('Avg boxes / order', fin?.averageBoxesPerOrder ?? '—')}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Operations</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {card('Avg counter minutes', ops?.averageCounterMinutes ?? '—')}
          {card('Avg packing minutes', ops?.averagePackingMinutes ?? '—')}
          {card('Waiting > 30 min', ops?.waitingOver30Min ?? '—')}
          {card('Waiting > 2 hours', ops?.waitingOver2Hours ?? '—')}
          {card('Missing items', ops?.missingItemAlerts ?? '—')}
          {card('Address problems', ops?.addressProblems ?? '—')}
        </div>
      </section>
    </div>
  );
}
