'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DataExport } from '@/components/DataExport';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { flattenLedgerRow, LEDGER_EXPORT_COLUMNS } from '@/lib/loyaltyLedgerExport';

const EXPORT_PAGE_SIZE = 200;

export default function AdminLoyaltyMemberLedgerPage() {
  const params = useParams();
  const userId = String(params?.userId || '');
  const toast = useToast();
  const [instruments, setInstruments] = useState<any>(null);
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [adjustDelta, setAdjustDelta] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const instRes = await apiClient.adminGetLoyaltyMemberInstruments(userId);
      setInstruments(instRes?.data ?? null);
      const membershipId = (instRes?.data as any)?.membership?.id;
      if (membershipId) {
        const txRes = await apiClient.adminGetLoyaltyTransactions(membershipId, {
          type: type || undefined,
          limit: 100,
        });
        setTxs(Array.isArray(txRes?.data) ? (txRes.data as any[]) : []);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load member');
    } finally {
      setLoading(false);
    }
  }, [userId, type, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const membershipId = instruments?.membership?.id as string | undefined;

  const fetchAllForExport = useCallback(async () => {
    if (!membershipId) return [];
    const all: any[] = [];
    let page = 1;
    let pages = 1;
    do {
      const res = await apiClient.adminGetLoyaltyTransactions(membershipId, {
        type: type || undefined,
        page,
        limit: EXPORT_PAGE_SIZE,
      });
      all.push(...(Array.isArray(res?.data) ? (res.data as any[]) : []));
      pages = Math.max(1, (res as any)?.pagination?.totalPages ?? 1);
      page += 1;
    } while (page <= pages);
    return all.map(flattenLedgerRow);
  }, [membershipId, type]);

  const exportRows = useMemo(() => txs.map(flattenLedgerRow), [txs]);

  const adjust = async () => {
    try {
      await apiClient.adminAdjustLoyaltyPoints(userId, Number(adjustDelta), adjustReason || 'Admin adjust');
      toast.success('Points adjusted');
      setAdjustDelta('0');
      setAdjustReason('');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Adjust failed');
    }
  };

  const m = instruments?.membership;

  return (
    <RouteGuard allowedRoles={['ADMIN']} showAccessDenied>
      <div className="mb-4">
        <Link href="/admin/loyalty/members" className="text-sm text-hos-gold font-ui">
          ← Members
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-hos-text-primary mb-1">Member ledger</h1>
      <p className="text-hos-text-secondary text-sm font-ui mb-6">
        {m?.user?.email || userId}
      </p>

      {loading ? (
        <p className="text-hos-text-secondary">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Balance</p>
              <p className="text-lg text-hos-text-primary font-ui">{m?.currentBalance ?? 0} pts</p>
            </div>
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Total earned</p>
              <p className="text-lg text-hos-text-primary font-ui">{m?.totalPointsEarned ?? 0}</p>
            </div>
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Tier</p>
              <p className="text-lg text-hos-text-primary font-ui">{m?.tier?.name || '—'}</p>
            </div>
            <div className="p-3 border border-hos-border rounded bg-hos-bg-secondary">
              <p className="text-xs text-hos-text-secondary font-ui">Active HOS GCs</p>
              <p className="text-lg text-hos-text-primary font-ui">
                {(instruments?.giftCards || []).length}
              </p>
            </div>
          </div>

          <div className="mb-6 p-4 border border-hos-border rounded-lg bg-hos-bg-secondary flex flex-wrap gap-2 items-end">
            <label className="text-sm text-hos-text-secondary font-ui">
              Delta
              <input
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                className="block mt-1 px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
              />
            </label>
            <label className="text-sm text-hos-text-secondary font-ui flex-1 min-w-[200px]">
              Reason
              <input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="block mt-1 w-full px-3 py-2 bg-hos-bg border border-hos-border-input rounded text-hos-text-primary"
              />
            </label>
            <button
              type="button"
              onClick={adjust}
              className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded font-semibold text-sm"
            >
              Adjust
            </button>
          </div>

          <div className="mb-3 flex gap-2 items-center">
            <h2 className="text-lg text-hos-gold font-display">Transactions</h2>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="ml-auto px-2 py-1 bg-hos-bg border border-hos-border-input rounded text-sm text-hos-text-primary"
            >
              <option value="">All types</option>
              {['EARN', 'BURN', 'EXPIRE', 'ADJUST', 'BONUS', 'TRANSFER'].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <DataExport
              data={exportRows}
              columns={LEDGER_EXPORT_COLUMNS}
              filename={`loyalty-ledger-${m?.user?.email || userId}`}
              resolveData={fetchAllForExport}
              showJson={false}
            />
          </div>

          <div className="overflow-x-auto border border-hos-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-hos-bg-secondary text-hos-text-secondary font-ui">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Points</th>
                  <th className="px-3 py-2 text-left">Channel</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Description</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id} className="border-t border-hos-border text-hos-text-primary">
                    <td className="px-3 py-2 font-ui text-xs">
                      {t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 font-ui text-xs">{t.type}</td>
                    <td className="px-3 py-2 font-ui">{t.points}</td>
                    <td className="px-3 py-2 font-ui text-xs">{t.channel}</td>
                    <td className="px-3 py-2 font-ui text-xs">{t.source}</td>
                    <td className="px-3 py-2 font-ui text-xs">{t.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(instruments?.posVouchers || []).length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg text-hos-gold font-display mb-2">POS vouchers</h2>
              <ul className="space-y-1 text-sm font-ui text-hos-text-secondary">
                {instruments.posVouchers.map((v: any) => (
                  <li key={v.id}>
                    {v.status} · {v.currency} {Number(v.amount).toFixed(2)} ·{' '}
                    {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </RouteGuard>
  );
}
