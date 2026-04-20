'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

const defaultSteps = `[
  { "stepIndex": 0, "type": "SEND", "channel": "EMAIL", "templateSlug": "welcome_loyalty" }
]`;

export default function AdminJourneyNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('LOYALTY_WELCOME');
  const [description, setDescription] = useState('');
  const [stepsJson, setStepsJson] = useState(defaultSteps);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    let steps: unknown;
    try {
      steps = JSON.parse(stepsJson);
    } catch {
      toast.error('Steps must be valid JSON');
      return;
    }
    if (!slug.trim() || !name.trim()) {
      toast.error('Slug and name are required');
      return;
    }
    setSaving(true);
    try {
      await apiClient.adminCreateJourney({
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        triggerEvent: triggerEvent.trim(),
        steps,
        isActive: true,
      });
      toast.success('Journey created');
      router.push('/admin/journeys');
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
          <Link href="/admin/journeys" className="text-indigo-600 hover:underline text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">New journey</h1>
          <label className="block text-sm">
            <span className="text-gray-700">Slug</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-journey"
            />
          </label>
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
          <label className="block text-sm">
            <span className="text-gray-700">Steps (JSON array)</span>
            <textarea
              className="mt-1 w-full border rounded px-3 py-2 font-mono text-xs"
              rows={14}
              value={stepsJson}
              onChange={(e) => setStepsJson(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
