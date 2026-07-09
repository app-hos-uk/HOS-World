'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
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
};

const FLAG_CATEGORIES: Record<string, string[]> = {
  'Core Commerce': ['GUEST_CHECKOUT', 'MULTI_CURRENCY', 'CLICK_COLLECT', 'DIGITAL_PRODUCTS'],
  'Loyalty & Members': ['LOYALTY_PROGRAMME', 'FOUNDING_MEMBERS', 'AMBASSADOR_PROGRAMME'],
  'Marketing & Partnerships': ['BRAND_PARTNERSHIPS', 'INFLUENCER_STOREFRONTS', 'AI_RECOMMENDATIONS'],
  'System': ['EMAIL_TEMPLATE_OVERRIDES', 'POS_INTEGRATION'],
};

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getFeatureFlags();
      setFlags(res.data || {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (flag: string, currentValue: boolean) => {
    setToggling(flag);
    setError(null);
    setSuccessMsg(null);
    try {
      await apiClient.setFeatureFlag(flag, !currentValue);
      setFlags((prev) => ({ ...prev, [flag]: !currentValue }));
      setSuccessMsg(`${flag} ${!currentValue ? 'enabled' : 'disabled'} successfully`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update feature flag');
    } finally {
      setToggling(null);
    }
  };

  const categorizedFlags = Object.entries(FLAG_CATEGORIES).map(([category, flagKeys]) => ({
    category,
    flags: flagKeys.filter((key) => key in flags),
  }));

  const uncategorized = Object.keys(flags).filter(
    (key) => !Object.values(FLAG_CATEGORIES).flat().includes(key),
  );

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Feature Flags</h1>
            <p className="mt-1 text-sm text-hos-text-muted">
              Toggle features on or off across the platform. Changes take effect immediately (in-memory, resets on server restart).
            </p>
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
                            </div>
                            <p className="text-xs text-hos-text-muted mt-0.5">
                              {FLAG_DESCRIPTIONS[flag] || 'No description available'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleToggle(flag, flags[flag])}
                            disabled={toggling === flag}
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
                          </div>
                          <p className="text-xs text-hos-text-muted mt-0.5">
                            {FLAG_DESCRIPTIONS[flag] || 'No description available'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggle(flag, flags[flag])}
                          disabled={toggling === flag}
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
              Feature flag changes are applied in-memory and take effect immediately. However, they will revert
              to their environment variable defaults on server restart. To make changes permanent, update the
              corresponding <code className="text-amber-300">FF_*</code> environment variables in your deployment configuration.
            </p>
          </div>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
