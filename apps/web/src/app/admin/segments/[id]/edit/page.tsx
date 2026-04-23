'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { RuleBuilder, hydrateKeys, type SegmentRuleGroup } from '../../RuleBuilder';

export default function AdminSegmentEditPage() {
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<SegmentRuleGroup | null>(null);
  const [preview, setPreview] = useState<{ count: number; sampleUsers: any[] } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .adminGetSegment(id)
      .then((r) => {
        const s = r.data as any;
        setName(s.name);
        setDescription(s.description || '');
        setRules(hydrateKeys(s.rules));
      })
      .catch((e: any) => toast.error(e?.message || 'Failed'));
  }, [id, toast]);

  const runPreview = useCallback((g: SegmentRuleGroup) => {
    apiClient
      .adminPreviewSegment({ rules: g })
      .then((r) => setPreview(r.data as any))
      .catch(() => setPreview(null));
  }, []);

  const save = async () => {
    if (!rules) return;
    setSaving(true);
    try {
      await apiClient.adminUpdateSegment(id, {
        name: name.trim(),
        description: description.trim() || null,
        rules,
      });
      toast.success('Saved');
      router.push(`/admin/segments/${id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!rules) {
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
        <div className="p-6 max-w-4xl mx-auto space-y-4">
          <Link href={`/admin/segments/${id}`} className="text-indigo-600 hover:underline text-sm">
            ← Back
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">Edit segment</h1>
          <label className="block text-sm">
            <span className="text-gray-700">Name</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
          <div>
            <h2 className="text-sm font-medium text-gray-800 mb-2">Rules</h2>
            <RuleBuilder value={rules} onChange={setRules} onPreview={runPreview} />
          </div>
          {preview && (
            <div className="rounded-lg border bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">Preview: ~{preview.count} members</p>
            </div>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white text-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
