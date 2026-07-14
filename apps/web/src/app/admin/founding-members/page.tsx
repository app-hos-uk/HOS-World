'use client';

import { useCallback, useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import {
  downloadCsvTemplate,
  downloadExcelTemplate,
  parseImportFile,
  rowsToMembers,
  type ParsedFoundingMember,
} from '@/lib/foundingMemberImport';

const ALLOWED_ROLES = ['ADMIN', 'MARKETING'] as const;

interface FoundingMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  country: string | null;
  fandoms: string[];
  source: string | null;
  spendBracket: string | null;
  status: string;
  registeredAt: string;
}

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; email: string; message: string }>;
}

interface PreviewRow {
  row: number;
  email: string;
  firstName: string;
  lastName?: string;
  status: 'ready' | 'duplicate' | 'duplicate_in_file' | 'invalid';
  message?: string;
}

interface PreviewResult {
  total: number;
  ready: number;
  duplicate: number;
  duplicateInFile: number;
  invalid: number;
  rows: PreviewRow[];
}

type Tab = 'list' | 'import' | 'add';

const STATUS_LABELS: Record<PreviewRow['status'], string> = {
  ready: 'Ready',
  duplicate: 'Already exists',
  duplicate_in_file: 'Duplicate in file',
  invalid: 'Invalid',
};

const STATUS_COLORS: Record<PreviewRow['status'], string> = {
  ready: 'bg-green-500/15 text-green-300',
  duplicate: 'bg-amber-500/15 text-amber-300',
  duplicate_in_file: 'bg-orange-500/15 text-orange-300',
  invalid: 'bg-red-500/15 text-red-300',
};

export default function AdminFoundingMembersPage() {
  const [tab, setTab] = useState<Tab>('list');
  const [members, setMembers] = useState<FoundingMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedMembers, setParsedMembers] = useState<ParsedFoundingMember[]>([]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(false);
  const [defaultSource, setDefaultSource] = useState('external_import');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [manualForm, setManualForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    fandoms: '',
    otherFranchises: '',
    source: 'manual_import',
    spendBracket: '',
    sendConfirmationEmail: false,
  });
  const [manualLoading, setManualLoading] = useState(false);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  const [invitationLoading, setInvitationLoading] = useState(false);
  const [invitationResult, setInvitationResult] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        apiClient.getFoundingMembers({ page, limit: 25, search: search || undefined }),
        apiClient.getFoundingMemberStats(),
      ]);
      const listData = listRes.data as {
        items: FoundingMember[];
        total: number;
        totalPages: number;
      };
      setMembers(listData.items || []);
      setTotal(listData.total ?? 0);
      setTotalPages(listData.totalPages ?? 1);
      setStats(statsRes.data || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load founding members');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchMembers();
    setSelectedIds(new Set());
  }, [fetchMembers]);

  const resetImportState = () => {
    setImportFile(null);
    setParsedMembers([]);
    setPreview(null);
    setImportResult(null);
  };

  const handleFileChange = (file: File | null) => {
    setImportFile(file);
    setParsedMembers([]);
    setPreview(null);
    setImportResult(null);
    setError(null);
  };

  const handlePreview = async () => {
    if (!importFile) return;
    setPreviewLoading(true);
    setPreview(null);
    setImportResult(null);
    setError(null);
    try {
      const rows = await parseImportFile(importFile);
      if (!rows.length) {
        setError('No valid rows found. Check column headers (email, firstName, …) and try again.');
        return;
      }
      const membersPayload = rowsToMembers(rows);
      setParsedMembers(membersPayload);
      const res = await apiClient.previewFoundingMembersImport({
        members: membersPayload,
        defaultSource: defaultSource || 'external_import',
      });
      setPreview(res.data as PreviewResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedMembers.length || !preview) return;
    setImportLoading(true);
    setImportResult(null);
    setError(null);
    try {
      const res = await apiClient.importFoundingMembers({
        members: parsedMembers,
        skipDuplicates,
        sendConfirmationEmail,
        defaultSource: defaultSource || 'external_import',
      });
      setImportResult(res.data as ImportResult);
      resetImportState();
      await fetchMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    setManualMessage(null);
    setError(null);
    try {
      await apiClient.createFoundingMemberAdmin({
        email: manualForm.email.trim(),
        firstName: manualForm.firstName.trim(),
        lastName: manualForm.lastName.trim() || undefined,
        phone: manualForm.phone.trim() || undefined,
        country: manualForm.country.trim() || undefined,
        fandoms: manualForm.fandoms
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
        otherFranchises: manualForm.otherFranchises.trim() || undefined,
        source: manualForm.source.trim() || 'manual_import',
        spendBracket: manualForm.spendBracket.trim() || undefined,
        sendConfirmationEmail: manualForm.sendConfirmationEmail,
      });
      setManualMessage('Founding member added successfully.');
      setManualForm({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        country: '',
        fandoms: '',
        otherFranchises: '',
        source: 'manual_import',
        spendBracket: '',
        sendConfirmationEmail: false,
      });
      await fetchMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setManualLoading(false);
    }
  };

  const handleSendConfirmations = async () => {
    if (!confirm('Send confirmation emails to all founding members who haven\'t received one yet?')) return;
    setConfirmationLoading(true);
    setConfirmationResult(null);
    setError(null);
    try {
      const res = await apiClient.sendFoundingMemberConfirmations(50);
      setConfirmationResult(res.data as { sent: number; failed: number; skipped: number });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send confirmation emails');
    } finally {
      setConfirmationLoading(false);
    }
  };

  const handleSendAccountInvitations = async (toSelected = false) => {
    const ids = toSelected ? Array.from(selectedIds) : undefined;
    const target = toSelected ? `${ids!.length} selected member(s)` : 'all eligible founding members';
    if (!confirm(`Send account creation invitations to ${target}?`)) return;
    setInvitationLoading(true);
    setInvitationResult(null);
    setError(null);
    try {
      const res = await apiClient.sendFoundingMemberAccountInvitations({
        batchSize: 50,
        memberIds: ids,
      });
      setInvitationResult(res.data as { sent: number; failed: number; skipped: number });
      setSelectedIds(new Set());
      await fetchMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send account invitations');
    } finally {
      setInvitationLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === members.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString(undefined, { dateStyle: 'medium' });
    } catch {
      return s;
    }
  };

  return (
    <RouteGuard allowedRoles={[...ALLOWED_ROLES]}>
              <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-hos-text-secondary">Founding Members</h1>
            <p className="mt-1 text-sm text-hos-text-muted">
              View, manually add, or bulk import founding members from CSV or Excel files.
            </p>
          </div>

          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-hos-border bg-hos-bg-secondary p-4">
                <div className="text-sm text-hos-text-muted">Total</div>
                <div className="text-2xl font-bold text-hos-gold">{stats.total}</div>
              </div>
              {Object.entries(stats.byStatus || {}).map(([status, count]) => (
                <div key={status} className="rounded-xl border border-hos-border bg-hos-bg-secondary p-4">
                  <div className="text-sm text-hos-text-muted capitalize">{status.toLowerCase()}</div>
                  <div className="text-2xl font-bold text-hos-text-secondary">{count}</div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSendConfirmations}
              disabled={confirmationLoading}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover disabled:opacity-50 flex items-center gap-2"
            >
              {confirmationLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                'Send Confirmation Emails'
              )}
            </button>
            <button
              onClick={() => handleSendAccountInvitations(false)}
              disabled={invitationLoading}
              className="px-4 py-2 border border-hos-gold text-hos-gold rounded-lg text-sm font-medium hover:bg-hos-gold/10 disabled:opacity-50 flex items-center gap-2"
            >
              {invitationLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                'Send Account Invitations (All)'
              )}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={() => handleSendAccountInvitations(true)}
                disabled={invitationLoading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2"
              >
                Send to Selected ({selectedIds.size})
              </button>
            )}
            {confirmationResult && (
              <span className="text-sm text-hos-text-muted">
                Confirmations: {confirmationResult.sent} sent, {confirmationResult.failed} failed, {confirmationResult.skipped} already sent
              </span>
            )}
            {invitationResult && (
              <span className="text-sm text-hos-text-muted">
                Invitations: {invitationResult.sent} sent, {invitationResult.failed} failed, {invitationResult.skipped} already invited
              </span>
            )}
          </div>

          <div className="flex gap-2 border-b border-hos-border">
            {(['list', 'import', 'add'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? 'border-hos-gold text-hos-gold'
                    : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary'
                }`}
              >
                {t === 'list' ? 'All Members' : t === 'import' ? 'Bulk Import' : 'Add Manually'}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-md bg-red-500/10 p-4 text-sm text-red-400">{error}</div>
          )}

          {importResult && (
            <div className="rounded-md bg-green-500/10 p-4 text-sm text-green-300 space-y-1">
              <p>
                Import complete: {importResult.created} created, {importResult.skipped} skipped,{' '}
                {importResult.failed} failed (of {importResult.total} rows).
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-red-300">
                  {importResult.errors.slice(0, 10).map((e) => (
                    <li key={`${e.row}-${e.email}`}>
                      Row {e.row} ({e.email}): {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'list' && (
            <>
              <div className="flex flex-wrap gap-3">
                <input
                  type="search"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-hos-border px-3 py-2 text-sm focus:border-hos-gold focus:outline-none focus:ring-1 focus:ring-hos-gold/50"
                />
              </div>

              <div className="overflow-hidden rounded-lg border border-hos-border bg-hos-bg-secondary">
                {loading ? (
                  <div className="p-8 text-center text-hos-text-muted">Loading…</div>
                ) : members.length === 0 ? (
                  <div className="p-8 text-center text-hos-text-muted">No founding members found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-hos-border">
                      <thead className="bg-hos-bg-secondary">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={members.length > 0 && selectedIds.size === members.length}
                              onChange={toggleSelectAll}
                              className="rounded border-hos-border accent-hos-gold"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">Email</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">Fandoms</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">Source</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">Registered</th>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-hos-text-muted">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hos-border">
                        {members.map((m) => (
                          <tr key={m.id} className={selectedIds.has(m.id) ? 'bg-hos-gold/5' : ''}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(m.id)}
                                onChange={() => toggleSelect(m.id)}
                                className="rounded border-hos-border accent-hos-gold"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-hos-text-secondary">
                              {[m.firstName, m.lastName].filter(Boolean).join(' ')}
                            </td>
                            <td className="px-4 py-3 text-sm text-hos-text-secondary">{m.email}</td>
                            <td className="px-4 py-3 text-sm text-hos-text-muted">
                              {m.fandoms?.length ? m.fandoms.join(', ') : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-hos-text-muted">{m.source || '—'}</td>
                            <td className="px-4 py-3 text-sm text-hos-text-muted">{formatDate(m.registeredAt)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                m.status === 'INVITED' ? 'bg-blue-500/15 text-blue-300' :
                                m.status === 'LINKED' ? 'bg-green-500/15 text-green-300' :
                                'bg-amber-500/15 text-amber-300'
                              }`}>
                                {m.status.toLowerCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-hos-text-muted">
                  <span>Page {page} of {totalPages} ({total} total)</span>
                  <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-hos-border px-3 py-1 disabled:opacity-40">Previous</button>
                    <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border border-hos-border px-3 py-1 disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'import' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-hos-border bg-hos-bg-secondary p-5 space-y-4 max-w-3xl">
                <div>
                  <h2 className="text-lg font-semibold text-hos-text-secondary">Import from CSV or Excel</h2>
                  <p className="text-sm text-hos-text-muted mt-1">
                    Upload a spreadsheet from another source. Preview validates rows before anything is saved.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={downloadCsvTemplate} className="text-sm text-hos-gold hover:text-hos-gold-hover underline">
                    Download CSV template
                  </button>
                  <button type="button" onClick={downloadExcelTemplate} className="text-sm text-hos-gold hover:text-hos-gold-hover underline">
                    Download Excel template
                  </button>
                </div>

                <p className="text-xs text-hos-text-muted">
                  Accepted formats: <code>.csv</code>, <code>.xlsx</code>, <code>.xls</code>.
                  Fandoms can be pipe- or comma-separated. Column names like &quot;First Name&quot; are auto-normalized.
                </p>

                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-hos-text-secondary"
                />

                {importFile && (
                  <p className="text-sm text-hos-text-secondary">
                    Selected: <strong>{importFile.name}</strong>
                  </p>
                )}

                <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                  <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
                  Skip duplicate emails on import (recommended)
                </label>

                <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                  <input type="checkbox" checked={sendConfirmationEmail} onChange={(e) => setSendConfirmationEmail(e.target.checked)} />
                  Send welcome confirmation email to newly imported members
                </label>

                <div>
                  <label className="block text-sm font-medium text-hos-text-secondary mb-1">Default source label</label>
                  <input
                    type="text"
                    value={defaultSource}
                    onChange={(e) => setDefaultSource(e.target.value)}
                    className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handlePreview}
                    disabled={!importFile || previewLoading}
                    className="px-4 py-2 border border-hos-gold text-hos-gold rounded-lg text-sm font-medium hover:bg-hos-gold/10 disabled:opacity-50"
                  >
                    {previewLoading ? 'Validating…' : 'Preview import (dry run)'}
                  </button>

                  {preview && preview.ready > 0 && (
                    <button
                      onClick={handleConfirmImport}
                      disabled={importLoading}
                      className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover disabled:opacity-50"
                    >
                      {importLoading ? 'Importing…' : `Confirm import (${preview.ready} rows)`}
                    </button>
                  )}
                </div>
              </div>

              {preview && (
                <div className="rounded-xl border border-hos-border bg-hos-bg-secondary overflow-hidden">
                  <div className="px-5 py-4 border-b border-hos-border">
                    <h3 className="text-sm font-semibold text-hos-text-secondary">Import preview</h3>
                    <p className="text-xs text-hos-text-muted mt-1">
                      {preview.ready} ready · {preview.duplicate} already exist · {preview.duplicateInFile} duplicate in file · {preview.invalid} invalid · {preview.total} total
                    </p>
                  </div>
                  <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                    <table className="min-w-full divide-y divide-hos-border">
                      <thead className="bg-hos-bg-secondary sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-hos-text-muted">Row</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-hos-text-muted">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-hos-text-muted">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-hos-text-muted">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium uppercase text-hos-text-muted">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hos-border">
                        {preview.rows.map((row) => (
                          <tr key={row.row}>
                            <td className="px-4 py-2 text-sm text-hos-text-muted">{row.row}</td>
                            <td className="px-4 py-2 text-sm text-hos-text-secondary">{row.email}</td>
                            <td className="px-4 py-2 text-sm text-hos-text-secondary">
                              {[row.firstName, row.lastName].filter(Boolean).join(' ')}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[row.status]}`}>
                                {STATUS_LABELS[row.status]}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-hos-text-muted">{row.message || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'add' && (
            <form onSubmit={handleManualAdd} className="max-w-xl space-y-4 rounded-xl border border-hos-border bg-hos-bg-secondary p-5">
              <h2 className="text-lg font-semibold text-hos-text-secondary">Add founding member manually</h2>
              {manualMessage && <p className="text-sm text-green-400">{manualMessage}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-hos-text-muted mb-1">First name *</label>
                  <input required value={manualForm.firstName} onChange={(e) => setManualForm({ ...manualForm, firstName: e.target.value })} className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-hos-text-muted mb-1">Last name</label>
                  <input value={manualForm.lastName} onChange={(e) => setManualForm({ ...manualForm, lastName: e.target.value })} className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-hos-text-muted mb-1">Email *</label>
                  <input required type="email" value={manualForm.email} onChange={(e) => setManualForm({ ...manualForm, email: e.target.value })} className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-hos-text-muted mb-1">Phone</label>
                  <input value={manualForm.phone} onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })} className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-hos-text-muted mb-1">Country</label>
                  <input value={manualForm.country} onChange={(e) => setManualForm({ ...manualForm, country: e.target.value })} className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-hos-text-muted mb-1">Fandoms (comma-separated)</label>
                  <input value={manualForm.fandoms} onChange={(e) => setManualForm({ ...manualForm, fandoms: e.target.value })} placeholder="Harry Potter, Marvel" className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-hos-text-muted mb-1">Source</label>
                  <input value={manualForm.source} onChange={(e) => setManualForm({ ...manualForm, source: e.target.value })} className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-hos-text-muted mb-1">Spend bracket</label>
                  <input value={manualForm.spendBracket} onChange={(e) => setManualForm({ ...manualForm, spendBracket: e.target.value })} className="w-full rounded-lg border border-hos-border px-3 py-2 text-sm" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
                <input type="checkbox" checked={manualForm.sendConfirmationEmail} onChange={(e) => setManualForm({ ...manualForm, sendConfirmationEmail: e.target.checked })} />
                Send welcome confirmation email
              </label>

              <button type="submit" disabled={manualLoading} className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg text-sm font-medium hover:bg-hos-gold-hover disabled:opacity-50">
                {manualLoading ? 'Adding…' : 'Add Member'}
              </button>
            </form>
          )}
        </div>
          </RouteGuard>
  );
}
