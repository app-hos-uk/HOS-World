'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import {
  EMPTY_EVENT_EXTRAS,
  EventExtrasFields,
  buildEventExtraBody,
  type EventExtras,
} from '../EventExtrasFields';

const inputClass =
  'mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

export default function AdminEventNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [minTierLevel, setMinTierLevel] = useState(0);
  const [storeId, setStoreId] = useState('');
  const [description, setDescription] = useState('');
  const [extras, setExtras] = useState<EventExtras>(EMPTY_EVENT_EXTRAS);
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
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        minTierLevel,
        description: description.trim() || undefined,
        ...buildEventExtraBody(extras, 'create'),
      };
      if (storeId.trim()) body.storeId = storeId.trim();
      const r = await apiClient.adminCreateEvent(body);
      const id = (r.data as { id?: string } | undefined)?.id;
      toast.success('Created');
      router.push(id ? `/admin/events/${id}` : '/admin/events');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <Link href="/admin/events" className="text-hos-gold hover:underline text-sm">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold text-hos-text-secondary">New event</h1>
        <label className="block text-sm">
          <span className="text-hos-text-secondary">Title</span>
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <EventExtrasFields
          values={extras}
          onChange={(patch) => setExtras((current) => ({ ...current, ...patch }))}
        >
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Starts (local)</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Ends (local)</span>
            <input
              type="datetime-local"
              className={inputClass}
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
        </EventExtrasFields>
        <label className="block text-sm">
          <span className="text-hos-text-secondary">Min tier level (0 = any)</span>
          <input
            type="number"
            className={inputClass}
            value={minTierLevel}
            onChange={(e) => setMinTierLevel(parseInt(e.target.value, 10) || 0)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-hos-text-secondary">Store ID (optional)</span>
          <input
            className={`${inputClass} font-mono text-xs`}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            placeholder="UUID"
          />
        </label>
        <label className="block text-sm">
          <span className="text-hos-text-secondary">Description</span>
          <textarea
            className={inputClass}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-md bg-hos-gold px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Create draft'}
        </button>
      </div>
    </RouteGuard>
  );
}
