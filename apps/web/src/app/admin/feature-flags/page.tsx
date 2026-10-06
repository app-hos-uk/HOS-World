'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';

const FLAG_DESCRIPTIONS: Record<string, string> = {
  FOUNDING_MEMBERS: 'Enable founding member registration on the public landing page',
  EMAIL_TEMPLATE_OVERRIDES: 'Allow custom email template overrides per brand',
  LOYALTY_PROGRAMME: 'Enable The Enchanted Circle loyalty programme',
  AMBASSADOR_PROGRAMME: 'Enable the ambassador programme features',
  BRAND_PARTNERSHIPS: 'Enable brand partnership management tools',
  CLICK_COLLECT: 'Enable click & collect for physical stores',
  DIGITAL_PRODUCTS: 'Enable digital product listings and delivery',
  INFLUENCER_STOREFRONTS: 'Enable influencer storefronts and affiliate links',
  GUEST_CHECKOUT: 'Allow guest checkout without account creation',
  AI_RECOMMENDATIONS: 'Enable AI-powered product recommendations',
  POS_INTEGRATION: 'Enable point-of-sale system integration',
  MULTI_CURRENCY: 'Enable multi-currency support for international customers',
  ACCOUNTING_XERO: 'Enable Xero accounting integration (daily journals, ledger outbox)',
  SHIPPING_ONLINE_PAYMENT:
    'Enable online card payment for in-store shipping (Stripe). When off, staff confirm cash or standalone-machine card at the counter before printing the slip.',
  MARKETPLACE_OWNED_CATALOG:
    'Marketplace-owned catalog. Products created through publish become platform-owned.',
  MULTI_VENDOR_OFFERS:
    'Multiple vendor offers per product. Cart and checkout use vendor price/stock instead of product-level fields.',
  ANCHOR_STORE_GATING:
    'Restrict POS loyalty earn and ship-from-store to anchor stores only.',
  POS_PRODUCT_PUSH:
    'Push products to Lightspeed POS. Turn off to stop all Lightspeed product and online-order stock writes.',
  MARKET_CATALOG:
    'Filter product listings by market. When on, the shop uses x-market-code to show only market-visible products.',
};

const FLAG_DEPENDENCIES: Record<string, { requires?: string; warning?: string }> = {
  MARKETPLACE_OWNED_CATALOG: {
    requires: 'MULTI_VENDOR_OFFERS',
    warning: 'Requires MULTI_VENDOR_OFFERS to be enabled first',
  },
  ANCHOR_STORE_GATING: {
    warning: 'Mark HOS outlets as anchor stores before enabling',
  },
};

const FLAG_CATEGORIES: Record<string, string[]> = {
  'Core Commerce': ['GUEST_CHECKOUT', 'MULTI_CURRENCY', 'CLICK_COLLECT', 'DIGITAL_PRODUCTS'],
  'Loyalty & Members': ['LOYALTY_PROGRAMME', 'FOUNDING_MEMBERS', 'AMBASSADOR_PROGRAMME'],
  'Marketing & Partnerships': ['BRAND_PARTNERSHIPS', 'INFLUENCER_STOREFRONTS', 'AI_RECOMMENDATIONS'],
  System: ['EMAIL_TEMPLATE_OVERRIDES', 'POS_INTEGRATION', 'ACCOUNTING_XERO', 'SHIPPING_ONLINE_PAYMENT'],
  'Multi-Country & Marketplace': [
    'MARKETPLACE_OWNED_CATALOG',
    'MULTI_VENDOR_OFFERS',
    'POS_PRODUCT_PUSH',
    'ANCHOR_STORE_GATING',
    'MARKET_CATALOG',
  ],
};

type MarketOption = { id: string; code: string; name: string; isActive?: boolean };

function isMarketFlagView(
  data: unknown,
): data is { flags: Record<string, boolean>; global: Record<string, boolean>; overrides: Record<string, boolean> } {
  if (!data || typeof data !== 'object') return false;
  const view = data as { flags?: unknown; global?: unknown; overrides?: unknown };
  return !!view.flags && typeof view.flags === 'object' && !!view.overrides && typeof view.overrides === 'object';
}

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [globalFlags, setGlobalFlags] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [markets, setMarkets] = useState<MarketOption[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState('');
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.listAdminMarkets()
      .then((res) => {
        if (cancelled) return;
        setMarkets(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setMarkets([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getFeatureFlags(selectedMarketId || undefined);
      if (selectedMarketId && isMarketFlagView(res.data)) {
        setFlags(res.data.flags || {});
        setGlobalFlags(res.data.global || {});
        setOverrides(res.data.overrides || {});
      } else {
        const flat = (res.data && !isMarketFlagView(res.data) ? res.data : {}) as Record<string, boolean>;
        setFlags(flat);
        setGlobalFlags(flat);
        setOverrides({});
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, [selectedMarketId]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (flag: string, currentValue: boolean) => {
    setToggling(flag);
    setError(null);
    setSuccessMsg(null);
    const next = !currentValue;
    try {
      const res = await apiClient.setFeatureFlag(flag, next, selectedMarketId || undefined);
      setFlags((prev) => ({ ...prev, [flag]: next }));
      if (selectedMarketId) {
        setOverrides((prev) => ({ ...prev, [flag]: next }));
      } else {
        setGlobalFlags((prev) => ({ ...prev, [flag]: next }));
      }
      // Server message distinguishes a persisted toggle from an in-memory-only
      // fallback when the DB write fails.
      setSuccessMsg(res?.message || `${flag} ${next ? 'enabled' : 'disabled'} successfully`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update feature flag');
    } finally {
      setToggling(null);
    }
  };

  const selectedMarket = markets.find((market) => market.id === selectedMarketId);

  const categorizedFlags = Object.entries(FLAG_CATEGORIES).map(([category, flagKeys]) => ({
    category,
    flags: flagKeys.filter((key) => key in flags),
  }));

  const uncategorized = Object.keys(flags).filter(
    (key) => !Object.values(FLAG_CATEGORIES).flat().includes(key),
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']} requiredPermissions={['settings.view']} showAccessDenied>
              <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Feature Flags</h1>
            <p className="mt-1 text-sm text-hos-text-muted">
              {selectedMarket
                ? `Overrides for ${selectedMarket.name} (${selectedMarket.code}). Flags without an override keep the global default.`
                : 'Toggle features on or off across the platform. Changes take effect immediately and are saved to the database.'}
            </p>
          </div>

          <div className="max-w-xs">
            <label htmlFor="feature-flag-market" className="block text-xs font-medium text-hos-text-muted mb-1">
              Market
            </label>
            <select
              id="feature-flag-market"
              value={selectedMarketId}
              onChange={(e) => setSelectedMarketId(e.target.value)}
              className="w-full rounded-lg border border-hos-border bg-hos-bg-secondary px-3 py-2 text-sm text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
            >
              <option value="">Global defaults</option>
              {markets.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.name} ({market.code}){market.isActive === false ? ' — inactive' : ''}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">{error}</div>
          )}

          {successMsg && (
            <div className="rounded-md bg-green-500/10 border border-green-500/20 p-4 text-sm text-green-400">{successMsg}</div>
          )}

          {loading ? (
            <div className="p-8 text-center text-hos-text-muted">Loading feature flags...</div>
          ) : (
            <div className="space-y-8">
              {categorizedFlags.map(({ category, flags: categoryFlags }) =>
                categoryFlags.length > 0 ? (
                  <div key={category}>
                    <h2 className="text-lg font-semibold text-hos-text-secondary mb-3">{category}</h2>
                    <div className="rounded-xl border border-hos-border bg-hos-bg-secondary divide-y divide-hos-border">
                      {categoryFlags.map((flag) => (
                        <div key={flag} className="flex items-center justify-between px-5 py-4">
                          <div className="flex-1 min-w-0 mr-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium text-hos-text-secondary">{flag}</span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  flags[flag]
                                    ? 'bg-green-500/15 text-green-300'
                                    : 'bg-red-500/15 text-red-300'
                                }`}
                              >
                                {flags[flag] ? 'ON' : 'OFF'}
                              </span>
                              {selectedMarketId && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    flag in overrides
                                      ? 'bg-hos-gold/15 text-hos-gold'
                                      : 'bg-hos-border text-hos-text-muted'
                                  }`}
                                >
                                  {flag in overrides ? 'Override' : 'Global'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-hos-text-muted mt-0.5">
                              {FLAG_DESCRIPTIONS[flag] || 'No description available'}
                            </p>
                            {selectedMarketId && (
                              <p className="text-[11px] text-hos-text-muted mt-0.5">
                                {flag in overrides
                                  ? `Market override. Global default is ${globalFlags[flag] ? 'ON' : 'OFF'}.`
                                  : `Using the global default (${globalFlags[flag] ? 'ON' : 'OFF'}).`}
                              </p>
                            )}
                            {FLAG_DEPENDENCIES[flag]?.warning && (
                              <p className="text-[11px] text-amber-500/80 mt-0.5 flex items-center gap-1">
                                <span>⚠</span> {FLAG_DEPENDENCIES[flag].warning}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggle(flag, flags[flag])}
                            disabled={toggling === flag || (FLAG_DEPENDENCIES[flag]?.requires && !flags[FLAG_DEPENDENCIES[flag].requires!])}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hos-gold/50 focus:ring-offset-2 focus:ring-offset-hos-bg-secondary disabled:opacity-50 ${
                              flags[flag] ? 'bg-hos-gold' : 'bg-hos-border'
                            }`}
                            role="switch"
                            aria-checked={flags[flag]}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                flags[flag] ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null,
              )}

              {uncategorized.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-hos-text-secondary mb-3">Other</h2>
                  <div className="rounded-xl border border-hos-border bg-hos-bg-secondary divide-y divide-hos-border">
                    {uncategorized.map((flag) => (
                      <div key={flag} className="flex items-center justify-between px-5 py-4">
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-hos-text-secondary">{flag}</span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                flags[flag]
                                  ? 'bg-green-500/15 text-green-300'
                                  : 'bg-red-500/15 text-red-300'
                              }`}
                            >
                              {flags[flag] ? 'ON' : 'OFF'}
                            </span>
                            {selectedMarketId && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  flag in overrides
                                    ? 'bg-hos-gold/15 text-hos-gold'
                                    : 'bg-hos-border text-hos-text-muted'
                                }`}
                              >
                                {flag in overrides ? 'Override' : 'Global'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-hos-text-muted mt-0.5">
                            {FLAG_DESCRIPTIONS[flag] || 'No description available'}
                          </p>
                          {selectedMarketId && (
                            <p className="text-[11px] text-hos-text-muted mt-0.5">
                              {flag in overrides
                                ? `Market override. Global default is ${globalFlags[flag] ? 'ON' : 'OFF'}.`
                                : `Using the global default (${globalFlags[flag] ? 'ON' : 'OFF'}).`}
                            </p>
                          )}
                          {FLAG_DEPENDENCIES[flag]?.warning && (
                            <p className="text-[11px] text-amber-500/80 mt-0.5 flex items-center gap-1">
                              <span>⚠</span> {FLAG_DEPENDENCIES[flag].warning}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggle(flag, flags[flag])}
                          disabled={toggling === flag || (FLAG_DEPENDENCIES[flag]?.requires && !flags[FLAG_DEPENDENCIES[flag].requires!])}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-hos-gold/50 focus:ring-offset-2 focus:ring-offset-hos-bg-secondary disabled:opacity-50 ${
                            flags[flag] ? 'bg-hos-gold' : 'bg-hos-border'
                          }`}
                          role="switch"
                          aria-checked={flags[flag]}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              flags[flag] ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <h3 className="text-sm font-semibold text-amber-300">Important</h3>
            <p className="text-xs text-amber-200/70 mt-1">
              Changes take effect immediately and are saved to the database, where they override the
              corresponding <code className="text-amber-300">FF_*</code> environment variable on restart.
              A selected market stores an override for that market only; other markets keep the global default.
              If a save fails, the banner above will say <em>in-memory only</em> — that change will be lost on restart.
            </p>
            <p className="text-xs text-amber-200/70 mt-2">
              Some integrations need a deploy-time environment variable as well as a flag:
              POS also requires <code className="text-amber-300">POS_ENABLED=true</code>, and Xero also requires{' '}
              <code className="text-amber-300">ACCOUNTING_ENABLED=true</code>. Turning the flag on alone will not start them.
            </p>
          </div>
        </div>
          </RouteGuard>
  );
}
