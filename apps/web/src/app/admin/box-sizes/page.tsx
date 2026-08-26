'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type Box = {
  id: string;
  name: string;
  label: string;
  lengthCm: string | number;
  widthCm: string | number;
  heightCm: string | number;
  customerPrice: string | number;
  packagingCost: string | number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
};

const empty = {
  name: 'SMALL',
  label: '',
  lengthCm: '20',
  widthCm: '15',
  heightCm: '10',
  customerPrice: '9.99',
  packagingCost: '1.00',
  currency: 'USD',
  sortOrder: '1',
};

export default function AdminBoxSizesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Box[]>([]);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try {
      const r = await apiClient.listAdminBoxSizes({ includeInactive: true });
      setRows((r.data as Box[]) || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Box sizes</h1>
        <p className="text-sm text-hos-text-muted mt-1">
          Dimensions and internal packaging cost for each box. Customer shipping prices are set by
          destination tier on{' '}
          <a href="/admin/shipping-rates" className="text-violet-400 underline">
            Fixed shipping rates
          </a>
          .
        </p>
      </div>
      <form
        className="grid grid-cols-2 md:grid-cols-4 gap-2 border border-hos-border rounded p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await apiClient.createAdminBoxSize({
              name: form.name,
              label: form.label,
              lengthCm: Number(form.lengthCm),
              widthCm: Number(form.widthCm),
              heightCm: Number(form.heightCm),
              customerPrice: Number(form.customerPrice),
              packagingCost: Number(form.packagingCost),
              currency: form.currency,
              sortOrder: Number(form.sortOrder),
            });
            toast.success('Box size created');
            setForm(empty);
            load();
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Create failed');
          }
        }}
      >
        <input className="border rounded px-2 py-1 bg-hos-bg-secondary border-hos-border" placeholder="Name (SMALL)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="border rounded px-2 py-1 bg-hos-bg-secondary border-hos-border" placeholder="Label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required />
        <input className="border rounded px-2 py-1 bg-hos-bg-secondary border-hos-border" placeholder="L cm" value={form.lengthCm} onChange={(e) => setForm({ ...form, lengthCm: e.target.value })} />
        <input className="border rounded px-2 py-1 bg-hos-bg-secondary border-hos-border" placeholder="W cm" value={form.widthCm} onChange={(e) => setForm({ ...form, widthCm: e.target.value })} />
        <input className="border rounded px-2 py-1 bg-hos-bg-secondary border-hos-border" placeholder="H cm" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
        <input className="border rounded px-2 py-1 bg-hos-bg-secondary border-hos-border" placeholder="Fallback price" value={form.customerPrice} onChange={(e) => setForm({ ...form, customerPrice: e.target.value })} title="Used only if a destination-tier rate is missing" />
        <input className="border rounded px-2 py-1 bg-hos-bg-secondary border-hos-border" placeholder="Packaging cost" value={form.packagingCost} onChange={(e) => setForm({ ...form, packagingCost: e.target.value })} />
        <button type="submit" className="rounded bg-violet-600 text-white px-3 py-1">Add</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-hos-border">
              <th className="py-2">Label</th>
              <th>Size</th>
              <th>Fallback</th>
              <th>Packaging</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-hos-border/50">
                <td className="py-2">{row.label} ({row.name})</td>
                <td>
                  {Number(row.lengthCm)}×{Number(row.widthCm)}×{Number(row.heightCm)} cm
                </td>
                <td>
                  {row.currency} {Number(row.customerPrice).toFixed(2)}
                </td>
                <td>{Number(row.packagingCost).toFixed(2)}</td>
                <td>
                  <button
                    type="button"
                    className="underline text-violet-400"
                    onClick={async () => {
                      await apiClient.updateAdminBoxSize(row.id, { isActive: !row.isActive });
                      load();
                    }}
                  >
                    {row.isActive ? 'On' : 'Off'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
