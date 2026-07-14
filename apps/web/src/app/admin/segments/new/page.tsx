'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { RuleBuilder, emptyGroup, type SegmentRuleGroup } from '../RuleBuilder';

export default function AdminSegmentNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<SegmentRuleGroup>(() => emptyGroup());
  const [preview, setPreview] = useState<{ count: number; sampleUsers: any[] } | null>(null);
  const [saving, setSaving] = useState(false);

  const runPreview = useCallback((g: SegmentRuleGroup) => {
    apiClient
      .adminPreviewSegment({ rules: g })
      .then((r) => setPreview(r.data as any))
      .catch(() => setPreview(null));
  }, []);

  const save = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      await apiClient.adminCreateSegment({
        name: name.trim(),
        description: description.trim() || undefined,
        rules,
        type: 'DYNAMIC',
        status: 'ACTIVE',
      });
      toast.success('Segment created');
      router.push('/admin/segments');
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Link href="/admin/segments" className="text-hos-gold hover:underline text-sm">
            ← Segments
          </Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">Create segment</h1>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Name</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Description</span>
            <textarea
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div>
            <h2 className="text-sm font-medium text-hos-text-secondary mb-2">Rules</h2>
            <RuleBuilder value={rules} onChange={setRules} onPreview={runPreview} />
          </div>
          {preview && (
            <div className="rounded-lg border bg-hos-bg-secondary p-3 text-sm">
              <p className="font-medium text-hos-text-secondary">Preview: ~{preview.count} members</p>
              <ul className="mt-2 text-hos-text-secondary list-disc list-inside">
                {(preview.sampleUsers || []).map((u: any) => (
                  <li key={u.id}>
                    {u.email || u.id} — {u.tier || '—'} — {u.country || '—'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-hos-gold px-4 py-2 text-white text-sm hover:bg-hos-gold/100 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save segment'}
          </button>
        </div>
          </RouteGuard>
  );
}
