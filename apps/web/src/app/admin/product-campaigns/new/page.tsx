'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import {
  isDateInputInPast,
  normalizeWhitespace,
  nowDateTimeLocalValue,
  validateNameLike,
} from '@/lib/formFieldValidation';

export default function AdminProductCampaignNewPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [bonusPoints, setBonusPoints] = useState('10');
  const [fandoms, setFandoms] = useState('');
  const [applyToAllProducts, setApplyToAllProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const save = async () => {
    const normalizedName = normalizeWhitespace(name);
    const nameErr = validateNameLike(normalizedName, 'Campaign name');
    setNameError(nameErr);
    if (nameErr) {
      toast.error(nameErr);
      return;
    }
    if (!startsAt || !endsAt) {
      toast.error('Name and dates required');
      return;
    }
    if (isDateInputInPast(startsAt)) {
      setStartError('Start date cannot be in the past');
      toast.error('Start date cannot be in the past');
      return;
    }
    setStartError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: normalizedName,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        bonusPoints: parseInt(bonusPoints, 10) || 0,
        type: 'BONUS_POINTS',
      };
      const tf = fandoms
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (tf.length) body.fandomFilter = tf;
      if (!tf.length && applyToAllProducts) body.applyToAllProducts = true;
      if (!tf.length && !applyToAllProducts) {
        toast.error('Add a fandom filter or check “Apply to all products”');
        setSaving(false);
        return;
      }
      const r = await apiClient.adminCreateProductCampaign(body);
      const cid = (r.data as Record<string, unknown>)?.id;
      toast.success('Created');
      router.push(cid ? `/admin/product-campaigns/${cid}` : '/admin/product-campaigns');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
              <div className="p-6 max-w-lg mx-auto space-y-4">
          <Link href="/admin/product-campaigns" className="text-sm text-violet-400">
            ← Campaigns
          </Link>
          <h1 className="text-2xl font-semibold text-hos-text-secondary">New product campaign</h1>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Name</span>
            <input
              className={`mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none ${
                nameError ? 'border-red-500' : 'border-hos-border'
              }`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              aria-invalid={!!nameError}
            />
            {nameError && (
              <span className="mt-1 block text-sm text-red-400" role="alert">{nameError}</span>
            )}
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Bonus points (per qualifying unit)</span>
            <input
              type="number"
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={bonusPoints}
              onChange={(e) => setBonusPoints(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Starts (local)</span>
            <input
              type="datetime-local"
              min={nowDateTimeLocalValue()}
              className={`mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none ${
                startError ? 'border-red-500' : 'border-hos-border'
              }`}
              value={startsAt}
              onChange={(e) => {
                setStartsAt(e.target.value);
                if (startError) setStartError(null);
              }}
              aria-invalid={!!startError}
            />
            {startError && (
              <span className="mt-1 block text-sm text-red-400" role="alert">{startError}</span>
            )}
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Ends (local)</span>
            <input
              type="datetime-local"
              min={startsAt || nowDateTimeLocalValue()}
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-hos-text-secondary">Fandom filter (comma-separated)</span>
            <input
              className="mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border"
              value={fandoms}
              onChange={(e) => setFandoms(e.target.value)}
              placeholder="Harry Potter"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-hos-text-secondary">
            <input
              type="checkbox"
              checked={applyToAllProducts}
              onChange={(e) => setApplyToAllProducts(e.target.checked)}
            />
            Apply to all products (no fandom/category/product targeting)
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-md bg-violet-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
          </RouteGuard>
  );
}
