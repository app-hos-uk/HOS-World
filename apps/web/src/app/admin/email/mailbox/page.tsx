'use client';

import { useCallback, useEffect, useState, Fragment } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { wrapEmailPreviewDocument } from '@/lib/sanitizeHtml';
import { useDateTime } from '@/hooks/useDateTime';

type MailboxSourceTab = 'all' | 'marketing' | 'transactional' | 'campaign';
type DetailSource = 'marketing' | 'transactional' | 'campaign';

interface MailboxStats {
  sentToday: number;
  sentWeek: number;
  sentMonth: number;
  deliveryRate: number;
  failureRate: number;
}

interface MailboxItem {
  id: string;
  source: DetailSource;
  subject: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  status: string;
  sentAt: string | null;
  templateSlug: string | null;
  campaignId: string | null;
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  error?: string | null;
}

interface MailboxDetail {
  source: DetailSource;
  id: string;
  subject?: string | null;
  body?: string | null;
  content?: string | null;
  bodyHtml?: string | null;
  recipientEmail?: string | null;
  recipientName?: string | null;
  email?: string | null;
  status?: string;
  error?: string | null;
  sentAt?: string | null;
  templateSlug?: string | null;
  metadata?: Record<string, unknown> | null;
  recipientCount?: number;
  sentCount?: number;
  failedCount?: number;
  skippedCount?: number;
}

interface MessageLogRow {
  id: string;
  status: string;
  subject?: string | null;
  error?: string | null;
  user?: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

const STATUS_OPTIONS = [
  '',
  'SENT',
  'FAILED',
  'QUEUED',
  'PENDING',
  'SKIPPED_CONSENT',
  'COMPLETED',
] as const;

const SOURCE_TABS: { id: MailboxSourceTab; label: string }[] = [
  { id: 'all', label: 'All emails' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'transactional', label: 'Transactional' },
  { id: 'campaign', label: 'Campaigns' },
];

function errMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  return fallback;
}

/** API returns rates as 0–1 fractions. */
function formatRate(rate: number | undefined): string {
  if (rate == null || Number.isNaN(rate)) return '—';
  const pct = rate <= 1 ? rate * 100 : rate;
  return `${pct.toFixed(1)}%`;
}

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (s === 'SENT' || s === 'COMPLETED' || s === 'DELIVERED') {
    return 'bg-green-500/15 text-green-300';
  }
  if (s === 'FAILED') return 'bg-red-500/15 text-red-300';
  if (s === 'QUEUED' || s === 'PENDING' || s === 'SENDING') {
    return 'bg-amber-500/15 text-amber-300';
  }
  if (s === 'SKIPPED_CONSENT') return 'bg-hos-bg-tertiary text-hos-text-muted';
  return 'bg-hos-bg-tertiary text-hos-text-secondary';
}

function extractBodyHtml(detail: MailboxDetail): string | null {
  if (typeof detail.bodyHtml === 'string' && detail.bodyHtml) return detail.bodyHtml;
  if (typeof detail.body === 'string' && detail.body) return detail.body;
  if (typeof detail.content === 'string' && detail.content) return detail.content;
  const meta = detail.metadata;
  if (meta && typeof meta === 'object') {
    for (const key of ['bodyHtml', 'body', 'content', 'html']) {
      const v = meta[key];
      if (typeof v === 'string' && v) return v;
    }
  }
  return null;
}

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

export default function AdminEmailMailboxPage() {
  const { formatDateTime } = useDateTime();
  const [source, setSource] = useState<MailboxSourceTab>('all');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const [items, setItems] = useState<MailboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<MailboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailboxDetail | null>(null);
  const [messageLogs, setMessageLogs] = useState<MessageLogRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchMailbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.adminGetMailbox({
        source,
        status: status || undefined,
        q: q || undefined,
        page,
        limit,
      });
      const data = res.data as {
        items: MailboxItem[];
        total: number;
        stats: MailboxStats;
      };
      setItems(data.items || []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? null);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(errMessage(err, 'Failed to load mailbox.'));
    } finally {
      setLoading(false);
    }
  }, [source, status, q, page]);

  useEffect(() => {
    fetchMailbox();
  }, [fetchMailbox]);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
    setDetail(null);
    setMessageLogs([]);
  }, [source, status, q]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const loadDetail = async (item: MailboxItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      setDetail(null);
      setMessageLogs([]);
      return;
    }
    setExpandedId(item.id);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    setMessageLogs([]);
    try {
      const detailSource: DetailSource =
        source === 'all' ? item.source : (source as DetailSource);
      const res = await apiClient.adminGetMailboxDetail(detailSource, item.id);
      setDetail(res.data as MailboxDetail);

      if (detailSource === 'campaign') {
        try {
          const campRes = await apiClient.adminGetEmailCampaign(item.id);
          const campData = campRes.data as {
            campaign?: MailboxDetail;
            messageLogs?: MessageLogRow[];
          };
          if (campData.campaign) {
            setDetail({ ...campData.campaign, source: 'campaign' });
          }
          setMessageLogs(campData.messageLogs || []);
        } catch {
          // detail from mailbox is enough
        }
      }
    } catch (err) {
      setDetailError(errMessage(err, 'Failed to load detail.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const applySearch = () => {
    setQ(qInput.trim());
  };

  const bodyHtml = detail ? extractBodyHtml(detail) : null;

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">Mailbox</h1>
          <p className="text-hos-text-secondary mt-1">
            Sent emails and admin campaigns.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { label: 'Sent today', value: stats?.sentToday },
            { label: 'Sent this week', value: stats?.sentWeek },
            { label: 'Sent this month', value: stats?.sentMonth },
            { label: 'Delivery rate', value: formatRate(stats?.deliveryRate) },
            { label: 'Failure rate', value: formatRate(stats?.failureRate) },
          ].map((card) => (
            <div
              key={card.label}
              className="p-4 rounded-xl border border-hos-border bg-hos-bg-secondary"
            >
              <div className="text-xs text-hos-text-muted mb-1">{card.label}</div>
              <div className="text-2xl font-bold text-hos-gold">
                {card.value == null ? '—' : card.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + filters */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSource(tab.id)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  source === tab.id
                    ? 'border-hos-gold bg-hos-gold/10 text-hos-gold'
                    : 'border-hos-border text-hos-text-secondary hover:border-hos-gold'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="flex gap-2 flex-1">
              <input
                type="text"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
                placeholder="Search subject or email..."
                className="flex-1 bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border"
              />
              <button
                type="button"
                onClick={applySearch}
                className="px-4 py-2 text-sm rounded-lg bg-hos-gold text-[#1a1406] hover:bg-hos-gold-hover"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-hos-text-muted">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-hos-text-muted">No emails found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-hos-bg-tertiary text-hos-text-muted text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Recipient</th>
                    <th className="px-4 py-3 font-medium">Subject</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Template</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <Fragment key={item.id}>
                      <tr
                        onClick={() => loadDetail(item)}
                        className={`border-t border-hos-border cursor-pointer hover:bg-hos-bg-tertiary/50 ${
                          expandedId === item.id ? 'bg-hos-gold/5' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-hos-text-secondary whitespace-nowrap">
                          {item.sentAt ? formatDateTime(item.sentAt) : '—'}
                        </td>
                        <td className="px-4 py-3 text-hos-text-secondary">
                          {item.source === 'campaign'
                            ? `${item.recipientCount ?? 0} recipients`
                            : item.recipientName || item.recipientEmail || '—'}
                        </td>
                        <td className="px-4 py-3 text-hos-text-secondary max-w-xs truncate">
                          {item.subject || '—'}
                        </td>
                        <td className="px-4 py-3 text-hos-text-muted capitalize">{item.source}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusBadgeClass(
                              item.status,
                            )}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-hos-text-muted font-mono text-xs">
                          {item.templateSlug || '—'}
                        </td>
                      </tr>
                      {expandedId === item.id && (
                        <tr className="border-t border-hos-border">
                          <td colSpan={6} className="px-4 py-4 bg-hos-bg-tertiary/30">
                            {detailLoading ? (
                              <p className="text-hos-text-muted">Loading detail...</p>
                            ) : detailError ? (
                              <p className="text-red-400">{detailError}</p>
                            ) : detail ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-hos-text-muted">Subject: </span>
                                    <span className="text-hos-text-secondary">
                                      {detail.subject || '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-hos-text-muted">Recipient: </span>
                                    <span className="text-hos-text-secondary">
                                      {detail.source === 'campaign'
                                        ? `${detail.recipientCount ?? 0} recipients`
                                        : detail.recipientName ||
                                          detail.recipientEmail ||
                                          detail.email ||
                                          '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-hos-text-muted">Status: </span>
                                    <span className="text-hos-text-secondary">
                                      {detail.status || '—'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-hos-text-muted">Sent: </span>
                                    <span className="text-hos-text-secondary">
                                      {detail.sentAt ? formatDateTime(detail.sentAt) : '—'}
                                    </span>
                                  </div>
                                  {detail.error && (
                                    <div className="sm:col-span-2">
                                      <span className="text-hos-text-muted">Error: </span>
                                      <span className="text-red-400">{detail.error}</span>
                                    </div>
                                  )}
                                  {detail.source === 'campaign' && (
                                    <div className="sm:col-span-2 text-hos-text-secondary">
                                      Sent: {detail.sentCount ?? 0} · Failed:{' '}
                                      {detail.failedCount ?? 0} · Skipped:{' '}
                                      {detail.skippedCount ?? 0}
                                    </div>
                                  )}
                                </div>

                                {bodyHtml ? (
                                  looksLikeHtml(bodyHtml) ? (
                                    <iframe
                                      srcDoc={wrapEmailPreviewDocument(bodyHtml)}
                                      sandbox=""
                                      className="w-full h-[320px] border border-hos-border rounded-lg bg-white"
                                      title="Email body"
                                    />
                                  ) : (
                                    <pre className="text-xs text-hos-text-secondary whitespace-pre-wrap bg-hos-bg-secondary border border-hos-border rounded-lg p-3 max-h-[320px] overflow-auto">
                                      {bodyHtml}
                                    </pre>
                                  )
                                ) : (
                                  <p className="text-xs text-hos-text-muted">
                                    No body content available for this message.
                                  </p>
                                )}

                                {detail.source === 'campaign' && messageLogs.length > 0 && (
                                  <div>
                                    <h4 className="text-sm font-semibold text-hos-text-secondary mb-2">
                                      Message log
                                    </h4>
                                    <div className="max-h-48 overflow-y-auto border border-hos-border rounded-lg">
                                      <table className="w-full text-xs">
                                        <thead className="bg-hos-bg-secondary text-hos-text-muted sticky top-0">
                                          <tr>
                                            <th className="px-3 py-2 text-left font-medium">
                                              Email
                                            </th>
                                            <th className="px-3 py-2 text-left font-medium">
                                              Status
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {messageLogs.map((log) => (
                                            <tr
                                              key={log.id}
                                              className="border-t border-hos-border"
                                            >
                                              <td className="px-3 py-1.5 text-hos-text-secondary">
                                                {log.user?.email || '—'}
                                              </td>
                                              <td className="px-3 py-1.5">
                                                <span
                                                  className={`px-1.5 py-0.5 rounded-full ${statusBadgeClass(
                                                    log.status,
                                                  )}`}
                                                >
                                                  {log.status}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between text-sm text-hos-text-secondary">
            <span>
              Page {page} of {totalPages} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-hos-border disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-hos-border disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
