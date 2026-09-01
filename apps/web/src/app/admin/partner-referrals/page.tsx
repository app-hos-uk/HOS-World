'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import {
  PRIMARY_BTN,
  SECONDARY_BTN,
  FIELD_CLASS,
  StatusBadge,
  extractListPayload,
  partnerLinkCount,
  partnerRegistrations,
  str,
} from './_shared';

const LIMIT = 20;
const STATUSES = ['', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;

export default function AdminPartnerReferralsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListPartnerReferrals({
        status: status || undefined,
        search: search.trim() || undefined,
        page,
        limit: LIMIT,
      })
      .then((r) => {
        const { items, total: nextTotal } = extractListPayload(r);
        setRows(items);
        setTotal(nextTotal);
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Request failed'))
      .finally(() => setLoading(false));
  }, [toast, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const archive = async () => {
    if (!archiveId) return;
    setArchiving(true);
    try {
      await apiClient.adminArchivePartnerReferral(archiveId);
      toast.success('Partner archived');
      setArchiveId(null);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to archive');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-6xl mx-auto text-stone-100">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-6">
          <div>
            <h1 className="font-primary text-2xl text-amber-100">Partner Referrals</h1>
            <p className="font-secondary text-sm text-stone-400 mt-1">
              Track external and brand partners that drive registrations.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/partner-referrals/dashboard" className={SECONDARY_BTN}>
              Dashboard
            </Link>
            <Link href="/admin/partner-referrals/new" className={PRIMARY_BTN}>
              New Partner
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <input
            className={`${FIELD_CLASS} mt-0 max-w-xs`}
            placeholder="Search by name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            className={`${FIELD_CLASS} mt-0 w-auto`}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s || 'ALL'} value={s}>
                {s || 'ALL'}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="font-secondary text-stone-400">Loading…</p>
        ) : (
          <div className="bg-stone-900 border border-stone-800 rounded-lg overflow-x-auto">
            <table className="min-w-full text-sm font-secondary divide-y divide-stone-800">
              <thead>
                <tr className="text-stone-400 text-xs uppercase">
                  <th className="text-left p-3">Name</th>
                  <th className="text-left p-3">Type</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Links</th>
                  <th className="text-left p-3">Total Registrations</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-stone-500">
                      No partners found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const id = String(row.id);
                    const registrations = partnerRegistrations(row);
                    return (
                      <tr key={id}>
                        <td className="p-3">
                          <Link href={`/admin/partner-referrals/${id}`} className="text-amber-200 hover:text-amber-100">
                            {str(row.name)}
                          </Link>
                        </td>
                        <td className="p-3">{str(row.type)}</td>
                        <td className="p-3">
                          <StatusBadge status={String(row.status ?? '')} />
                        </td>
                        <td className="p-3">{partnerLinkCount(row)}</td>
                        <td className="p-3">{registrations == null ? '—' : registrations}</td>
                        <td className="p-3 space-x-3">
                          <Link href={`/admin/partner-referrals/${id}`} className="text-amber-200 hover:text-amber-100">
                            View
                          </Link>
                          {row.status !== 'ARCHIVED' && (
                            <button
                              type="button"
                              className="text-stone-400 hover:text-red-300"
                              onClick={() => setArchiveId(id)}
                            >
                              Archive
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 font-secondary text-sm text-stone-400">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className={SECONDARY_BTN}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className={SECONDARY_BTN}
          >
            Next
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(archiveId)}
        title="Archive this partner?"
        description="Archived partners stop appearing as active sources. Existing links remain but should not be promoted."
        tone="danger"
        confirmLabel="Archive"
        busy={archiving}
        onConfirm={() => {
          void archive();
        }}
        onCancel={() => setArchiveId(null)}
      />
    </RouteGuard>
  );
}
