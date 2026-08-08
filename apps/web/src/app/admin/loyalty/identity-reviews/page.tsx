'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminIdentityReviewsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('OPEN');
  const [selectedById, setSelectedById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.adminGetIdentityMatchReviews({ status, limit: 100 });
      const data = Array.isArray(res?.data) ? (res.data as any[]) : [];
      setRows(data);
      const defaults: Record<string, string> = {};
      for (const r of data) {
        defaults[r.id] =
          r.proposedInternalId ||
          (Array.isArray(r.candidateInternalIds) && r.candidateInternalIds.length === 1
            ? r.candidateInternalIds[0]
            : '');
      }
      setSelectedById(defaults);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [status, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (row: any, next: 'MERGED' | 'REJECTED' | 'IGNORED') => {
    try {
      const proposedInternalId =
        next === 'MERGED'
          ? selectedById[row.id] || row.proposedInternalId || undefined
          : undefined;
      if (next === 'MERGED' && !proposedInternalId && !(row.candidateInternalIds?.length === 1)) {
        toast.error('Select a HOS candidate to merge');
        return;
      }
      await apiClient.adminResolveIdentityMatchReview(row.id, {
        status: next,
        proposedInternalId,
      });
      toast.success(next === 'MERGED' ? 'Merged and linked to Lightspeed' : `Marked ${next}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to resolve');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hos-text-primary">Identity Match Reviews</h1>
          <p className="text-hos-text-secondary mt-1 text-sm font-ui">
            Ambiguous Lightspeed ↔ HOS customer matches awaiting resolution. Merge creates the
            customer mapping used by POS sales import.
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary text-sm"
        >
          {['OPEN', 'MERGED', 'REJECTED', 'IGNORED'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-hos-text-secondary">Loading…</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const candidates: string[] = Array.isArray(r.candidateInternalIds)
              ? r.candidateInternalIds
              : [];
            return (
              <div
                key={r.id}
                className="p-4 border border-hos-border rounded-lg bg-hos-bg-secondary space-y-2"
              >
                <div className="flex flex-wrap gap-3 text-sm font-ui text-hos-text-secondary">
                  <span className="text-hos-gold">{r.reason}</span>
                  <span>{r.status}</span>
                  <span>{r.email || '—'}</span>
                  <span>{r.phoneNormalized || '—'}</span>
                  <span className="text-xs">LS: {r.lightspeedCustomerId || '—'}</span>
                </div>
                {candidates.length > 0 && (
                  <p className="text-xs font-ui text-hos-text-muted">
                    Candidates: {candidates.join(', ')}
                  </p>
                )}
                {status === 'OPEN' && (
                  <div className="flex flex-wrap gap-2 items-center">
                    {(candidates.length > 1 || !r.proposedInternalId) && (
                      <select
                        value={selectedById[r.id] || ''}
                        onChange={(e) =>
                          setSelectedById((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        className="px-2 py-1 text-xs bg-hos-bg border border-hos-border-input rounded text-hos-text-primary min-w-[220px]"
                      >
                        <option value="">Select HOS id to merge…</option>
                        {r.proposedInternalId && (
                          <option value={r.proposedInternalId}>
                            Proposed: {r.proposedInternalId}
                          </option>
                        )}
                        {candidates.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => resolve(r, 'MERGED')}
                      className="px-3 py-1 text-xs bg-hos-gold text-[#1a1406] rounded font-semibold"
                    >
                      Merge & link
                    </button>
                    <button
                      type="button"
                      onClick={() => resolve(r, 'REJECTED')}
                      className="px-3 py-1 text-xs border border-hos-border rounded text-hos-text-primary"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => resolve(r, 'IGNORED')}
                      className="px-3 py-1 text-xs border border-hos-border rounded text-hos-text-secondary"
                    >
                      Ignore
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="text-hos-text-secondary text-sm py-8 text-center">No reviews</p>
          )}
        </div>
      )}
    </RouteGuard>
  );
}
