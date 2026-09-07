'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type QueueCounts = {
  pendingCustomers: number;
  awaitingPayment: number;
  packing: number;
};

export default function StoreDashboardPage() {
  const { user } = useAuth();
  const firstName = user?.firstName || 'there';
  const [counts, setCounts] = useState<QueueCounts>({ pendingCustomers: 0, awaitingPayment: 0, packing: 0 });

  const loadCounts = useCallback(async () => {
    try {
      const [pending, ap, pk] = await Promise.allSettled([
        apiClient.listStaffPendingCustomerQueue({ limit: 1 }),
        apiClient.listStaffStoreShipments({ status: 'AWAITING_PAYMENT', limit: 1 }),
        apiClient.listBackofficeStoreShipments('PACKING'),
      ]);

      const pendingTotal =
        pending.status === 'fulfilled'
          ? ((pending.value.data as { pagination?: { total?: number } })?.pagination?.total ?? 0)
          : 0;

      const awaitingPayment =
        ap.status === 'fulfilled'
          ? ((ap.value.data as { pagination?: { total?: number } })?.pagination?.total ?? 0)
          : 0;

      let packing = 0;
      if (pk.status === 'fulfilled') {
        const packData = pk.value.data as { items?: unknown[] } | unknown[] | null;
        packing = Array.isArray(packData)
          ? packData.length
          : ((packData as { items?: unknown[] })?.items?.length ?? 0);
      }

      setCounts({ pendingCustomers: pendingTotal, awaitingPayment, packing });
    } catch {
      // best-effort counts
    }
  }, []);

  useEffect(() => {
    loadCounts();
    const id = setInterval(loadCounts, 20_000);
    return () => clearInterval(id);
  }, [loadCounts]);

  const actions = [
    {
      title: 'Ship a purchase',
      description: 'Scan the receipt barcode or type the invoice number to start shipping for a customer.',
      href: '/store/shipping',
      badge: null,
      color: 'bg-violet-600',
      textColor: 'text-white',
    },
    {
      title: 'Pending customers',
      description: 'Customers who need to register, add their address, or finish entering details.',
      href: '/store/shipping/pending-queue',
      badge: counts.pendingCustomers || null,
      color: 'bg-amber-900/30',
      textColor: 'text-amber-300',
    },
    {
      title: 'Back office packing',
      description: 'Receive paid orders, check items, weigh, generate labels, and hand to carrier.',
      href: '/store/shipping/backoffice',
      badge: counts.packing || null,
      color: 'bg-emerald-900/30',
      textColor: 'text-emerald-300',
    },
    {
      title: 'Loyalty member lookup',
      description: 'Search loyalty members by card, email, phone, or name to redeem points.',
      href: '/store/lookup',
      badge: null,
      color: 'bg-hos-bg-secondary',
      textColor: 'text-hos-text-secondary',
    },
    {
      title: 'Enroll walk-in',
      description: 'Join a customer to the Enchanted Circle at the till. Email and name are enough.',
      href: '/store/enroll',
      badge: null,
      color: 'bg-amber-900/20',
      textColor: 'text-amber-200',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2">
      <div>
        <h1 className="text-2xl font-semibold text-hos-text">
          Hi {firstName}
        </h1>
        <p className="text-sm text-hos-text-muted mt-1">
          What do you need to do?
        </p>
      </div>

      {/* Live counters */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href="/store/shipping/pending-queue"
          className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 text-center hover:border-amber-500/40 transition-colors"
        >
          <p className="text-2xl font-bold text-amber-400">{counts.pendingCustomers}</p>
          <p className="text-xs text-hos-text-muted mt-1">Waiting for details</p>
        </Link>
        <Link
          href="/store/shipping"
          className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 text-center hover:border-violet-500/40 transition-colors"
        >
          <p className="text-2xl font-bold text-violet-400">{counts.awaitingPayment}</p>
          <p className="text-xs text-hos-text-muted mt-1">Awaiting payment</p>
        </Link>
        <Link
          href="/store/shipping/backoffice"
          className="rounded-lg border border-hos-border bg-hos-bg-secondary p-4 text-center hover:border-emerald-500/40 transition-colors"
        >
          <p className="text-2xl font-bold text-emerald-400">{counts.packing}</p>
          <p className="text-xs text-hos-text-muted mt-1">In packing</p>
        </Link>
      </div>

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`rounded-lg border border-hos-border p-5 flex flex-col gap-2 transition-all hover:border-violet-500/40 hover:shadow-lg ${a.color}`}
          >
            <div className="flex items-center justify-between">
              <h2 className={`text-base font-semibold ${a.textColor}`}>{a.title}</h2>
              {a.badge ? (
                <span className="bg-red-500/20 text-red-300 text-xs px-2 py-0.5 rounded-full font-medium">
                  {a.badge}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-hos-text-muted leading-relaxed">{a.description}</p>
          </Link>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-hos-border bg-hos-bg-secondary p-5">
        <h2 className="text-sm font-semibold text-hos-text-secondary mb-3">How shipping works</h2>
        <ol className="text-sm text-hos-text-muted space-y-2 list-decimal list-inside">
          <li><strong className="text-hos-text-secondary">Ship a purchase</strong> — scan the receipt and create the shipping order. The customer gets an email.</li>
          <li><strong className="text-hos-text-secondary">Customer completes details</strong> — they register, add their address, and choose items to ship.</li>
          <li><strong className="text-hos-text-secondary">Quote the box</strong> — open the order, pick a box size, and finalize the charge.</li>
          <li><strong className="text-hos-text-secondary">Payment</strong> — confirm cash/card at the counter (or customer pays online).</li>
          <li><strong className="text-hos-text-secondary">Pack and ship</strong> — back office receives the order, verifies items, and generates the carrier label.</li>
        </ol>
      </div>
    </div>
  );
}
