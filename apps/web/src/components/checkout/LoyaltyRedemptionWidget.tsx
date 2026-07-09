'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useToast } from '@/hooks/useToast';

interface LoyaltyRedemptionWidgetProps {
  cart: any;
  onCartUpdate: (cart: any) => void;
}

interface Membership {
  currentBalance: number;
  tier?: { name: string };
}

interface RedemptionOption {
  id: string;
  name: string;
  description?: string;
  pointsCost: number;
  value?: number;
  type?: string;
}

export function LoyaltyRedemptionWidget({ cart, onCartUpdate }: LoyaltyRedemptionWidgetProps) {
  const { formatPrice } = useCurrency();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [options, setOptions] = useState<RedemptionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const loyaltyApplied = (cart?.pendingLoyaltyPoints ?? 0) > 0;
  const loyaltyDiscount = cart?.loyaltyDiscountAmount ?? 0;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [membershipRes, optionsRes] = await Promise.all([
          apiClient.getLoyaltyMembership(),
          apiClient.getRedemptionOptions(),
        ]);

        if (cancelled) return;

        const m = membershipRes?.data as Membership | null;
        if (!m) {
          setMembership(null);
          return;
        }

        setMembership(m);
        setOptions(Array.isArray(optionsRes?.data) ? (optionsRes.data as RedemptionOption[]) : []);
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message || 'Failed to load loyalty rewards';
        const notEnrolled =
          msg.toLowerCase().includes('not found') ||
          msg.toLowerCase().includes('not enrolled') ||
          msg.toLowerCase().includes('enroll');
        const loyaltyDisabled =
          msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('not enabled');
        if (!notEnrolled && !loyaltyDisabled) {
          setError(msg);
        }
        setMembership(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApply = async (optionId: string) => {
    try {
      setApplying(optionId);
      const response = await apiClient.applyCartLoyaltyReward(optionId);
      if (response?.data) {
        onCartUpdate(response.data);
        toast.success('Loyalty reward applied!');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to apply reward');
    } finally {
      setApplying(null);
    }
  };

  const handleRemove = async () => {
    try {
      setRemoving(true);
      const response = await apiClient.removeCartLoyaltyReward();
      if (response?.data) {
        onCartUpdate(response.data);
        toast.success('Loyalty reward removed');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to remove reward');
    } finally {
      setRemoving(false);
    }
  };

  const formatOptionValue = (opt: RedemptionOption): string | null => {
    if (opt.value == null) return null;
    if (opt.type === 'DISCOUNT' || typeof opt.value === 'number') {
      return formatPrice(opt.value);
    }
    return String(opt.value);
  };

  if (loading) {
    return (
      <section
        aria-label="Loyalty Rewards"
        className="bg-hos-bg-secondary rounded-lg shadow-sm border border-hos-border p-4 sm:p-6"
      >
        <p className="text-sm text-hos-text-muted">Loading loyalty rewards…</p>
      </section>
    );
  }

  if (!membership) return null;

  const appliedOption = loyaltyApplied
    ? options.find((o) => o.id === cart.pendingLoyaltyOptionId)
    : null;

  const canAfford = (pointsCost: number) => membership.currentBalance >= pointsCost;

  return (
    <section
      aria-label="Loyalty Rewards"
      className="bg-hos-bg-secondary rounded-lg shadow-sm border border-purple-500/20 p-4 sm:p-6"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg" aria-hidden>
            ✨
          </span>
          <div>
            <h2 className="text-lg font-semibold text-hos-text-primary">Enchanted Circle Rewards</h2>
            <p className="text-xs text-hos-text-muted">
              {membership.currentBalance.toLocaleString()} pts · {membership.tier?.name || 'Member'}
            </p>
          </div>
        </div>
        <span className="text-hos-text-muted text-sm" aria-hidden>
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 border-t border-hos-border pt-4 space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <p className="text-xs text-hos-text-muted uppercase tracking-wide">Balance</p>
              <p className="font-semibold text-hos-gold">{membership.currentBalance.toLocaleString()} pts</p>
            </div>
            <div>
              <p className="text-xs text-hos-text-muted uppercase tracking-wide">Tier</p>
              <p className="font-semibold text-purple-300">{membership.tier?.name || 'Member'}</p>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {loyaltyApplied && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-purple-300 uppercase tracking-wide mb-1">Applied reward</p>
                  <p className="font-medium text-hos-text-primary">
                    {appliedOption?.name || 'Loyalty discount'}
                  </p>
                  <p className="text-sm text-hos-text-secondary mt-0.5">
                    {cart.pendingLoyaltyPoints?.toLocaleString()} pts
                    {loyaltyDiscount > 0 && (
                      <span className="text-green-400"> · −{formatPrice(loyaltyDiscount)}</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="px-3 py-1.5 text-sm border border-hos-border rounded-lg text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-50"
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          )}

          {!loyaltyApplied && (
            <>
              {options.length === 0 ? (
                <p className="text-sm text-hos-text-muted">No redemption options available right now.</p>
              ) : (
                <ul className="space-y-3">
                  {options.map((opt) => {
                    const valueLabel = formatOptionValue(opt);
                    const affordable = canAfford(opt.pointsCost);
                    const isApplying = applying === opt.id;

                    return (
                      <li
                        key={opt.id}
                        className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border ${
                          affordable ? 'border-hos-border hover:bg-hos-bg-tertiary/50' : 'border-hos-border opacity-60'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-hos-text-primary">{opt.name}</p>
                          {opt.description && (
                            <p className="text-xs text-hos-text-muted mt-0.5">{opt.description}</p>
                          )}
                          <p className="text-sm text-hos-text-secondary mt-1">
                            {opt.pointsCost.toLocaleString()} pts
                            {valueLabel && (
                              <span className="text-hos-gold"> · {valueLabel} off</span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApply(opt.id)}
                          disabled={!affordable || isApplying || applying !== null}
                          className="px-4 py-2 text-sm bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isApplying ? 'Applying…' : affordable ? 'Apply' : 'Not enough pts'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
