'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type Tab = 'details' | 'rsvps' | 'attendance' | 'stats';

export default function AdminEventDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [att, setAtt] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('details');
  const [loading, setLoading] = useState(true);
  const [checkUserId, setCheckUserId] = useState('');
  const [checkTicket, setCheckTicket] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .adminGetEvent(id)
      .then((r) => setData(r.data))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id || tab !== 'rsvps') return;
    apiClient.adminGetEventRsvps(id).then((r) => setRsvps((r.data as any[]) || []));
  }, [id, tab]);

  useEffect(() => {
    if (!id || tab !== 'attendance') return;
    apiClient.adminGetEventAttendances(id).then((r) => setAtt((r.data as any[]) || []));
  }, [id, tab]);

  useEffect(() => {
    if (!id || tab !== 'stats') return;
    apiClient.adminGetEventStats(id).then((r) => setStats(r.data));
  }, [id, tab]);

  const event = data?.event;
  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={`px-3 py-2 text-sm border-b-2 ${
        tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'
      }`}
    >
      {label}
    </button>
  );

  const staffCheckIn = async () => {
    try {
      await apiClient.adminCheckInEvent(id, {
        userId: checkUserId.trim() || undefined,
        ticketCode: checkTicket.trim() || undefined,
      });
      toast.success('Checked in');
      setCheckUserId('');
      setCheckTicket('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-5xl mx-auto space-y-4">
          <div className="flex gap-4 items-center">
            <Link href="/admin/events" className="text-indigo-600 hover:underline text-sm">
              ← Back
            </Link>
            {event && (
              <Link
                href={`/admin/events/${id}/edit`}
                className="ml-auto rounded-md bg-indigo-600 px-3 py-1.5 text-white text-sm"
              >
                Edit
              </Link>
            )}
          </div>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : !event ? (
            <p className="text-red-600">Not found</p>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900">{event.title}</h1>
              <p className="text-sm text-gray-600">
                {event.status} · {event.slug} · {new Date(event.startsAt).toLocaleString()}
              </p>
              <div className="flex gap-2 border-b border-gray-200">
                {tabBtn('details', 'Details')}
                {tabBtn('rsvps', 'RSVPs')}
                {tabBtn('attendance', 'Attendance')}
                {tabBtn('stats', 'Stats')}
              </div>
              {tab === 'details' && (
                <div className="space-y-4 text-sm">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto max-h-64">
                    {JSON.stringify(event, null, 2)}
                  </pre>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiClient.adminPublishEvent(id);
                          toast.success('Published');
                          load();
                        } catch (e: any) {
                          toast.error(e?.message || 'Failed');
                        }
                      }}
                      className="rounded bg-green-600 text-white px-3 py-1.5"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await apiClient.adminCompleteEvent(id);
                          toast.success('Completed');
                          load();
                        } catch (e: any) {
                          toast.error(e?.message || 'Failed');
                        }
                      }}
                      className="rounded bg-gray-700 text-white px-3 py-1.5"
                    >
                      Complete
                    </button>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <p className="font-medium">Staff check-in</p>
                    <input
                      className="border rounded px-2 py-1 w-full max-w-xs"
                      placeholder="User ID"
                      value={checkUserId}
                      onChange={(e) => setCheckUserId(e.target.value)}
                    />
                    <input
                      className="border rounded px-2 py-1 w-full max-w-xs block"
                      placeholder="Ticket code"
                      value={checkTicket}
                      onChange={(e) => setCheckTicket(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={staffCheckIn}
                      className="rounded bg-indigo-600 text-white px-3 py-1.5 text-sm"
                    >
                      Check in
                    </button>
                  </div>
                </div>
              )}
              {tab === 'rsvps' && (
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">User</th>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Ticket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-1">{r.user?.email ?? r.userId}</td>
                        <td className="px-2 py-1">{r.status}</td>
                        <td className="px-2 py-1 font-mono text-xs">{r.ticketCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'attendance' && (
                <table className="min-w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left">User</th>
                      <th className="px-2 py-1">Points</th>
                      <th className="px-2 py-1">At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {att.map((a) => (
                      <tr key={a.id} className="border-t">
                        <td className="px-2 py-1">{a.user?.email ?? a.userId}</td>
                        <td className="px-2 py-1">{a.pointsAwarded}</td>
                        <td className="px-2 py-1">{new Date(a.checkedInAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {tab === 'stats' && stats && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div className="border rounded p-3">
                    <p className="text-gray-500">Confirmed RSVPs</p>
                    <p className="text-xl font-semibold">{stats.rsvpConfirmed}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-gray-500">Attended</p>
                    <p className="text-xl font-semibold">{stats.attended}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-gray-500">No-show</p>
                    <p className="text-xl font-semibold">{stats.noShow}</p>
                  </div>
                  <div className="border rounded p-3">
                    <p className="text-gray-500">Points awarded</p>
                    <p className="text-xl font-semibold">{stats.totalPointsAwarded}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
