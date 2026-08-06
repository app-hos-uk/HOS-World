'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface GiftCard {
  id: string;
  code: string;
  type: string;
  amount: number;
  balance: number;
  currency: string;
  status: string;
  issuedToEmail?: string;
  issuedToName?: string;
  message?: string;
  expiresAt?: string;
  createdAt: string;
  transactionCount: number;
}

interface GiftCardTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  notes?: string;
  createdAt: string;
  order?: { id: string; orderNumber?: string; total: number; status: string };
}

const STATUS_OPTIONS = ['', 'ACTIVE', 'REDEEMED', 'CANCELLED', 'PENDING'] as const;
const TYPE_OPTIONS = ['', 'digital', 'physical'] as const;

function maskCode(code: string): string {
  if (!code || code.length < 4) return code;
  const last4 = code.slice(-4);
  return `****-****-****-${last4}`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-500/15 text-green-300';
    case 'REDEEMED':
      return 'bg-blue-500/15 text-blue-300';
    case 'CANCELLED':
      return 'bg-red-500/15 text-red-300';
    case 'PENDING':
      return 'bg-yellow-500/15 text-yellow-300';
    default:
      return 'bg-gray-500/15 text-gray-300';
  }
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminGiftCardsPage() {
  const toast = useToast();

  // List state
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const limit = 20;

  // Expanded row for transactions
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<GiftCardTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Issue form
  const [showForm, setShowForm] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [form, setForm] = useState({
    type: 'digital' as 'digital' | 'physical',
    amount: '',
    currency: 'GBP',
    issuedToEmail: '',
    issuedToName: '',
    message: '',
    expiresAt: '',
  });

  const fetchGiftCards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.listAllGiftCards({
        page,
        limit,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      });
      if (res?.data) {
        setGiftCards(res.data.items || []);
        setTotal(res.data.pagination?.total ?? 0);
      }
    } catch (err: any) {
      console.error('Failed to load gift cards:', err);
      toast.error('Failed to load gift cards');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchGiftCards();
  }, [fetchGiftCards]);

  const handleToggleRow = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setTransactions([]);
      return;
    }
    setExpandedId(id);
    setLoadingTx(true);
    try {
      const res = await apiClient.getGiftCardTransactions(id);
      setTransactions(res?.data || []);
    } catch {
      toast.error('Failed to load transactions');
      setTransactions([]);
    } finally {
      setLoadingTx(false);
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast.error('Amount must be greater than zero');
      return;
    }
    try {
      setIssuing(true);
      await apiClient.createGiftCard({
        type: form.type,
        amount,
        currency: form.currency || undefined,
        issuedToEmail: form.issuedToEmail || undefined,
        issuedToName: form.issuedToName || undefined,
        message: form.message || undefined,
        expiresAt: form.expiresAt || undefined,
      });
      toast.success('Gift card issued successfully');
      setForm({ type: 'digital', amount: '', currency: 'GBP', issuedToEmail: '', issuedToName: '', message: '', expiresAt: '' });
      setShowForm(false);
      setPage(1);
      fetchGiftCards();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to issue gift card');
    } finally {
      setIssuing(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied={true}>
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Gift Cards</h1>
        <p className="text-hos-text-secondary mt-2">Manage and issue gift cards</p>
      </div>

      {/* Issue New Gift Card Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-5 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
        >
          {showForm ? 'Cancel' : '+ Issue New Gift Card'}
        </button>
      </div>

      {/* Issue Form */}
      {showForm && (
        <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Issue New Gift Card</h2>
          <form onSubmit={handleIssue} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'digital' | 'physical' }))}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
                >
                  <option value="digital">Digital</option>
                  <option value="physical">Physical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Amount</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="50.00"
                  className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
                >
                  <option value="GBP">GBP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Issued To (Name)</label>
                <input
                  type="text"
                  value={form.issuedToName}
                  onChange={(e) => setForm((f) => ({ ...f, issuedToName: e.target.value }))}
                  placeholder="John Doe"
                  className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Issued To (Email)</label>
                <input
                  type="email"
                  value={form.issuedToEmail}
                  onChange={(e) => setForm((f) => ({ ...f, issuedToEmail: e.target.value }))}
                  placeholder="john@example.com"
                  className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-hos-text-secondary mb-1">Expires At</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-hos-text-secondary mb-1">Message</label>
              <textarea
                rows={2}
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Optional personal message"
                className="w-full px-4 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
              />
            </div>
            <button
              type="submit"
              disabled={issuing}
              className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium disabled:opacity-50"
            >
              {issuing ? 'Issuing...' : 'Issue Gift Card'}
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-hos-text-muted mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-hos-text-muted mb-1">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:ring-2 focus:ring-hos-gold/50 focus:outline-none focus:border-hos-gold"
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-sm text-hos-text-muted self-end">
          {total} gift card{total !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Table */}
      <div className="bg-hos-bg-secondary border border-hos-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold mx-auto mb-4"></div>
              <p className="text-hos-text-secondary">Loading gift cards...</p>
            </div>
          </div>
        ) : giftCards.length === 0 ? (
          <div className="text-center py-12 text-hos-text-muted">
            No gift cards found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hos-border bg-hos-bg-tertiary">
                  <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Code</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Type</th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-muted">Amount</th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-muted">Balance</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Issued To</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Created</th>
                  <th className="text-left px-4 py-3 font-medium text-hos-text-muted">Expires</th>
                  <th className="text-right px-4 py-3 font-medium text-hos-text-muted">Txns</th>
                </tr>
              </thead>
              <tbody>
                {giftCards.map((gc) => (
                  <Fragment key={gc.id}>
                    <tr
                      className={`border-b border-hos-border hover:bg-hos-bg-tertiary/50 cursor-pointer transition-colors ${expandedId === gc.id ? 'bg-hos-bg-tertiary/30' : ''}`}
                      onClick={() => handleToggleRow(gc.id)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-hos-text-primary">{maskCode(gc.code)}</td>
                      <td className="px-4 py-3 capitalize text-hos-text-secondary">{gc.type}</td>
                      <td className="px-4 py-3 text-right text-hos-text-secondary">{formatCurrency(Number(gc.amount), gc.currency)}</td>
                      <td className="px-4 py-3 text-right text-hos-text-primary font-medium">{formatCurrency(Number(gc.balance), gc.currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${statusBadge(gc.status)}`}>
                          {gc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-hos-text-secondary">
                        {gc.issuedToName || gc.issuedToEmail ? (
                          <div className="leading-tight">
                            {gc.issuedToName && <div className="text-hos-text-primary">{gc.issuedToName}</div>}
                            {gc.issuedToEmail && <div className="text-xs text-hos-text-muted">{gc.issuedToEmail}</div>}
                          </div>
                        ) : (
                          <span className="text-hos-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-hos-text-muted">{formatDate(gc.createdAt)}</td>
                      <td className="px-4 py-3 text-hos-text-muted">{formatDate(gc.expiresAt)}</td>
                      <td className="px-4 py-3 text-right text-hos-text-muted">{gc.transactionCount}</td>
                    </tr>
                    {expandedId === gc.id && (
                      <tr>
                        <td colSpan={9} className="bg-hos-bg-tertiary/40 px-6 py-4">
                          <h4 className="text-sm font-semibold text-hos-text-primary mb-3">Transaction History</h4>
                          {loadingTx ? (
                            <div className="flex items-center gap-2 text-hos-text-muted text-sm py-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-hos-gold"></div>
                              Loading transactions...
                            </div>
                          ) : transactions.length === 0 ? (
                            <p className="text-sm text-hos-text-muted">No transactions found.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-hos-border">
                                  <th className="text-left px-3 py-2 font-medium text-hos-text-muted">Type</th>
                                  <th className="text-right px-3 py-2 font-medium text-hos-text-muted">Amount</th>
                                  <th className="text-right px-3 py-2 font-medium text-hos-text-muted">Balance After</th>
                                  <th className="text-left px-3 py-2 font-medium text-hos-text-muted">Order</th>
                                  <th className="text-left px-3 py-2 font-medium text-hos-text-muted">Notes</th>
                                  <th className="text-left px-3 py-2 font-medium text-hos-text-muted">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {transactions.map((tx) => (
                                  <tr key={tx.id} className="border-b border-hos-border/50">
                                    <td className="px-3 py-2">
                                      <span className={`inline-block px-1.5 py-0.5 text-xs font-semibold rounded ${
                                        tx.type === 'PURCHASE' ? 'bg-green-500/15 text-green-300' :
                                        tx.type === 'REDEMPTION' ? 'bg-blue-500/15 text-blue-300' :
                                        tx.type === 'REFUND' ? 'bg-yellow-500/15 text-yellow-300' :
                                        'bg-gray-500/15 text-gray-300'
                                      }`}>
                                        {tx.type}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-hos-text-secondary">
                                      {formatCurrency(Number(tx.amount), gc.currency)}
                                    </td>
                                    <td className="px-3 py-2 text-right text-hos-text-secondary">
                                      {formatCurrency(Number(tx.balanceAfter), gc.currency)}
                                    </td>
                                    <td className="px-3 py-2 text-hos-text-muted">
                                      {tx.order?.orderNumber || tx.order?.id?.slice(0, 8) || '—'}
                                    </td>
                                    <td className="px-3 py-2 text-hos-text-muted">{tx.notes || '—'}</td>
                                    <td className="px-3 py-2 text-hos-text-muted">{formatDate(tx.createdAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-hos-border">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-hos-text-muted">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-sm rounded-lg border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}

