'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import type { AccessControlMe } from '@hos-marketplace/shared-types';

type Mode = 'legacy' | 'shadow' | 'enforce';

const MODES: { value: Mode; label: string; desc: string; color: string }[] = [
  {
    value: 'legacy',
    label: 'Legacy',
    desc: 'Only @Roles + PermissionsGuard decide. The new policy engine is inactive.',
    color: 'bg-gray-500/20 text-gray-400',
  },
  {
    value: 'shadow',
    label: 'Shadow',
    desc: 'Legacy decides access, but the policy engine evaluates in parallel and logs divergences.',
    color: 'bg-amber-500/20 text-amber-400',
  },
  {
    value: 'enforce',
    label: 'Enforce',
    desc: 'The policy engine decides for routes with @RequireAccess. Legacy-only routes still use @Roles.',
    color: 'bg-green-500/20 text-green-400',
  },
];

export default function AccessControlDashboard() {
  const [me, setMe] = useState<AccessControlMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getAccessControlMe();
        setMe(res?.data || null);
      } catch {
        toast.error('Failed to load access control state');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Access Control</h1>
        <p className="text-hos-text-secondary mt-2">
          Hybrid RBAC + ABAC rollout dashboard. Configure via environment variables.
        </p>
      </div>

      {/* Rollout Mode Reference */}
      <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 mb-6">
        <h2 className="font-semibold mb-4">Rollout Mode Reference</h2>
        <p className="text-sm text-hos-text-muted mb-4">
          Set <code className="px-1 py-0.5 bg-hos-bg-tertiary rounded text-xs">ACCESS_CONTROL_MODE</code> environment variable to control the global behavior.
          Per-module overrides: <code className="px-1 py-0.5 bg-hos-bg-tertiary rounded text-xs">ACCESS_CONTROL_MODULE_MODES=orders:shadow,finance:enforce</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODES.map((m) => (
            <div key={m.value} className="border border-hos-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 text-xs rounded font-mono ${m.color}`}>{m.value}</span>
                <span className="font-medium">{m.label}</span>
              </div>
              <p className="text-sm text-hos-text-muted">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Data Scoping */}
      <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 mb-6">
        <h2 className="font-semibold mb-3">Data Scoping</h2>
        <p className="text-sm text-hos-text-muted mb-2">
          Set <code className="px-1 py-0.5 bg-hos-bg-tertiary rounded text-xs">ACCESS_CONTROL_DATA_SCOPE</code> to control Prisma market-scoping.
          When set to <code className="px-1 py-0.5 bg-hos-bg-tertiary rounded text-xs">enforce</code>, all queries on market-scoped
          models automatically filter by the resolved market context.
        </p>
      </div>

      {/* My Access Profile */}
      <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6">
        <h2 className="font-semibold mb-4">Your Access Profile</h2>
        {loading ? (
          <div className="text-hos-text-muted">Loading...</div>
        ) : me ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-hos-text-muted uppercase mb-1">Role</div>
                <div className="font-medium">{me.role}</div>
              </div>
              <div>
                <div className="text-xs text-hos-text-muted uppercase mb-1">Global Admin</div>
                <div className="font-medium">{me.isGlobalAdmin ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-xs text-hos-text-muted uppercase mb-1">Permissions</div>
                <div className="font-medium">{me.permissions.length}</div>
              </div>
              <div>
                <div className="text-xs text-hos-text-muted uppercase mb-1">Visible Markets</div>
                <div className="font-medium">{me.markets.length}</div>
              </div>
            </div>

            {me.assignments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Assignments</h3>
                <div className="space-y-1">
                  {me.assignments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="font-mono px-1.5 py-0.5 bg-hos-bg-tertiary rounded text-xs">{a.permissionRoleName}</span>
                      <span className="text-hos-text-muted">@</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        a.scopeType === 'GLOBAL' ? 'bg-blue-500/20 text-blue-400' :
                        a.scopeType === 'MARKET' ? 'bg-green-500/20 text-green-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {a.scopeType}{a.scopeId ? `: ${a.scopeId}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {me.markets.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-hos-text-secondary mb-2">Visible Markets</h3>
                <div className="flex flex-wrap gap-2">
                  {me.markets.map((m) => (
                    <span key={m.id} className={`px-2 py-1 text-xs rounded border ${
                      me.activeMarket?.id === m.id
                        ? 'border-hos-gold bg-hos-gold/10 text-hos-gold-hover'
                        : 'border-hos-border text-hos-text-muted'
                    }`}>
                      {m.name} ({m.code})
                      {me.activeMarket?.id === m.id && ' (active)'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-hos-text-muted">Unable to load access profile</div>
        )}
      </div>
    </RouteGuard>
  );
}
