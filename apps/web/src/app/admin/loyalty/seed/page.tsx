'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';

interface SeedResult {
  tiers: { created: number; updated: number };
  earnRules: { created: number; updated: number };
  redemptionOptions: { created: number; skipped: number };
}

export default function AdminLoyaltySeedPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = async () => {
    if (!confirm(
      'This will create or update all loyalty tiers (6), earn rules (14), and redemption options (8). ' +
      'Existing data will be updated, not duplicated. Proceed?'
    )) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiClient.seedLoyaltyData();
      setResult(res.data as SeedResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6 max-w-2xl">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Seed Loyalty Data</h1>
            <p className="mt-1 text-sm text-hos-text-muted">
              Populate or refresh the loyalty programme with the standard tier structure, earn rules, and redemption options.
            </p>
          </div>

          <div className="rounded-xl border border-hos-border bg-hos-bg-secondary p-6 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-hos-text-secondary">What will be seeded</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-hos-border p-4">
                  <div className="text-2xl font-bold text-hos-gold">6</div>
                  <div className="text-sm text-hos-text-muted mt-1">Loyalty Tiers</div>
                  <p className="text-xs text-hos-text-muted mt-2">
                    Initiate, Spellcaster, Enchanter, Dragon Keeper, Archmage Circle, Council of Realms
                  </p>
                </div>
                <div className="rounded-lg border border-hos-border p-4">
                  <div className="text-2xl font-bold text-hos-gold">14</div>
                  <div className="text-sm text-hos-text-muted mt-1">Earn Rules</div>
                  <p className="text-xs text-hos-text-muted mt-2">
                    Purchase, Signup, Review, Referral, Birthday, Quiz, Events, and more
                  </p>
                </div>
                <div className="rounded-lg border border-hos-border p-4">
                  <div className="text-2xl font-bold text-hos-gold">8</div>
                  <div className="text-sm text-hos-text-muted mt-1">Redemption Options</div>
                  <p className="text-xs text-hos-text-muted mt-2">
                    Discounts, Free Shipping, Gift Cards, Raffle Entry, Charity, Early Access
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-200/70">
                This operation is safe to run multiple times. Existing tiers and earn rules will be updated (not duplicated).
                Redemption options are only created if they don&apos;t already exist.
              </p>
            </div>

            <button
              onClick={handleSeed}
              disabled={loading}
              className="px-5 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-semibold hover:bg-hos-gold-hover disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Seeding...
                </>
              ) : (
                'Seed Loyalty Data'
              )}
            </button>
          </div>

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">{error}</div>
          )}

          {result && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-green-300">Seed completed successfully</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="text-sm">
                  <span className="text-hos-text-muted">Tiers:</span>{' '}
                  <span className="text-green-300">{result.tiers.created} created</span>,{' '}
                  <span className="text-hos-text-secondary">{result.tiers.updated} updated</span>
                </div>
                <div className="text-sm">
                  <span className="text-hos-text-muted">Earn Rules:</span>{' '}
                  <span className="text-green-300">{result.earnRules.created} created</span>,{' '}
                  <span className="text-hos-text-secondary">{result.earnRules.updated} updated</span>
                </div>
                <div className="text-sm">
                  <span className="text-hos-text-muted">Redemption:</span>{' '}
                  <span className="text-green-300">{result.redemptionOptions.created} created</span>,{' '}
                  <span className="text-hos-text-secondary">{result.redemptionOptions.skipped} skipped</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
