'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type Tab = 'overview' | 'members' | 'broadcast';

export default function AdminSegmentDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [seg, setSeg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberPage, setMemberPage] = useState(1);
  const [search, setSearch] = useState('');
  const [channels, setChannels] = useState<string[]>(['EMAIL']);
  const [templateSlug, setTemplateSlug] = useState('welcome_loyalty');
  const [subject, setSubject] = useState('');
  const [broadcastLimit, setBroadcastLimit] = useState(500);

  const loadSeg = useCallback(() => {
    apiClient
      .adminGetSegment(id)
      .then((r) => setSeg(r.data))
      .catch((e: any) => toast.error(e?.message || 'Failed'));
  }, [id, toast]);

  const loadMembers = useCallback(() => {
    apiClient
      .adminGetSegmentMembers(id, { page: memberPage, limit: 20, search: search || undefined })
      .then((r) => {
        const d = r.data as { items?: any[]; total?: number };
        setMembers(d?.items || []);
        setMemberTotal(d?.total ?? 0);
      })
      .catch((e: any) => toast.error(e?.message || 'Failed'));
  }, [id, memberPage, search, toast]);

  useEffect(() => {
    loadSeg();
  }, [loadSeg]);

  useEffect(() => {
    if (tab === 'members') loadMembers();
  }, [tab, loadMembers]);

  const refresh = async () => {
    try {
      await apiClient.adminRefreshSegment(id);
      toast.success('Refreshed');
      loadSeg();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  const archive = async () => {
    if (!confirm('Archive segment?')) return;
    try {
      await apiClient.adminArchiveSegment(id);
      toast.success('Archived');
      loadSeg();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  const sendBroadcast = async () => {
    if (!confirm(`Send to up to ${broadcastLimit} members?`)) return;
    try {
      const r = await apiClient.adminBroadcastToSegment(id, {
        channels,
        templateSlug,
        subject: subject || undefined,
        limit: broadcastLimit,
      });
      const d = r.data as any;
      toast.success(`Sent ${d?.sent ?? 0} (targeted ${d?.targeted ?? 0})`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  if (!seg) {
    return (
      <RouteGuard allowedRoles={['ADMIN']}>
        <AdminLayout>
          <div className="p-6">Loading…</div>
        </AdminLayout>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <Link href="/admin/segments" className="text-indigo-600 hover:underline text-sm">
                ← Segments
              </Link>
              <h1 className="text-2xl font-semibold text-gray-900 mt-1">{seg.name}</h1>
              <p className="text-gray-600 text-sm mt-1">{seg.description || '—'}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/admin/segments/${id}/edit`}
                className="rounded-md border px-3 py-1.5 text-sm text-gray-800"
              >
                Edit
              </Link>
              {seg.status !== 'ARCHIVED' && (
                <>
                  <button
                    type="button"
                    onClick={refresh}
                    className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white"
                  >
                    Refresh now
                  </button>
                  <button
                    type="button"
                    onClick={archive}
                    className="rounded-md border border-red-200 text-red-700 px-3 py-1.5 text-sm"
                  >
                    Archive
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="flex gap-2 border-b">
            {(['overview', 'members', 'broadcast'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                className={`px-3 py-2 text-sm capitalize ${
                  tab === t ? 'border-b-2 border-indigo-600 text-indigo-700' : 'text-gray-600'
                }`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 bg-white">
                <p className="text-sm text-gray-500">Members</p>
                <p className="text-2xl font-semibold">{seg.members ?? seg.memberCount ?? 0}</p>
              </div>
              <div className="rounded-lg border p-4 bg-white">
                <p className="text-sm text-gray-500">Last evaluated</p>
                <p className="text-lg">
                  {seg.lastEvaluatedAt ? new Date(seg.lastEvaluatedAt).toLocaleString() : '—'}
                </p>
              </div>
              <div className="md:col-span-2 rounded-lg border p-4 bg-white">
                <p className="text-sm text-gray-500 mb-2">Rules (JSON)</p>
                <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                  {JSON.stringify(seg.rules, null, 2)}
                </pre>
              </div>
            </div>
          )}
          {tab === 'members' && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  className="border rounded px-3 py-1.5 text-sm"
                  placeholder="Search name / email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button
                  type="button"
                  className="text-sm text-indigo-600"
                  onClick={() => {
                    setMemberPage(1);
                    loadMembers();
                  }}
                >
                  Search
                </button>
                <span className="text-sm text-gray-500">{memberTotal} total</span>
              </div>
              <table className="min-w-full text-sm border rounded bg-white">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Points</th>
                    <th className="px-3 py-2">Country</th>
                    <th className="px-3 py-2">Joined segment</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.userId} className="border-t">
                      <td className="px-3 py-2">
                        {m.firstName} {m.lastName}
                      </td>
                      <td className="px-3 py-2">{m.email}</td>
                      <td className="px-3 py-2">{m.tierName}</td>
                      <td className="px-3 py-2">{m.points}</td>
                      <td className="px-3 py-2">{m.country}</td>
                      <td className="px-3 py-2">{new Date(m.joinedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {memberTotal > 20 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={memberPage <= 1}
                    onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                    className="text-sm"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={memberPage * 20 >= memberTotal}
                    onClick={() => setMemberPage((p) => p + 1)}
                    className="text-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === 'broadcast' && (
            <div className="max-w-md space-y-3 rounded-lg border p-4 bg-white">
              <p className="text-sm font-medium">Channels</p>
              {['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'].map((ch) => (
                <label key={ch} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={channels.includes(ch)}
                    onChange={(e) => {
                      if (e.target.checked) setChannels([...channels, ch]);
                      else setChannels(channels.filter((c) => c !== ch));
                    }}
                  />
                  {ch}
                </label>
              ))}
              <label className="block text-sm">
                Template slug
                <input
                  className="mt-1 w-full border rounded px-2 py-1"
                  value={templateSlug}
                  onChange={(e) => setTemplateSlug(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Subject override
                <input
                  className="mt-1 w-full border rounded px-2 py-1"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Limit
                <input
                  type="number"
                  className="mt-1 w-full border rounded px-2 py-1"
                  value={broadcastLimit}
                  onChange={(e) => setBroadcastLimit(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                onClick={sendBroadcast}
                className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
