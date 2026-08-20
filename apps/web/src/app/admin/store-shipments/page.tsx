'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminStoreShipmentsPage() {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await apiClient.listAdminStoreShipments({
        status: status || undefined,
        limit: 50,
      });
      setItems(((r.data as any)?.items as any[]) || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Store shipments</h1>
      <div className="flex gap-2 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border rounded px-2 py-1 bg-hos-bg-secondary border-hos-border"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="PENDING_ENRICHMENT">PENDING_ENRICHMENT</option>
          <option value="QUOTED">QUOTED</option>
          <option value="LABEL_PURCHASED">LABEL_PURCHASED</option>
          <option value="BLOCKED">BLOCKED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
        <button type="button" onClick={load} className="text-sm text-violet-400 underline">
          Refresh
        </button>
      </div>
      {loading ? (
        <p className="text-hos-text-muted">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-hos-border text-left">
                <th className="py-2 pr-4">Invoice</th>
                <th className="py-2 pr-4">Store</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-hos-border/50">
                  <td className="py-2 pr-4">{row.invoiceNumber || '—'}</td>
                  <td className="py-2 pr-4">{row.store?.name || row.storeId}</td>
                  <td className="py-2 pr-4">{row.claimEmail || row.user?.email || '—'}</td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2 pr-4">{row.trackingCode || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
