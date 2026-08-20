'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminSkuCustomsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, any>>({});

  const load = async () => {
    try {
      const r = await apiClient.listPendingSkuCustoms();
      setRows((r.data as any[]) || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Load failed');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (id: string) => {
    const body = drafts[id] || {};
    const { restrictedCountries, ...rest } = body;
    try {
      await apiClient.updateSkuCustoms(id, {
        ...rest,
        ...(restrictedCountries ? { restrictedCountries } : {}),
      });
      toast.success('SKU updated');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">SKU customs enrichment</h1>
      <p className="text-sm text-hos-text-muted">
        Complete HS codes and origin before international store shipments can quote.
      </p>
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.id} className="border border-hos-border rounded p-4 space-y-2">
            <p className="font-mono font-medium">{row.sku}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(['hsCode', 'countryOfOrigin', 'weightKg', 'lengthCm', 'widthCm', 'heightCm'] as const).map(
                (field) => (
                  <input
                    key={field}
                    placeholder={field}
                    className="border rounded px-2 py-1 text-sm bg-hos-bg-secondary border-hos-border"
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [row.id]: {
                          ...d[row.id],
                          [field]: field.includes('Kg') || field.includes('Cm')
                            ? Number(e.target.value)
                            : e.target.value,
                        },
                      }))
                    }
                  />
                ),
              )}
              <input
                placeholder="restrictedCountries (comma ISO codes)"
                className="border rounded px-2 py-1 text-sm bg-hos-bg-secondary border-hos-border col-span-full"
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [row.id]: {
                      ...d[row.id],
                      restrictedCountries: e.target.value
                        .split(',')
                        .map((c) => c.trim())
                        .filter(Boolean),
                    },
                  }))
                }
              />
            </div>
            <button
              type="button"
              onClick={() => save(row.id)}
              className="text-sm px-3 py-1 rounded bg-violet-600 text-white"
            >
              Mark ready
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-hos-text-muted">No pending SKUs</p>}
      </div>
    </div>
  );
}
