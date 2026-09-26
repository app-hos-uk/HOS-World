'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { RouteGuard } from '@/components/RouteGuard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TipTapEditor } from '@/components/cms/TipTapEditor';
import { apiClient } from '@/lib/api';
import { wrapEmailPreviewDocument } from '@/lib/sanitizeHtml';

type AudienceType = 'INDIVIDUAL' | 'SEGMENT' | 'ALL';

interface EmailUser {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface TemplateOption {
  slug: string;
  subject?: string;
  body?: string;
  description?: string;
}

interface AudienceResult {
  count: number;
  cap: number;
  capped: boolean;
  sample: EmailUser[];
  missing?: string[];
}

interface DryRunResult {
  dryRun: true;
  targeted: number;
  wouldSend: number;
  skippedConsent: number;
  skippedNoEmail?: number;
}

interface LiveSendResult {
  dryRun: false;
  campaignId: string;
  jobId?: string;
  targeted: number;
}

const USER_ROLES = [
  'CUSTOMER',
  'WHOLESALER',
  'B2C_SELLER',
  'SELLER',
  'ADMIN',
  'INFLUENCER',
  'PROCUREMENT',
  'FULFILLMENT',
  'CATALOG',
  'MARKETING',
  'FINANCE',
  'CMS_EDITOR',
  'SALES',
  'STORE_STAFF',
] as const;

const INSERTABLE_VARS = ['firstName', 'lastName', 'email'] as const;

const PREVIEW_SAMPLE: Record<string, string> = {
  firstName: 'Alex',
  lastName: 'Rivera',
  email: 'alex@example.com',
};

function errMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  return fallback;
}

function substitutePreview(text: string): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return PREVIEW_SAMPLE[key] ?? `{{${key}}}`;
  });
}

function isEmptyHtml(html: string): boolean {
  const trimmed = html.trim();
  return !trimmed || trimmed === '<p></p>' || trimmed === '<p><br></p>';
}

export default function AdminEmailComposePage() {
  const [audienceType, setAudienceType] = useState<AudienceType>('INDIVIDUAL');

  // Individual
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<EmailUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<EmailUser[]>([]);

  // Segment / All
  const [segmentSearch, setSegmentSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tierSlug, setTierSlug] = useState('');
  const [regionCode, setRegionCode] = useState('');

  const [audiencePreview, setAudiencePreview] = useState<AudienceResult | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateSlug, setTemplateSlug] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [editorKey, setEditorKey] = useState(0);

  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<LiveSendResult | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  // Reset dry-run when audience / subject / body change
  useEffect(() => {
    setDryRunResult(null);
    setSendSuccess(null);
  }, [
    audienceType,
    selectedUsers,
    segmentSearch,
    roleFilter,
    tierSlug,
    regionCode,
    subject,
    bodyHtml,
    templateSlug,
  ]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.getTemplates('EMAIL');
        setTemplates((res.data || []) as TemplateOption[]);
      } catch {
        setTemplates([]);
      }
    })();
  }, []);

  // Debounced individual user search
  useEffect(() => {
    if (audienceType !== 'INDIVIDUAL') return;
    const q = userSearch.trim();
    if (!q) {
      setUserResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const res = await apiClient.adminSearchEmailUsers(q);
        setUserResults((res.data || []) as EmailUser[]);
      } catch {
        setUserResults([]);
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearch, audienceType]);

  const buildAudiencePayload = useCallback(() => {
    if (audienceType === 'INDIVIDUAL') {
      return {
        audienceType: 'INDIVIDUAL' as const,
        userIds: selectedUsers.map((u) => u.userId),
      };
    }
    const filters: { role?: string; tierSlug?: string; regionCode?: string } = {};
    if (roleFilter) filters.role = roleFilter;
    if (tierSlug.trim()) filters.tierSlug = tierSlug.trim();
    if (regionCode.trim()) filters.regionCode = regionCode.trim();
    return {
      audienceType,
      search: segmentSearch.trim() || undefined,
      filters: Object.keys(filters).length ? filters : undefined,
    };
  }, [audienceType, selectedUsers, roleFilter, tierSlug, regionCode, segmentSearch]);

  const canDryRun =
    subject.trim().length > 0 &&
    !isEmptyHtml(bodyHtml) &&
    (audienceType !== 'INDIVIDUAL' || selectedUsers.length > 0);

  const sendBlockedByCap = audiencePreview?.capped === true;
  const sendEnabled =
    !!dryRunResult &&
    !sendBlockedByCap &&
    subject.trim().length > 0 &&
    !isEmptyHtml(bodyHtml) &&
    !sendLoading;

  const addUser = (user: EmailUser) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.userId === user.userId) ? prev : [...prev, user],
    );
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.userId !== userId));
  };

  const handlePreviewAudience = async () => {
    setAudienceLoading(true);
    setAudienceError(null);
    try {
      if (audienceType === 'INDIVIDUAL' && selectedUsers.length === 0) {
        setAudienceError('Select at least one recipient.');
        setAudiencePreview(null);
        return;
      }
      const res = await apiClient.adminResolveEmailAudience(buildAudiencePayload());
      setAudiencePreview(res.data as AudienceResult);
    } catch (err) {
      setAudiencePreview(null);
      setAudienceError(errMessage(err, 'Failed to resolve audience.'));
    } finally {
      setAudienceLoading(false);
    }
  };

  const handleTemplateChange = async (slug: string) => {
    setTemplateSlug(slug);
    if (!slug) {
      return;
    }
    try {
      const res = await apiClient.getTemplate(slug);
      const t = res.data as TemplateOption & { body?: string; content?: string };
      setSubject(t.subject || '');
      setBodyHtml(t.body || t.content || '');
      setEditorKey((k) => k + 1);
    } catch (err) {
      setActionError(errMessage(err, 'Failed to load template.'));
    }
  };

  const insertVariable = (name: string) => {
    setBodyHtml((prev) => `${prev || ''}${'{{' + name + '}}'}`);
    setEditorKey((k) => k + 1);
  };

  const previewSubject = useMemo(() => substitutePreview(subject), [subject]);
  const previewBody = useMemo(() => substitutePreview(bodyHtml), [bodyHtml]);

  const handleDryRun = async () => {
    setDryRunLoading(true);
    setActionError(null);
    setSendSuccess(null);
    try {
      const payload = {
        ...buildAudiencePayload(),
        subject: subject.trim(),
        bodyHtml,
        templateSlug: templateSlug || undefined,
        dryRun: true as const,
      };
      const res = await apiClient.adminSendEmailCampaign(payload);
      setDryRunResult(res.data as DryRunResult);
      // Refresh audience preview if missing
      if (!audiencePreview) {
        try {
          const aud = await apiClient.adminResolveEmailAudience(buildAudiencePayload());
          setAudiencePreview(aud.data as AudienceResult);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setDryRunResult(null);
      setActionError(errMessage(err, 'Dry run failed.'));
    } finally {
      setDryRunLoading(false);
    }
  };

  const handleSendConfirm = async () => {
    setConfirmSend(false);
    if (sendBlockedByCap) {
      setActionError('Audience exceeds the recipient cap. Narrow the audience before sending.');
      return;
    }
    setSendLoading(true);
    setActionError(null);
    try {
      const payload = {
        ...buildAudiencePayload(),
        subject: subject.trim(),
        bodyHtml,
        templateSlug: templateSlug || undefined,
        dryRun: false as const,
      };
      const res = await apiClient.adminSendEmailCampaign(payload);
      setSendSuccess(res.data as LiveSendResult);
      setDryRunResult(null);
    } catch (err) {
      setActionError(errMessage(err, 'Failed to send campaign.'));
    } finally {
      setSendLoading(false);
    }
  };

  const tabs: { id: AudienceType; label: string }[] = [
    { id: 'INDIVIDUAL', label: 'Individual' },
    { id: 'SEGMENT', label: 'Segment' },
    { id: 'ALL', label: 'All matching' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">Compose Email</h1>
          <p className="text-hos-text-secondary mt-1">
            Preview an audience, write or pick a template, dry-run, then send a marketing campaign.
          </p>
        </div>

        {/* Audience */}
        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-hos-text-secondary">Audience</h2>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setAudienceType(tab.id);
                  setAudiencePreview(null);
                  setAudienceError(null);
                }}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  audienceType === tab.id
                    ? 'border-hos-gold bg-hos-gold/10 text-hos-gold'
                    : 'border-hos-border text-hos-text-secondary hover:border-hos-gold'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {audienceType === 'INDIVIDUAL' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-hos-text-muted mb-1">
                  Search users
                </label>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Name or email..."
                  className="w-full max-w-md bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                />
              </div>
              {userSearchLoading && (
                <p className="text-xs text-hos-text-muted">Searching...</p>
              )}
              {userResults.length > 0 && (
                <ul className="max-h-40 overflow-y-auto border border-hos-border rounded-lg divide-y divide-hos-border">
                  {userResults.map((u) => (
                    <li key={u.userId}>
                      <button
                        type="button"
                        onClick={() => addUser(u)}
                        className="w-full text-left px-3 py-2 text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary"
                      >
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}{' '}
                        <span className="text-hos-text-muted">({u.email})</span>
                        <span className="ml-2 text-[10px] text-hos-gold">{u.role}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((u) => (
                    <span
                      key={u.userId}
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-hos-gold/10 text-hos-gold border border-hos-gold/30"
                    >
                      {u.email}
                      <button
                        type="button"
                        onClick={() => removeUser(u.userId)}
                        className="hover:text-red-300"
                        aria-label={`Remove ${u.email}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-hos-text-muted mb-1">
                  Search (optional)
                </label>
                <input
                  type="text"
                  value={segmentSearch}
                  onChange={(e) => setSegmentSearch(e.target.value)}
                  placeholder="Name or email contains..."
                  className="w-full bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-hos-text-muted mb-1">Role</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border"
                >
                  <option value="">Any role</option>
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-hos-text-muted mb-1">
                  Loyalty tier slug
                </label>
                <input
                  type="text"
                  value={tierSlug}
                  onChange={(e) => setTierSlug(e.target.value)}
                  placeholder="e.g. gold"
                  className="w-full bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-hos-text-muted mb-1">
                  Region code
                </label>
                <input
                  type="text"
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value.toUpperCase())}
                  placeholder="US / GB"
                  className="w-full bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handlePreviewAudience}
            disabled={audienceLoading}
            className="px-4 py-2 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:border-hos-gold disabled:opacity-50"
          >
            {audienceLoading ? 'Resolving...' : 'Preview audience'}
          </button>

          {audienceError && <p className="text-sm text-red-400">{audienceError}</p>}

          {audiencePreview && (
            <div className="space-y-3">
              <p className="text-sm text-hos-text-secondary">
                <span className="font-semibold text-hos-gold">{audiencePreview.count}</span> matching
                users
                {audiencePreview.capped && (
                  <span className="ml-2 text-amber-300">
                    (exceeds cap of {audiencePreview.cap} — narrow the audience before sending)
                  </span>
                )}
              </p>
              {audiencePreview.sample.length > 0 && (
                <div className="overflow-x-auto border border-hos-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-hos-bg-tertiary text-hos-text-muted text-left">
                      <tr>
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audiencePreview.sample.map((u) => (
                        <tr key={u.userId} className="border-t border-hos-border">
                          <td className="px-3 py-2 text-hos-text-secondary">
                            {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                          </td>
                          <td className="px-3 py-2 text-hos-text-secondary">{u.email}</td>
                          <td className="px-3 py-2 text-hos-text-muted">{u.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-5 space-y-4">
          <h2 className="text-lg font-semibold text-hos-text-secondary">Content</h2>

          <div>
            <label className="block text-xs font-medium text-hos-text-muted mb-1">Template</label>
            <select
              value={templateSlug}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full max-w-md bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border"
            >
              <option value="">Blank</option>
              {templates.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.slug}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-hos-text-muted mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="w-full bg-hos-bg-secondary rounded-lg px-3 py-2 text-sm text-hos-text-secondary border border-hos-border focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-hos-text-muted mb-1">Body</label>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs text-hos-text-muted self-center">Insert:</span>
              {INSERTABLE_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="text-xs px-2 py-1 rounded-md font-mono bg-hos-gold/10 text-hos-gold hover:bg-hos-gold/20"
                >
                  {'{{' + v + '}}'}
                </button>
              ))}
            </div>
            <TipTapEditor
              key={editorKey}
              content={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Write your email body..."
            />
          </div>
        </div>

        {/* Preview */}
        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border overflow-hidden">
          <div className="px-5 py-3 border-b border-hos-border">
            <h3 className="text-sm font-semibold text-hos-text-secondary">Preview</h3>
            {previewSubject && (
              <p className="text-xs text-hos-text-muted mt-0.5">Subject: {previewSubject}</p>
            )}
          </div>
          <div className="p-4">
            {isEmptyHtml(bodyHtml) ? (
              <div className="text-center py-8 text-hos-text-muted">Add a body to preview</div>
            ) : (
              <iframe
                srcDoc={wrapEmailPreviewDocument(previewBody)}
                sandbox=""
                className="w-full h-[360px] border border-hos-border rounded-lg bg-white"
                title="Email compose preview"
              />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="bg-hos-bg-secondary rounded-xl border border-hos-border p-5 space-y-4">
          {actionError && <p className="text-sm text-red-400">{actionError}</p>}

          {dryRunResult && (
            <div className="text-sm text-hos-text-secondary space-y-1">
              <p>
                Dry run: <span className="text-hos-gold">{dryRunResult.targeted}</span> targeted,{' '}
                <span className="text-green-400">{dryRunResult.wouldSend}</span> would send,{' '}
                <span className="text-amber-300">{dryRunResult.skippedConsent}</span> skipped
                (consent)
              </p>
            </div>
          )}

          {sendBlockedByCap && (
            <p className="text-sm text-amber-300">
              Audience is capped. Narrow filters or select fewer recipients before sending.
            </p>
          )}

          {sendSuccess && (
            <div className="text-sm text-green-400 space-y-1">
              <p>
                Campaign queued (id: {sendSuccess.campaignId}) for {sendSuccess.targeted} recipients.
              </p>
              <Link href="/admin/email/mailbox" className="text-hos-gold underline">
                Open mailbox
              </Link>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDryRun}
              disabled={!canDryRun || dryRunLoading || sendLoading}
              className="px-4 py-2 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:border-hos-gold disabled:opacity-50"
            >
              {dryRunLoading ? 'Running...' : 'Dry run'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmSend(true)}
              disabled={!sendEnabled}
              className="px-4 py-2 text-sm rounded-lg bg-hos-gold text-[#1a1406] hover:bg-hos-gold-hover disabled:opacity-50"
            >
              {sendLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
          {!dryRunResult && canDryRun && (
            <p className="text-xs text-hos-text-muted">Run a dry run before sending.</p>
          )}
        </div>
      </div>

      {confirmSend && dryRunResult && (
        <ConfirmDialog
          open
          title={`Send this email to ${dryRunResult.wouldSend} recipients?`}
          description="This queues a live marketing campaign. Recipients without marketing consent will be skipped."
          confirmLabel="Send now"
          onCancel={() => setConfirmSend(false)}
          onConfirm={handleSendConfirm}
        />
      )}
    </RouteGuard>
  );
}
