'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminEventEditPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minTierLevel, setMinTierLevel] = useState(0);
  const [attendancePoints, setAttendancePoints] = useState(100);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .adminGetEvent(id)
      .then((r) => {
        const ev = (r.data as any)?.event;
        if (ev) {
          setTitle(ev.title || '');
          setDescription(ev.description || '');
          setMinTierLevel(ev.minTierLevel ?? 0);
          setAttendancePoints(ev.attendancePoints ?? 100);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.adminUpdateEvent(id, {
        title: title.trim(),
        description: description.trim() || undefined,
        minTierLevel,
        attendancePoints,
      });
      toast.success('Saved');
      router.push(`/admin/events/${id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-xl mx-auto space-y-4">
          <Link href={`/admin/events/${id}`} className="text-indigo-600 hover:underline text-sm">
            ← Detail
          </Link>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900">Edit event</h1>
              <label className="block text-sm">
                <span className="text-gray-700">Title</span>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Description</span>
                <textarea
                  className="mt-1 w-full border rounded px-3 py-2"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Min tier level</span>
                <input
                  type="number"
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={minTierLevel}
                  onChange={(e) => setMinTierLevel(parseInt(e.target.value, 10) || 0)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Attendance points</span>
                <input
                  type="number"
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={attendancePoints}
                  onChange={(e) => setAttendancePoints(parseInt(e.target.value, 10) || 0)}
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
