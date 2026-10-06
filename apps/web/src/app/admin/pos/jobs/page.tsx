'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useDateTime } from '@/hooks/useDateTime';
import Link from 'next/link';

type CronJob = {
  key: string;
  name: string;
  pattern?: string;
  next?: number;
};

type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  dlq: number;
};

type RecentJob = {
  id: string;
  name: string;
  data?: Record<string, unknown>;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  returnvalue?: unknown;
};

type DlqJob = {
  id: string;
  name: string;
  data?: Record<string, unknown>;
  attemptsMade: number;
  failedReason?: string;
  timestamp: number;
};

type ActivityLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  user?: { email: string; firstName?: string; lastName?: string };
  createdAt: string;
};

const CRON_DESCRIPTIONS: Record<string, string> = {
  'pos:nightly-reconciliation': 'Nightly inventory reconciliation against Lightspeed',
  'pos:sales-poll': 'Poll all active connections for new POS sales',
  'pos:gift-card-reconciliation': 'Reconcile gift card balances with Lightspeed',
  'pos:customer-import': 'Daily incremental customer import from Lightspeed',
  'pos:product-sync': 'Sync product data to Lightspeed (push)',
  'pos:inventory-sync': 'Sync inventory counts to Lightspeed',
};

const BADGE_COLORS: Record<string, string> = {
  waiting: 'bg-amber-500/20 text-amber-300',
  active: 'bg-blue-500/20 text-blue-300',
  completed: 'bg-green-500/20 text-green-300',
  failed: 'bg-red-500/20 text-red-300',
  delayed: 'bg-purple-500/20 text-purple-300',
  paused: 'bg-gray-500/20 text-gray-300',
  dlq: 'bg-red-600/20 text-red-400',
};

export default function AdminPosJobsPage() {
  const toast = useToast();
  const { formatDateTime } = useDateTime();

  const [crons, setCrons] = useState<CronJob[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
  const [recentFilter, setRecentFilter] = useState<'completed' | 'failed'>('completed');
  const [dlqJobs, setDlqJobs] = useState<DlqJob[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    description?: string;
    tone?: 'default' | 'danger';
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cronRes, statsRes, recentRes, dlqRes, actRes] = await Promise.all([
        apiClient.getPosJobCrons(),
        apiClient.getPosJobStats(),
        apiClient.getPosRecentJobs(undefined, recentFilter),
        apiClient.getPosDlqJobs(),
        apiClient.getPosActivity(),
      ]);
      setCrons(Array.isArray(cronRes?.data) ? cronRes.data : []);
      setStats(statsRes?.data ?? null);
      setRecentJobs(Array.isArray(recentRes?.data) ? recentRes.data : []);
      setDlqJobs(Array.isArray(dlqRes?.data) ? dlqRes.data : []);
      const actData = (actRes?.data as { logs?: ActivityLog[] })?.logs;
      setActivityLogs(Array.isArray(actData) ? actData : []);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [recentFilter]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const disableCron = (cron: CronJob) => {
    setConfirmDialog({
      title: `Disable ${cron.name}?`,
      description: `This will stop the repeatable schedule "${cron.pattern}". You can re-enable it later.`,
      tone: 'danger',
      confirmLabel: 'Disable',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.disablePosCron(cron.name, cron.pattern!);
          toast.success(`${cron.name} disabled`);
          await loadAll();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed');
        }
      },
    });
  };

  const enableCron = async (name: string, pattern: string) => {
    try {
      await apiClient.enablePosCron(name, pattern);
      toast.success(`${name} enabled with pattern ${pattern}`);
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const triggerNow = async (name: string) => {
    try {
      await apiClient.triggerPosCronNow(name);
      toast.success(`${name} queued`);
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const retryDlq = async (jobId: string) => {
    try {
      await apiClient.retryPosDlqJob(jobId);
      toast.success('Job re-queued');
      await loadAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Retry failed');
    }
  };

  const purgeDlq = () => {
    setConfirmDialog({
      title: 'Purge all DLQ jobs?',
      description: 'This permanently removes all dead-letter POS jobs.',
      tone: 'danger',
      confirmLabel: 'Purge',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await apiClient.purgePosDlq();
          toast.success('DLQ purged');
          await loadAll();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Failed');
        }
      },
    });
  };

  const fmtTs = (ts?: number) => {
    if (!ts) return '—';
    return formatDateTime(new Date(ts).toISOString());
  };

  const fmtJobId = (id?: string) => id ? id.slice(0, 8) : '—';

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/admin/pos" className="text-sm text-hos-gold hover:text-hos-gold-hover">&larr; POS</Link>
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-hos-text-secondary">POS Job Management</h1>
            <p className="text-sm text-hos-text-muted mt-0.5">Monitor scheduled tasks, queue health, and product-pull activity.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-hos-border text-sm text-hos-text-secondary hover:bg-hos-bg-secondary disabled:opacity-50 transition-colors"
          >
            <span className={loading ? 'animate-spin' : ''}>&#8635;</span>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Queue Stats */}
        {stats && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-hos-text-muted mb-3">Queue Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {(Object.entries(stats) as [string, number][]).map(([key, val]) => (
                <div
                  key={key}
                  className={`rounded-lg border bg-hos-bg-secondary p-4 text-center transition-colors ${
                    key === 'failed' && val > 0 ? 'border-red-500/40' :
                    key === 'dlq' && val > 0 ? 'border-red-600/40' :
                    key === 'active' && val > 0 ? 'border-blue-500/40' :
                    'border-hos-border'
                  }`}
                >
                  <div className={`text-2xl font-bold ${
                    (key === 'failed' || key === 'dlq') && val > 0 ? 'text-red-400' : 'text-hos-text-secondary'
                  }`}>{val}</div>
                  <div className={`text-xs font-medium uppercase mt-1 inline-block px-2 py-0.5 rounded ${BADGE_COLORS[key] || 'text-hos-text-muted'}`}>
                    {key}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <hr className="border-hos-border/50" />

        {/* Cron Schedules */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-hos-text-muted mb-3">Scheduled Jobs</h2>
          {crons.length === 0 ? (
            <p className="text-sm text-hos-text-muted">
              No POS cron jobs registered. Either POS is disabled or the API just started.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-hos-border text-xs uppercase text-hos-text-muted">
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Next run</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {crons.map((c) => (
                    <tr key={c.key} className="border-b border-hos-border/50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-hos-text-secondary">{c.name}</div>
                        <div className="text-xs text-hos-text-muted">{CRON_DESCRIPTIONS[c.name] || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-hos-text-secondary font-mono">{c.pattern}</td>
                      <td className="px-4 py-3 text-sm text-hos-text-muted">{fmtTs(c.next)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void triggerNow(c.name)}
                            className="text-sm text-hos-gold hover:text-hos-gold-hover"
                          >
                            Run now
                          </button>
                          <button
                            type="button"
                            onClick={() => disableCron(c)}
                            className="text-sm text-red-400 hover:text-red-300"
                          >
                            Disable
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick re-enable panel */}
          <details className="mt-3">
            <summary className="text-sm text-hos-text-muted cursor-pointer hover:text-hos-text-secondary">
              Re-enable a disabled cron…
            </summary>
            <div className="mt-2 rounded-lg border border-hos-border bg-hos-bg-secondary p-4 space-y-2">
              {[
                { name: 'pos:nightly-reconciliation', pattern: '0 2 * * *' },
                { name: 'pos:sales-poll', pattern: '*/15 * * * *' },
                { name: 'pos:gift-card-reconciliation', pattern: '0 */6 * * *' },
                { name: 'pos:customer-import', pattern: '0 3 * * *' },
              ]
                .filter((d) => !crons.some((c) => c.name === d.name))
                .map((d) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <span className="text-sm text-hos-text-secondary">
                      {d.name} <span className="text-hos-text-muted font-mono text-xs">({d.pattern})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void enableCron(d.name, d.pattern)}
                      className="text-sm text-hos-gold hover:text-hos-gold-hover"
                    >
                      Enable
                    </button>
                  </div>
                ))}
              {[
                { name: 'pos:nightly-reconciliation', pattern: '0 2 * * *' },
                { name: 'pos:sales-poll', pattern: '*/15 * * * *' },
                { name: 'pos:gift-card-reconciliation', pattern: '0 */6 * * *' },
                { name: 'pos:customer-import', pattern: '0 3 * * *' },
              ].every((d) => crons.some((c) => c.name === d.name)) && (
                <p className="text-sm text-hos-text-muted">All default POS crons are active.</p>
              )}
            </div>
          </details>
        </section>

        <hr className="border-hos-border/50" />

        {/* Recent Jobs */}
        <section>
          <div className="flex items-center gap-4 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-hos-text-muted">Recent Jobs</h2>
            <div className="flex gap-2">
              {(['completed', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRecentFilter(f)}
                  className={`text-sm px-3 py-1 rounded-full border ${
                    recentFilter === f
                      ? 'border-hos-gold text-hos-gold'
                      : 'border-hos-border text-hos-text-muted hover:text-hos-text-secondary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {recentJobs.length === 0 ? (
            <p className="text-sm text-hos-text-muted">No {recentFilter} POS jobs found.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hos-border text-xs uppercase text-hos-text-muted">
                    <th className="px-4 py-3">Job ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">Queued</th>
                    <th className="px-4 py-3">Finished</th>
                    <th className="px-4 py-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.slice(0, 20).map((j) => (
                    <tr key={j.id} className="border-b border-hos-border/50 hover:bg-hos-bg-tertiary/30 transition-colors">
                      <td className="px-4 py-2 text-hos-text-muted font-mono text-xs" title={j.id}>{fmtJobId(j.id)}</td>
                      <td className="px-4 py-2 text-hos-text-secondary">{j.name.replace('pos:', '')}</td>
                      <td className="px-4 py-2 text-hos-text-muted">{j.attemptsMade}</td>
                      <td className="px-4 py-2 text-hos-text-muted">{fmtTs(j.timestamp)}</td>
                      <td className="px-4 py-2 text-hos-text-muted">{fmtTs(j.finishedOn)}</td>
                      <td className="px-4 py-2 text-red-400 text-xs max-w-xs truncate">
                        {j.failedReason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <hr className="border-hos-border/50" />

        {/* Dead Letter Queue */}
        <section>
          <div className="flex items-center gap-4 mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-hos-text-muted">
              Dead Letter Queue
              {dlqJobs.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-red-500/20 text-red-400">
                  {dlqJobs.length}
                </span>
              )}
            </h2>
            {dlqJobs.length > 0 && (
              <button
                type="button"
                onClick={purgeDlq}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Purge all
              </button>
            )}
          </div>
          {dlqJobs.length === 0 ? (
            <p className="text-sm text-hos-text-muted">DLQ is empty.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-red-500/20 bg-hos-bg-secondary">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-red-500/20 text-xs uppercase text-hos-text-muted">
                    <th className="px-4 py-3">Job ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Attempts</th>
                    <th className="px-4 py-3">Error</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dlqJobs.map((j) => (
                    <tr key={j.id} className="border-b border-hos-border/50 hover:bg-red-500/5 transition-colors">
                      <td className="px-4 py-2 text-hos-text-muted font-mono text-xs" title={j.id!}>{fmtJobId(j.id)}</td>
                      <td className="px-4 py-2 text-hos-text-secondary">{j.name.replace('pos:', '')}</td>
                      <td className="px-4 py-2 text-hos-text-muted">{j.attemptsMade}</td>
                      <td className="px-4 py-2 text-red-400 text-xs max-w-xs truncate">
                        {j.failedReason || '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void retryDlq(j.id!)}
                          className="text-sm text-hos-gold hover:text-hos-gold-hover"
                        >
                          Retry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <hr className="border-hos-border/50" />

        {/* POS Activity Logs */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-hos-text-muted mb-3">Product Pull Activity</h2>
          {activityLogs.length === 0 ? (
            <p className="text-sm text-hos-text-muted">
              No product-pull activity yet. Searches, previews, and link operations are logged here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-hos-border bg-hos-bg-secondary">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hos-border text-xs uppercase text-hos-text-muted">
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLogs.slice(0, 30).map((log) => (
                    <tr key={log.id} className="border-b border-hos-border/50">
                      <td className="px-4 py-2">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded ${
                          log.action === 'POS_PRODUCT_LINKED'
                            ? 'bg-green-500/20 text-green-300'
                            : log.action === 'POS_PRODUCT_SEARCH'
                              ? 'bg-blue-500/20 text-blue-300'
                              : 'bg-purple-500/20 text-purple-300'
                        }`}>
                          {log.action.replace('POS_PRODUCT_', '').replace('POS_', '')}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-hos-text-secondary text-xs max-w-md truncate">
                        {log.description}
                      </td>
                      <td className="px-4 py-2 text-hos-text-muted text-xs">
                        {log.user
                          ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-hos-text-muted text-xs">
                        {formatDateTime(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          open
          title={confirmDialog.title}
          description={confirmDialog.description}
          tone={confirmDialog.tone}
          confirmLabel={confirmDialog.confirmLabel}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
    </RouteGuard>
  );
}
