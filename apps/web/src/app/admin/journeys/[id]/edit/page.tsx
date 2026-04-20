'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminJourneyEditPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [stepsJson, setStepsJson] = useState('[]');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .adminGetJourney(id)
      .then((r: any) => {
        const j = r.data?.journey;
        if (j) {
          setName(j.name || '');
          setTriggerEvent(j.triggerEvent || '');
          setDescription(j.description || '');
          setIsActive(j.isActive ?? true);
          setStepsJson(JSON.stringify(j.steps, null, 2));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    let steps: unknown;
    try {
      steps = JSON.parse(stepsJson);
    } catch {
      toast.error('Steps must be valid JSON');
      return;
    }
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await apiClient.adminUpdateJourney(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        triggerEvent: triggerEvent.trim(),
        steps,
        isActive,
      });
      toast.success('Journey updated');
      router.push(`/admin/journeys/${id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          <Link href={`/admin/journeys/${id}`} className="text-indigo-600 hover:underline text-sm">
            ← Back to detail
          </Link>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              <h1 className="text-2xl font-semibold text-gray-900">Edit journey</h1>
              <label className="block text-sm">
                <span className="text-gray-700">Name</span>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Trigger event</span>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Description</span>
                <textarea
                  className="mt-1 w-full border rounded px-3 py-2"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-gray-700">Active</span>
              </label>
              <label className="block text-sm">
                <span className="text-gray-700">Steps (JSON array)</span>
                <textarea
                  className="mt-1 w-full border rounded px-3 py-2 font-mono text-xs"
                  rows={16}
                  value={stepsJson}
                  onChange={(e) => setStepsJson(e.target.value)}
                />
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={save}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50 hover:bg-indigo-700"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <Link
                  href={`/admin/journeys/${id}`}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Link>
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
