'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminEventNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('IN_STORE');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [minTierLevel, setMinTierLevel] = useState(0);
  const [attendancePoints, setAttendancePoints] = useState(100);
  const [storeId, setStoreId] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim() || !startsAt || !endsAt) {
      toast.error('Title and dates required');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        type,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        minTierLevel,
        attendancePoints,
        description: description.trim() || undefined,
      };
      if (storeId.trim()) body.storeId = storeId.trim();
      const r = await apiClient.adminCreateEvent(body);
      const id = (r.data as any)?.id;
      toast.success('Created');
      router.push(id ? `/admin/events/${id}` : '/admin/events');
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
          <Link href="/admin/events" className="text-indigo-600 hover:underline text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">New event</h1>
          <label className="block text-sm">
            <span className="text-gray-700">Title</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Type</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="IN_STORE">IN_STORE</option>
              <option value="VIRTUAL">VIRTUAL</option>
              <option value="HYBRID">HYBRID</option>
              <option value="PRODUCT_LAUNCH">PRODUCT_LAUNCH</option>
              <option value="FAN_MEETUP">FAN_MEETUP</option>
              <option value="VIP_EXPERIENCE">VIP_EXPERIENCE</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Starts (local)</span>
            <input
              type="datetime-local"
              className="mt-1 w-full border rounded px-3 py-2"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Ends (local)</span>
            <input
              type="datetime-local"
              className="mt-1 w-full border rounded px-3 py-2"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Min tier level (0 = any)</span>
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
          <label className="block text-sm">
            <span className="text-gray-700">Store ID (optional)</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 font-mono text-xs"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              placeholder="UUID"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Description</span>
            <textarea
              className="mt-1 w-full border rounded px-3 py-2"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create draft'}
          </button>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
