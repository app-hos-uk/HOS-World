'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 5000;

type LoyaltyMember = {
  id?: string;
  userId: string;
  cardNumber?: string | null;
  currentBalance?: number | null;
  pointsBalance?: number | null;
  totalPointsEarned?: number | null;
  lifetimePoints?: number | null;
  enrolledAt?: string | null;
  user?: {
    id?: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  tier?: { name?: string | null } | null;
};

export default function AdminLoyaltyMembersPage() {
  const [members, setMembers] = useState<LoyaltyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedMember, setSelectedMember] = useState<LoyaltyMember | null>(null);
  const [adjustForm, setAdjustForm] = useState({ pointsDelta: 0, reason: '' });
  const [adjusting, setAdjusting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<LoyaltyMember | null>(null);
  const [alsoDeleteUser, setAlsoDeleteUser] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const loadSeq = useRef(0);

  const load = useCallback(
    async (opts?: { q?: string; page?: number }) => {
      const q = opts?.q ?? activeQuery;
      const requestedPage = opts?.page ?? currentPage;
      const seq = ++loadSeq.current;
      try {
        setLoading(true);
        const res = await apiClient.adminGetLoyaltyMembers({
          q: q || undefined,
          page: requestedPage,
          limit: PAGE_SIZE,
        });
        if (seq !== loadSeq.current) return;

        const rows = Array.isArray(res?.data) ? (res.data as LoyaltyMember[]) : [];
        const pagination = res?.pagination;
        const nextTotal = pagination?.total ?? rows.length;
        const nextTotalPages = Math.max(1, pagination?.totalPages ?? 1);
        let nextPage = pagination?.page ?? requestedPage;

        // Dataset shrank — fetch the last valid page in-place so the table never
        // keeps prior-page rows while pagination meta has already changed.
        if (nextTotal > 0 && requestedPage > nextTotalPages) {
          const clamped = await apiClient.adminGetLoyaltyMembers({
            q: q || undefined,
            page: nextTotalPages,
            limit: PAGE_SIZE,
          });
          if (seq !== loadSeq.current) return;
          const clampedRows = Array.isArray(clamped?.data)
            ? (clamped.data as LoyaltyMember[])
            : [];
          setMembers(clampedRows);
          setTotal(clamped?.pagination?.total ?? nextTotal);
          setTotalPages(Math.max(1, clamped?.pagination?.totalPages ?? nextTotalPages));
          setCurrentPage(nextTotalPages);
          return;
        }

        setMembers(rows);
        setTotal(nextTotal);
        setTotalPages(nextTotalPages);
        if (nextPage !== currentPage) {
          setCurrentPage(nextPage);
        }
      } catch (err: any) {
        if (seq !== loadSeq.current) return;
        toast.error(err.message || 'Failed to load members');
      } finally {
        if (seq === loadSeq.current) {
          setLoading(false);
        }
      }
    },
    [activeQuery, currentPage, toast],
  );

  useEffect(() => {
    void load({ page: currentPage, q: activeQuery });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on page/query only
  }, [currentPage, activeQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q === activeQuery && currentPage === 1) {
      void load({ q, page: 1 });
      return;
    }
    setCurrentPage(1);
    setActiveQuery(q);
  };

  // Keep results in sync when the search box is cleared without submitting
  useEffect(() => {
    if (searchQuery === '' && activeQuery !== '') {
      setCurrentPage(1);
      setActiveQuery('');
    }
  }, [searchQuery, activeQuery]);

  const fetchAllForExport = useCallback(async () => {
    const all: LoyaltyMember[] = [];
    let page = 1;
    let pages = 1;
    do {
      const res = await apiClient.adminGetLoyaltyMembers({
        q: activeQuery || undefined,
        page,
        limit: EXPORT_PAGE_SIZE,
      });
      const rows = Array.isArray(res?.data) ? (res.data as LoyaltyMember[]) : [];
      all.push(...rows);
      pages = Math.max(1, res?.pagination?.totalPages ?? 1);
      const reportedTotal = res?.pagination?.total;
      if (reportedTotal != null && all.length >= reportedTotal) break;
      if (rows.length === 0) break;
      page += 1;
    } while (page <= pages);
    return all;
  }, [activeQuery]);

  const exportColumns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        format: (_: unknown, row: LoyaltyMember) =>
          [row.user?.firstName, row.user?.lastName].filter(Boolean).join(' ') || '',
      },
      {
        key: 'email',
        header: 'Email',
        format: (_: unknown, row: LoyaltyMember) => row.user?.email || '',
      },
      {
        key: 'cardNumber',
        header: 'Card Number',
        format: (v: string | null | undefined) => v || '',
      },
      {
        key: 'tier',
        header: 'Tier',
        format: (_: unknown, row: LoyaltyMember) => row.tier?.name || 'None',
      },
      {
        key: 'currentBalance',
        header: 'Points Balance',
        format: (_: unknown, row: LoyaltyMember) =>
          String(Number(row.currentBalance ?? row.pointsBalance ?? 0)),
      },
      {
        key: 'totalPointsEarned',
        header: 'Lifetime Points',
        format: (_: unknown, row: LoyaltyMember) =>
          String(Number(row.totalPointsEarned ?? row.lifetimePoints ?? 0)),
      },
      {
        key: 'enrolledAt',
        header: 'Enrolled',
        format: (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString() : ''),
      },
      {
        key: 'userId',
        header: 'User ID',
        format: (v: string) => v || '',
      },
    ],
    [],
  );

  const handleAdjust = async () => {
    if (!selectedMember || !adjustForm.reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    setAdjusting(true);
    try {
      await apiClient.adminAdjustLoyaltyPoints(
        selectedMember.userId,
        adjustForm.pointsDelta,
        adjustForm.reason,
      );
      toast.success(
        `Points adjusted by ${adjustForm.pointsDelta > 0 ? '+' : ''}${adjustForm.pointsDelta}`,
      );
      setSelectedMember(null);
      setAdjustForm({ pointsDelta: 0, reason: '' });
      await load({ q: activeQuery, page: currentPage });
    } catch (err: any) {
      toast.error(err.message || 'Failed to adjust points');
    } finally {
      setAdjusting(false);
    }
  };

  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;
    setDeleting(true);
    try {
      await apiClient.adminDeleteLoyaltyMember(memberToDelete.userId, {
        deleteUser: alsoDeleteUser,
      });
      toast.success(
        alsoDeleteUser
          ? 'Loyalty membership and user account deleted'
          : 'Loyalty membership deleted',
      );
      if (selectedMember?.userId === memberToDelete.userId) {
        setSelectedMember(null);
      }
      setMemberToDelete(null);
      setAlsoDeleteUser(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete member');
    } finally {
      setDeleting(false);
      // Refresh even on failure — membership may have been removed server-side.
      await load({ q: activeQuery, page: currentPage });
    }
  };

  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const showingFrom = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(safePage * PAGE_SIZE, total);

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hos-text-secondary">Loyalty Members</h1>
          <p className="text-hos-text-secondary mt-1">
            Enchanted Circle members — points, tiers, and adjustments.{' '}
            <Link href="/admin/founding-members" className="text-hos-gold hover:text-hos-gold-hover underline">
              Looking for Founding Members?
            </Link>
          </p>
        </div>
        <DataExport
          data={members}
          columns={exportColumns}
          filename="loyalty-members-export"
          resolveData={fetchAllForExport}
          showJson={false}
        />
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          className="flex-1 border rounded-lg px-4 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
          placeholder="Search by email, name, or card number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover text-sm font-medium"
        >
          Search
        </button>
      </form>

      {selectedMember && (
        <div className="bg-hos-bg-secondary border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Adjust Points — {selectedMember.user?.firstName} {selectedMember.user?.lastName} (
            {selectedMember.user?.email})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                Points Delta (negative to deduct)
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
                value={adjustForm.pointsDelta}
                onChange={(e) =>
                  setAdjustForm({ ...adjustForm, pointsDelta: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-hos-text-secondary mb-1">Reason</label>
              <input
                className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
                placeholder="e.g. Goodwill credit"
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdjust}
              disabled={adjusting}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm font-medium"
            >
              {adjusting ? 'Adjusting...' : 'Apply Adjustment'}
            </button>
            <button
              onClick={() => setSelectedMember(null)}
              className="px-4 py-2 border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-hos-gold" />
        </div>
      ) : (
        <div className="bg-hos-bg-secondary border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-hos-bg-secondary border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Card #</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Tier</th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary">Points</th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary">Lifetime</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary">Enrolled</th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m) => (
                  <tr key={m.id || m.userId} className="hover:bg-hos-bg-tertiary">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-hos-text-secondary">
                          {m.user?.firstName} {m.user?.lastName}
                        </p>
                        <p className="text-xs text-hos-text-muted">{m.user?.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-hos-text-secondary font-mono text-xs">
                      {m.cardNumber || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-hos-gold/20 text-hos-gold-hover">
                        {m.tier?.name || 'None'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-hos-text-secondary">
                      {Number(m.currentBalance ?? m.pointsBalance ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-hos-text-secondary">
                      {Number(m.totalPointsEarned ?? m.lifetimePoints ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-hos-text-muted text-xs">
                      {m.enrolledAt ? new Date(m.enrolledAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(m);
                            setAdjustForm({ pointsDelta: 0, reason: '' });
                          }}
                          className="text-hos-gold hover:text-hos-gold-hover font-medium"
                        >
                          Adjust
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMemberToDelete(m);
                            setAlsoDeleteUser(false);
                          }}
                          className="text-red-400 hover:text-red-300 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {members.length === 0 && (
            <div className="p-8 text-center text-hos-text-muted">
              {total > 0
                ? 'No members on this page. Try a different page.'
                : activeQuery
                  ? 'No members found for this search.'
                  : 'No loyalty members yet.'}
            </div>
          )}
          {total > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-hos-border bg-hos-bg-secondary/80">
              <p className="text-sm text-hos-text-muted">
                Showing {showingFrom}–{showingTo} of {total.toLocaleString()} members
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="admin-pagination-btn"
                >
                  First
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="admin-pagination-btn"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`e-${idx}`} className="px-1 text-hos-text-muted">
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={`min-w-[2.25rem] px-3 py-2 text-sm font-medium border rounded-md ${
                          currentPage === item
                            ? 'border-hos-gold bg-hos-gold/10 text-hos-gold'
                            : 'border-hos-border hover:bg-hos-bg-tertiary text-hos-text-secondary'
                        }`}
                      >
                        {item}
                      </button>
                    ),
                  )}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="admin-pagination-btn admin-pagination-btn-primary"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="admin-pagination-btn"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {memberToDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-loyalty-member-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !deleting) {
              setMemberToDelete(null);
              setAlsoDeleteUser(false);
            }
          }}
        >
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg max-w-md w-full p-6">
            <h2 id="delete-loyalty-member-title" className="text-xl font-bold text-hos-text-secondary mb-3">
              Delete loyalty member
            </h2>
            <p className="text-sm text-hos-text-secondary mb-4">
              Remove loyalty membership for{' '}
              <strong>
                {memberToDelete.user?.firstName} {memberToDelete.user?.lastName}
              </strong>{' '}
              (<span className="font-mono text-xs">{memberToDelete.user?.email}</span>)? This clears
              their points, card, referrals, and transactions. This cannot be undone.
            </p>
            <label className="flex items-start gap-2 mb-6 text-sm text-hos-text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={alsoDeleteUser}
                onChange={(e) => setAlsoDeleteUser(e.target.checked)}
                disabled={deleting}
              />
              <span>
                Also delete the user account (use for test accounts only). Admins and protected
                accounts cannot be deleted.
              </span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={confirmDeleteMember}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              >
                {deleting ? 'Deleting…' : alsoDeleteUser ? 'Delete membership + user' : 'Delete membership'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMemberToDelete(null);
                  setAlsoDeleteUser(false);
                }}
                disabled={deleting}
                className="px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}
