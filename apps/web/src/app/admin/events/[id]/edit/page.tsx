'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import {
  EMPTY_EVENT_EXTRAS,
  EventExtrasFields,
  buildEventExtraBody,
  readEventExtras,
  type EventExtras,
} from '../../EventExtrasFields';

const inputClass =
  'mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

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
  const [extras, setExtras] = useState<EventExtras>(EMPTY_EVENT_EXTRAS);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiClient
      .adminGetEvent(id)
      .then((r) => {
        const ev = (r.data as { event?: Record<string, unknown> } | undefined)?.event;
        if (ev) {
          setTitle(typeof ev.title === 'string' ? ev.title : '');
          setDescription(typeof ev.description === 'string' ? ev.description : '');
          setMinTierLevel(typeof ev.minTierLevel === 'number' ? ev.minTierLevel : 0);
          setExtras(readEventExtras(ev));
        }
      })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [id, toast]);

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
        ...buildEventExtraBody(extras, 'update'),
      });
      toast.success('Saved');
      router.push(`/admin/events/${id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="p-6 max-w-xl mx-auto space-y-4">
        <Link href={`/admin/events/${id}`} className="text-hos-gold hover:underline text-sm">
          ← Detail
        </Link>
        {loading ? (
          <p className="text-hos-text-muted">Loading…</p>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-hos-text-secondary">Edit event</h1>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Title</span>
              <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <EventExtrasFields
              values={extras}
              onChange={(patch) => setExtras((current) => ({ ...current, ...patch }))}
            />
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Description</span>
              <textarea
                className={inputClass}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="text-hos-text-secondary">Min tier level</span>
              <input
                type="number"
                className={inputClass}
                value={minTierLevel}
                onChange={(e) => setMinTierLevel(parseInt(e.target.value, 10) || 0)}
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="rounded-md bg-hos-gold px-4 py-2 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
    </RouteGuard>
  );
}
