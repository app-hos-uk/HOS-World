'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useMoney } from '@/hooks/useMoney';
import { getCurrencySymbol } from '@/lib/money';

type Settings = {
  defaultEarnRate: number;
  defaultRedeemValue: number;
  minRedemptionPoints: number;
  pointsExpiryMonths: number;
  cardPrefix: string;
  redemptionAtCheckout: boolean;
  posVoucherEnabled: boolean;
  posVoucherMinAmount: number;
  posVoucherMaxAmount: number;
  giftCardCatalogAmounts: string;
  giftCardDefaultCurrency: string;
  restoreBurnOnCancel: boolean;
  clawEarnOnCancel: boolean;
  restoreBurnOnReturn: boolean;
  clawEarnOnReturn: boolean;
};

function GateBadge({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-ui ${
        on ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'
      }`}
    >
      {label}: {on ? 'ON' : 'OFF'}
    </span>
  );
}

export default function AdminLoyaltySettingsPage() {
  const { formatMoney, currency } = useMoney();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState<'database' | 'env'>('env');
  const [form, setForm] = useState<Settings | null>(null);
  const [runtime, setRuntime] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsRes, runtimeRes] = await Promise.all([
        apiClient.adminGetLoyaltySettings(),
        apiClient.adminGetLoyaltyRuntimeStatus(),
      ]);
      const payload = settingsRes?.data as { settings: Settings; source: 'database' | 'env' };
      if (payload?.settings) {
        setForm(payload.settings);
        setSource(payload.source);
      }
      setRuntime(runtimeRes?.data ?? null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await apiClient.adminUpdateLoyaltySettings(form as unknown as Record<string, unknown>);
      toast.success('Loyalty settings saved');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-hos-text-primary">Loyalty Settings</h1>
        <p className="text-hos-text-secondary mt-1 font-ui text-sm">
          Business rules for The Enchanted Circle. HOS is the customer ledger system of record.
          Source: <span className="text-hos-gold">{source}</span>
        </p>
      </div>

      {runtime && (
        <div className="mb-6 p-4 rounded-lg border border-hos-border bg-hos-bg-secondary flex flex-wrap gap-2">
          <GateBadge on={!!runtime.loyaltyRuntimeEnabled} label="Loyalty runtime" />
          <GateBadge on={!!runtime.loyaltyEnv} label="LOYALTY_ENABLED" />
          <GateBadge on={!!runtime.loyaltyFlag} label="LOYALTY_PROGRAMME" />
          <GateBadge on={!!runtime.posRuntimeEnabled} label="POS runtime" />
          <GateBadge on={!!runtime.posEnv} label="POS_ENABLED" />
          <GateBadge on={!!runtime.posFlag} label="POS_INTEGRATION" />
          <GateBadge on={!!runtime.accountingEnv && !!runtime.accountingFlag} label="Xero export" />
        </div>
      )}

      {loading || !form ? (
        <p className="text-hos-text-secondary">Loading…</p>
      ) : (
        <div className="space-y-8 max-w-3xl">
          <section className="space-y-3 p-4 rounded-lg border border-hos-border bg-hos-bg-secondary">
            <h2 className="text-lg text-hos-gold font-display">Earning & redemption</h2>
            <label className="block text-sm text-hos-text-secondary font-ui">
              Default earn rate (pts per currency unit)
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                value={form.defaultEarnRate}
                onChange={(e) => set('defaultEarnRate', Number(e.target.value))}
              />
            </label>
            <label className="block text-sm text-hos-text-secondary font-ui">
              Redeem value ({getCurrencySymbol(currency)} per point)
              <input
                type="number"
                step="0.001"
                className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                value={form.defaultRedeemValue}
                onChange={(e) => set('defaultRedeemValue', Number(e.target.value))}
              />
            </label>
            <label className="block text-sm text-hos-text-secondary font-ui">
              Minimum redemption points
              <input
                type="number"
                className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                value={form.minRedemptionPoints}
                onChange={(e) => set('minRedemptionPoints', Number(e.target.value))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-hos-text-secondary font-ui">
              <input
                type="checkbox"
                checked={form.redemptionAtCheckout}
                onChange={(e) => set('redemptionAtCheckout', e.target.checked)}
              />
              Allow redemption at checkout
            </label>
          </section>

          <section className="space-y-3 p-4 rounded-lg border border-hos-border bg-hos-bg-secondary">
            <h2 className="text-lg text-hos-gold font-display">Expiry & card</h2>
            <label className="block text-sm text-hos-text-secondary font-ui">
              Points expiry (months, 0 = never)
              <input
                type="number"
                className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                value={form.pointsExpiryMonths}
                onChange={(e) => set('pointsExpiryMonths', Number(e.target.value))}
              />
            </label>
            <label className="block text-sm text-hos-text-secondary font-ui">
              Card prefix
              <input
                className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                value={form.cardPrefix}
                onChange={(e) => set('cardPrefix', e.target.value)}
              />
            </label>
          </section>

          <section className="space-y-3 p-4 rounded-lg border border-hos-border bg-hos-bg-secondary">
            <h2 className="text-lg text-hos-gold font-display">POS vouchers</h2>
            <label className="flex items-center gap-2 text-sm text-hos-text-secondary font-ui">
              <input
                type="checkbox"
                checked={form.posVoucherEnabled}
                onChange={(e) => set('posVoucherEnabled', e.target.checked)}
              />
              Enable POS points → Lightspeed gift card vouchers
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm text-hos-text-secondary font-ui">
                Min amount
                <input
                  type="number"
                  className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                  value={form.posVoucherMinAmount}
                  onChange={(e) => set('posVoucherMinAmount', Number(e.target.value))}
                />
              </label>
              <label className="block text-sm text-hos-text-secondary font-ui">
                Max amount
                <input
                  type="number"
                  className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                  value={form.posVoucherMaxAmount}
                  onChange={(e) => set('posVoucherMaxAmount', Number(e.target.value))}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3 p-4 rounded-lg border border-hos-border bg-hos-bg-secondary">
            <h2 className="text-lg text-hos-gold font-display">HOS gift cards</h2>
            <label className="block text-sm text-hos-text-secondary font-ui">
              Catalogue amounts (comma-separated)
              <input
                className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                value={form.giftCardCatalogAmounts}
                onChange={(e) => set('giftCardCatalogAmounts', e.target.value)}
              />
            </label>
            <label className="block text-sm text-hos-text-secondary font-ui">
              Default currency
              <input
                className="mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
                value={form.giftCardDefaultCurrency}
                onChange={(e) => set('giftCardDefaultCurrency', e.target.value.toUpperCase())}
              />
            </label>
          </section>

          <section className="space-y-3 p-4 rounded-lg border border-hos-border bg-hos-bg-secondary">
            <h2 className="text-lg text-hos-gold font-display">Returns policy</h2>
            <label className="flex items-center gap-2 text-sm text-hos-text-secondary font-ui">
              <input
                type="checkbox"
                checked={form.restoreBurnOnCancel}
                onChange={(e) => set('restoreBurnOnCancel', e.target.checked)}
              />
              Restore burned points on order cancel
            </label>
            <label className="flex items-center gap-2 text-sm text-hos-text-secondary font-ui">
              <input
                type="checkbox"
                checked={form.clawEarnOnCancel}
                onChange={(e) => set('clawEarnOnCancel', e.target.checked)}
              />
              Claw earned points on order cancel
            </label>
            <label className="flex items-center gap-2 text-sm text-hos-text-secondary font-ui">
              <input
                type="checkbox"
                checked={form.restoreBurnOnReturn}
                onChange={(e) => set('restoreBurnOnReturn', e.target.checked)}
              />
              Restore burned points on return refund (proportional)
            </label>
            <label className="flex items-center gap-2 text-sm text-hos-text-secondary font-ui">
              <input
                type="checkbox"
                checked={form.clawEarnOnReturn}
                onChange={(e) => set('clawEarnOnReturn', e.target.checked)}
              />
              Claw earned points on return refund (proportional)
            </label>
          </section>

          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="px-5 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg font-semibold font-ui disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}
    </RouteGuard>
  );
}
