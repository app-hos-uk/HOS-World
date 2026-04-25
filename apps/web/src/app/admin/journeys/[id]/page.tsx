'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type TabId = 'details' | 'enrollments';

export default function AdminJourneyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();
  const [data, setData] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('details');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .adminGetJourney(id)
      .then((r) => setData(r.data))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to load journey'))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const loadEnrollments = useCallback(() => {
    if (!id) return;
    apiClient
      .adminGetJourneyEnrollments(id)
      .then((r) => setEnrollments(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEnrollments([]));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'enrollments') loadEnrollments();
  }, [tab, loadEnrollments]);

  const triggerManual = async () => {
    if (!userId.trim()) {
      toast.error('Enter a user ID');
      return;
    }
    try {
      await apiClient.adminTriggerJourney(id, { userId: userId.trim() });
      toast.success('Trigger sent');
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    }
  };

  const journey = data?.journey;
  const stats = data?.stats;

  const tabClasses = (t: TabId) =>
    `px-4 py-2 text-sm font-medium border-b-2 ${
      tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/journeys" className="text-indigo-600 hover:underline text-sm">
              ← Back
            </Link>
            {journey && (
              <Link
                href={`/admin/journeys/${id}/edit`}
                className="ml-auto rounded-md bg-indigo-600 px-4 py-2 text-white text-sm hover:bg-indigo-700"
              >
                Edit journey
              </Link>
            )}
          </div>

          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : !journey ? (
            <p className="text-red-600">Not found</p>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900">{journey.name}</h1>
              <p className="text-gray-600 text-sm">{journey.description}</p>

              <div className="flex gap-2 border-b border-gray-200">
                <button type="button" className={tabClasses('details')} onClick={() => setTab('details')}>
                  Details
                </button>
                <button type="button" className={tabClasses('enrollments')} onClick={() => setTab('enrollments')}>
                  Enrollments {stats ? `(${stats.active + stats.completed + stats.cancelled})` : ''}
                </button>
              </div>

              {tab === 'details' && (
                <>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-gray-500">Slug</dt>
                    <dd>{journey.slug}</dd>
                    <dt className="text-gray-500">Trigger</dt>
                    <dd>{journey.triggerEvent}</dd>
                    <dt className="text-gray-500">Active</dt>
                    <dd>{journey.isActive ? 'Yes' : 'No'}</dd>
                  </dl>
                  {stats && (
                    <div className="rounded-lg border border-gray-200 p-4 bg-gray-50 text-sm">
                      <p>
                        Active: {stats.active} · Completed: {stats.completed} · Cancelled: {stats.cancelled} ·
                        Messages: {stats.messages}
                      </p>
                    </div>
                  )}
                  <div>
                    <h2 className="font-medium mb-2">Steps (JSON)</h2>
                    <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto max-h-96">
                      {JSON.stringify(journey.steps, null, 2)}
                    </pre>
                  </div>
                  <div className="border-t pt-4">
                    <h2 className="font-medium mb-2">Manual trigger</h2>
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
                        placeholder="User ID (UUID)"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={triggerManual}
                        className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm"
                      >
                        Enroll user
                      </button>
                    </div>
                  </div>
                </>
              )}

              {tab === 'enrollments' && (
                <div className="overflow-x-auto">
                  {enrollments.length === 0 ? (
                    <p className="text-sm text-gray-500">No enrollments yet.</p>
                  ) : (
                    <table className="min-w-full text-sm border border-gray-200">
                      <thead className="bg-gray-50 text-left text-gray-600">
                        <tr>
                          <th className="px-3 py-2 border-b">User ID</th>
                          <th className="px-3 py-2 border-b">Status</th>
                          <th className="px-3 py-2 border-b">Step</th>
                          <th className="px-3 py-2 border-b">Started</th>
                          <th className="px-3 py-2 border-b">Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {enrollments.map((e: any) => (
                          <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-xs">{e.userId?.slice(0, 8)}…</td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                  e.status === 'ACTIVE'
                                    ? 'bg-green-100 text-green-700'
                                    : e.status === 'COMPLETED'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {e.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">{e.currentStep}</td>
                            <td className="px-3 py-2">{e.startedAt ? new Date(e.startedAt).toLocaleDateString() : '—'}</td>
                            <td className="px-3 py-2">
                              {e.completedAt ? new Date(e.completedAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
