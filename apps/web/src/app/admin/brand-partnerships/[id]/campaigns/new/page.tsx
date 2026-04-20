'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminBrandCampaignNewPage() {
  const params = useParams();
  const partnershipId = String(params.id);
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState('MULTIPLIER');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [multiplier, setMultiplier] = useState('2');
  const [bonusPoints, setBonusPoints] = useState('');
  const [targetFandoms, setTargetFandoms] = useState('');
  const [targetBrands, setTargetBrands] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !startsAt || !endsAt) {
      toast.error('Name and dates required');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        type,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      };
      if (type === 'MULTIPLIER' && multiplier) body.multiplier = parseFloat(multiplier);
      if (type === 'BONUS_POINTS' && bonusPoints) body.bonusPoints = parseInt(bonusPoints, 10);
      const tf = targetFandoms
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const tb = targetBrands
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (tf.length) body.targetFandoms = tf;
      if (tb.length) body.targetBrands = tb;

      const r = await apiClient.adminCreateBrandCampaign(partnershipId, body);
      const cid = (r.data as Record<string, unknown>)?.id;
      toast.success('Campaign created');
      router.push(
        cid ? `/admin/brand-partnerships/campaigns/${cid}` : `/admin/brand-partnerships/${partnershipId}`,
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="p-6 max-w-xl mx-auto space-y-4">
          <Link href={`/admin/brand-partnerships/${partnershipId}`} className="text-violet-700 text-sm">
            ← Partner
          </Link>
          <h1 className="text-2xl font-semibold text-gray-900">New brand campaign</h1>
          <label className="block text-sm">
            <span className="text-gray-700">Name</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Type</span>
            <select
              className="mt-1 w-full border rounded px-3 py-2"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="MULTIPLIER">MULTIPLIER</option>
              <option value="BONUS_POINTS">BONUS_POINTS</option>
              <option value="EXCLUSIVE_PRODUCT">EXCLUSIVE_PRODUCT</option>
              <option value="SPONSORED_EVENT">SPONSORED_EVENT</option>
            </select>
          </label>
          {type === 'MULTIPLIER' && (
            <label className="block text-sm">
              <span className="text-gray-700">Multiplier</span>
              <input
                type="number"
                step="0.1"
                className="mt-1 w-full border rounded px-3 py-2"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
              />
            </label>
          )}
          {type === 'BONUS_POINTS' && (
            <label className="block text-sm">
              <span className="text-gray-700">Bonus points</span>
              <input
                type="number"
                className="mt-1 w-full border rounded px-3 py-2"
                value={bonusPoints}
                onChange={(e) => setBonusPoints(e.target.value)}
              />
            </label>
          )}
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
            <span className="text-gray-700">Target fandoms (comma-separated)</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={targetFandoms}
              onChange={(e) => setTargetFandoms(e.target.value)}
              placeholder="Harry Potter, LOTR"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-700">Target brands (comma-separated)</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={targetBrands}
              onChange={(e) => setTargetBrands(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-violet-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create draft'}
          </button>
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
