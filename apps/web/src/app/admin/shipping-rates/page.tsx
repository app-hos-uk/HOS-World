'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DEFAULT_CURRENCY } from '@/lib/regionConfig';

type Tier = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  countryCodes: string[];
  isCatchAll: boolean;
  currency: string;
  isActive: boolean;
};

type Box = {
  id: string;
  name: string;
  label: string;
};

type Rate = {
  boxSizeId: string;
  tierId: string;
  customerPrice: number;
};

type Matrix = { tiers: Tier[]; boxes: Box[]; rates: Rate[] };

export default function AdminShippingRatesPage() {
  const toast = useToast();
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [tierDrafts, setTierDrafts] = useState<
    Record<string, { name: string; description: string; countryCodes: string; currency: string }>
  >({});
  const [saving, setSaving] = useState(false);

  const keyFor = (boxId: string, tierId: string) => `${boxId}:${tierId}`;

  const load = async () => {
    try {
      const r = await apiClient.getAdminShippingRateMatrix();
      const data = r.data as Matrix;
      setMatrix(data);
      const next: Record<string, string> = {};
      for (const rate of data.rates || []) {
        next[keyFor(rate.boxSizeId, rate.tierId)] = String(rate.customerPrice);
      }
      setPrices(next);
      const drafts: Record<
        string,
        { name: string; description: string; countryCodes: string; currency: string }
      > = {};
      for (const t of data.tiers || []) {
        drafts[t.id] = {
          name: t.name,
          description: t.description || '',
          countryCodes: t.isCatchAll ? 'All other countries' : (t.countryCodes || []).join(', '),
          currency: t.currency || DEFAULT_CURRENCY,
        };
      }
      setTierDrafts(drafts);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load shipping rates');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const preview = useMemo(() => {
    if (!matrix) return [];
    return matrix.boxes.map((box) => ({
      box,
      values: matrix.tiers.map((tier) => prices[keyFor(box.id, tier.id)] || '0'),
    }));
  }, [matrix, prices]);

  const saveMatrix = async () => {
    if (!matrix) return;
    setSaving(true);
    try {
      const rates = matrix.boxes.flatMap((box) =>
        matrix.tiers.map((tier) => ({
          boxSizeId: box.id,
          tierId: tier.id,
          customerPrice: Number(prices[keyFor(box.id, tier.id)] || 0),
        })),
      );
      await apiClient.saveAdminShippingRateMatrix(rates);
      toast.success('Fixed shipping rates saved');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!matrix) return <p className="p-6 text-hos-text-muted">Loading rate matrix…</p>;

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Fixed shipping rates</h1>
        <p className="text-sm text-hos-text-muted mt-1">
          Customer shipping is a fixed House of Spells charge by box size and destination — not live
          UPS/FedEx/DHL rates. Carrier cost stays internal. Edit which countries sit in each tier,
          then set the prices in the matrix.{' '}
          <Link href="/admin/box-sizes" className="text-violet-400 underline">
            Manage box dimensions
          </Link>
        </p>
      </div>

      <section className="grid md:grid-cols-2 gap-4">
        {matrix.tiers.map((tier) => {
          const draft = tierDrafts[tier.id] || {
            name: tier.name,
            description: '',
            countryCodes: '',
            currency: tier.currency,
          };
          return (
            <div key={tier.id} className="rounded border border-hos-border p-4 bg-hos-bg-secondary space-y-2">
              <p className="text-xs text-hos-text-muted">{tier.code}</p>
              <input
                className="w-full border rounded px-2 py-1 bg-hos-bg border-hos-border font-medium"
                value={draft.name}
                onChange={(e) =>
                  setTierDrafts((d) => ({ ...d, [tier.id]: { ...draft, name: e.target.value } }))
                }
              />
              <textarea
                className="w-full border rounded px-2 py-1 bg-hos-bg border-hos-border text-sm"
                rows={2}
                value={draft.description}
                onChange={(e) =>
                  setTierDrafts((d) => ({ ...d, [tier.id]: { ...draft, description: e.target.value } }))
                }
              />
              <label className="block text-xs text-hos-text-muted">
                ISO country codes{tier.isCatchAll ? ' (catch-all; ignored)' : ''}
                <input
                  className="mt-1 w-full border rounded px-2 py-1 bg-hos-bg border-hos-border font-mono text-sm"
                  value={draft.countryCodes}
                  disabled={tier.isCatchAll}
                  onChange={(e) =>
                    setTierDrafts((d) => ({
                      ...d,
                      [tier.id]: { ...draft, countryCodes: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="block text-xs text-hos-text-muted">
                Currency
                <input
                  className="mt-1 w-24 border rounded px-2 py-1 bg-hos-bg border-hos-border font-mono text-sm uppercase"
                  maxLength={3}
                  value={draft.currency}
                  onChange={(e) =>
                    setTierDrafts((d) => ({
                      ...d,
                      [tier.id]: { ...draft, currency: e.target.value.toUpperCase() },
                    }))
                  }
                />
              </label>
              <button
                type="button"
                className="text-sm text-violet-400 underline"
                onClick={async () => {
                  try {
                    await apiClient.updateAdminShippingTier(tier.id, {
                      name: draft.name,
                      description: draft.description,
                      currency: draft.currency,
                      countryCodes: tier.isCatchAll
                        ? []
                        : draft.countryCodes
                            .split(/[\s,]+/)
                            .map((c) => c.trim().toUpperCase())
                            .filter(Boolean),
                    });
                    toast.success('Tier updated');
                    load();
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : 'Tier save failed');
                  }
                }}
              >
                Save tier
              </button>
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Price matrix (customer charge)</h2>
          <button
            type="button"
            disabled={saving}
            onClick={saveMatrix}
            className="px-4 py-2 rounded bg-violet-600 text-white text-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save rates'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-hos-border text-left">
                <th className="py-2 pr-3">Box size</th>
                {matrix.tiers.map((tier) => (
                  <th key={tier.id} className="py-2 pr-3 min-w-[140px]">
                    {tier.name.replace(/^Tier \d+ — /, '')}
                    <span className="block text-xs font-normal text-hos-text-muted">{tier.currency}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map(({ box, values }) => (
                <tr key={box.id} className="border-b border-hos-border/50">
                  <td className="py-2 pr-3 font-medium">
                    {box.label}
                    <span className="block text-xs text-hos-text-muted">{box.name}</span>
                  </td>
                  {matrix.tiers.map((tier, i) => (
                    <td key={tier.id} className="py-2 pr-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-28 border rounded px-2 py-1 bg-hos-bg border-hos-border tabular-nums"
                        value={values[i]}
                        onChange={(e) =>
                          setPrices((p) => ({ ...p, [keyFor(box.id, tier.id)]: e.target.value }))
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-hos-text-muted">
          CUSTOM is staff-overridable at the counter. Starter prices are placeholders — replace them
          with the House of Spells charges you want to collect. Destination country on the customer
          address picks the tier (US/PR → 1, CA/MX → 2, Western Europe & UK → 3, everywhere else → 4).
        </p>
      </section>
    </div>
  );
}
