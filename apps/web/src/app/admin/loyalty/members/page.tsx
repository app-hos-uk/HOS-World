'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { DataExport } from '@/components/DataExport';
import { useDateTime } from '@/hooks/useDateTime';

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 5000;

const LOYALTY_JOURNEY_EMAIL_SLUGS = [
  'welcome_loyalty',
  'welcome_explore',
  'welcome_first_purchase',
  'post_purchase_thankyou',
  'post_purchase_review',
  'tier_upgrade_congrats',
  'tier_upgrade_benefits',
  'birthday_greeting',
  'birthday_reminder',
  'abandoned_cart_reminder',
  'abandoned_cart_incentive',
  'abandoned_cart_final',
  'winback_miss_you',
  'winback_incentive',
  'winback_final',
  'points_expiry_30d',
  'points_expiry_14d',
  'points_expiry_final',
] as const;

type EmailTemplateOption = {
  slug: string;
  subject?: string;
  description?: string;
};

type SendEmailResult = {
  targeted: number;
  sent: number;
  failed: number;
  skippedConsent: number;
  errors: string[];
};

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
  const { formatDate } = useDateTime();
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendModal, setSendModal] = useState<'selected' | 'all' | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSlug, setTemplateSlug] = useState('');
  const [subjectOverride, setSubjectOverride] = useState('');
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendEmailResult | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeQuery, currentPage],
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
        format: (v: string | null | undefined) => (v ? formatDate(v) : ''),
      },
      {
        key: 'userId',
        header: 'User ID',
        format: (v: string) => v || '',
      },
    ],
    [formatDate],
  );

  const handleAdjust = async () => {
    if (!selectedMember || !adjustForm.reason.trim()) {
      toast.error('Reason is required');
      return;
    }
    const userId = selectedMember.userId || selectedMember.user?.id || '';
    const pointsDelta = Number(adjustForm.pointsDelta);
    if (!userId) {
      toast.error('Member is missing a user id — refresh the list and try again');
      return;
    }
    if (!Number.isInteger(pointsDelta) || pointsDelta === 0) {
      toast.error('Enter a non-zero whole number of points to add or deduct');
      return;
    }
    setAdjusting(true);
    try {
      await apiClient.adminAdjustLoyaltyPoints(userId, pointsDelta, adjustForm.reason.trim());
      toast.success(`Points adjusted by ${pointsDelta > 0 ? '+' : ''}${pointsDelta}`);
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

  const loadEmailTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await apiClient.getTemplates('EMAIL');
      const rows = Array.isArray(res?.data) ? (res.data as EmailTemplateOption[]) : [];
      const loyalty = rows.filter(
        (t) =>
          t.slug.startsWith('loyalty_') ||
          (LOYALTY_JOURNEY_EMAIL_SLUGS as readonly string[]).includes(t.slug),
      );
      setEmailTemplates(loyalty);
      if (loyalty.length > 0) {
        setTemplateSlug((prev) => prev || loyalty[0].slug);
      }
    } catch {
      setEmailTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sendModal) {
      void loadEmailTemplates();
    }
  }, [sendModal, loadEmailTemplates]);

  const toggleSelectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.userId)));
    }
  };

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const openSendModal = (mode: 'selected' | 'all') => {
    setSendResult(null);
    setSubjectOverride('');
    setDryRun(true);
    setOnlyUnverified(false);
    setSendModal(mode);
  };

  const closeSendModal = () => {
    if (sending) return;
    setSendModal(null);
  };

  const handleSendEmail = async () => {
    if (!templateSlug) {
      toast.error('Choose an email template');
      return;
    }
    if (sendModal === 'selected' && selectedIds.size === 0) {
      toast.error('Select at least one member');
      return;
    }

    setSending(true);
    setSendResult(null);
    try {
      const res = await apiClient.adminLoyaltySendMemberEmail({
        templateSlug,
        subject: subjectOverride.trim() || undefined,
        memberIds: sendModal === 'selected' ? Array.from(selectedIds) : undefined,
        sendToAll: sendModal === 'all',
        search: sendModal === 'all' ? activeQuery || undefined : undefined,
        onlyUnverified: sendModal === 'all' ? onlyUnverified : undefined,
        dryRun,
      });
      const data = res.data as SendEmailResult;
      setSendResult(data);
      if (dryRun) {
        toast.success(
          `Dry run: ${data.sent} would send, ${data.skippedConsent} skipped (consent), ${data.failed} failed`,
        );
      } else {
        toast.success(
          `Sent ${data.sent} — ${data.skippedConsent} skipped (consent), ${data.failed} failed`,
        );
        setSelectedIds(new Set());
        setSendModal(null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const sendTargetLabel =
    sendModal === 'selected'
      ? `${selectedIds.size} selected member${selectedIds.size === 1 ? '' : 's'}`
      : `all ${total.toLocaleString()} member${total === 1 ? '' : 's'} matching the current filter`;

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-hos-text-secondary">Loyalty Members</h1>
          <p className="text-hos-text-secondary mt-1">
            Enchanted Circle members — points, tiers, and adjustments. Customize email copy in{' '}
            <Link href="/admin/templates" className="text-hos-gold hover:text-hos-gold-hover underline">
              Notification Templates
            </Link>
            .{' '}
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

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => openSendModal('all')}
          disabled={total === 0}
          className="px-4 py-2 border border-hos-gold text-hos-gold rounded-lg text-sm font-medium hover:bg-hos-gold/10 disabled:opacity-50"
        >
          Send email to all matching filter
        </button>
        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={() => openSendModal('selected')}
            className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover"
          >
            Send email to selected ({selectedIds.size})
          </button>
        )}
        {sendResult && !sendModal && (
          <span className="text-sm text-hos-text-muted">
            Last send: {sendResult.sent} sent, {sendResult.skippedConsent} skipped (consent),{' '}
            {sendResult.failed} failed (of {sendResult.targeted})
          </span>
        )}
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
                  <th className="text-left px-4 py-3 font-medium text-hos-text-secondary w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all on this page"
                      checked={members.length > 0 && selectedIds.size === members.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
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
                      <input
                        type="checkbox"
                        aria-label={`Select ${m.user?.email || m.userId}`}
                        checked={selectedIds.has(m.userId)}
                        onChange={() => toggleSelect(m.userId)}
                      />
                    </td>
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
                    <td className="text-right px-4 py-3 font-semibold text-hos-text-secondary">
                      {Number(m.currentBalance ?? m.pointsBalance ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-hos-text-secondary">
                      {Number(m.totalPointsEarned ?? m.lifetimePoints ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-hos-text-muted text-xs">
                      {m.enrolledAt ? formatDate(m.enrolledAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/loyalty/members/${m.userId || m.user?.id}`}
                          className="text-hos-text-secondary hover:text-hos-gold font-medium"
                        >
                          Ledger
                        </Link>
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

      {sendModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="send-loyalty-email-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !sending) closeSendModal();
          }}
        >
          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 id="send-loyalty-email-title" className="text-xl font-bold text-hos-text-secondary mb-2">
              Send loyalty email
            </h2>
            <p className="text-sm text-hos-text-muted mb-4">
              Target: <strong className="text-hos-text-secondary">{sendTargetLabel}</strong>. Sends respect
              marketing consent and loyalty email opt-in.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Template</label>
                {templatesLoading ? (
                  <p className="text-sm text-hos-text-muted">Loading templates…</p>
                ) : emailTemplates.length === 0 ? (
                  <p className="text-sm text-red-400">No loyalty email templates found.</p>
                ) : (
                  <select
                    className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary border-hos-border"
                    value={templateSlug}
                    onChange={(e) => setTemplateSlug(e.target.value)}
                    disabled={sending}
                  >
                    {emailTemplates.map((t) => (
                      <option key={t.slug} value={t.slug}>
                        {t.slug}
                        {t.description ? ` — ${t.description}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Subject override (optional)
                </label>
                <input
                  className="w-full border rounded-lg px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary border-hos-border"
                  placeholder="Leave blank to use template default"
                  value={subjectOverride}
                  onChange={(e) => setSubjectOverride(e.target.value)}
                  disabled={sending}
                />
              </div>

              {sendModal === 'all' && (
                <label className="flex items-start gap-2 text-sm text-hos-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={onlyUnverified}
                    onChange={(e) => setOnlyUnverified(e.target.checked)}
                    disabled={sending}
                  />
                  <span>Only unverified email addresses</span>
                </label>
              )}

              <label className="flex items-start gap-2 text-sm text-hos-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  disabled={sending}
                />
                <span>Dry run first (preview counts without sending)</span>
              </label>
            </div>

            {sendResult && sendModal && (
              <div className="mb-4 rounded-lg border border-hos-border bg-hos-bg-tertiary p-3 text-sm text-hos-text-secondary space-y-1">
                <p>
                  Targeted {sendResult.targeted}: {sendResult.sent}{' '}
                  {dryRun ? 'would send' : 'sent'}, {sendResult.skippedConsent} skipped (consent),{' '}
                  {sendResult.failed} failed
                </p>
                {sendResult.errors.length > 0 && (
                  <ul className="list-disc pl-5 text-red-400">
                    {sendResult.errors.slice(0, 5).map((err) => (
                      <li key={err}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sending || !templateSlug || emailTemplates.length === 0}
                className="flex-1 px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 text-sm font-medium"
              >
                {sending ? 'Processing…' : dryRun ? 'Run dry run' : 'Send now'}
              </button>
              <button
                type="button"
                onClick={closeSendModal}
                disabled={sending}
                className="px-4 py-2 border border-hos-border rounded-lg hover:bg-hos-bg-tertiary text-sm font-medium disabled:opacity-50"
              >
                {sendResult && dryRun ? 'Close' : 'Cancel'}
              </button>
            </div>
          </div>
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
