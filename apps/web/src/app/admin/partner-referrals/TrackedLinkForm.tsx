'use client';

import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { CustomerQr } from '@/components/CustomerQr';
import { useToast } from '@/hooks/useToast';
import {
  FIELD_CLASS,
  PRIMARY_BTN,
  SECONDARY_BTN,
  buildPartnerRefUrl,
  copyText,
} from './_shared';

export type TrackedLinkFormValues = {
  name: string;
  code: string;
  targetUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  signupBonusPoints: string;
  pointsMultiplier: string;
  multiplierDays: string;
  couponCode: string;
  discountPercent: string;
  discountFixedAmount: string;
  maxRedemptions: string;
  expiresAt: string;
};

const EMPTY: TrackedLinkFormValues = {
  name: '',
  code: '',
  targetUrl: '/register',
  utmSource: '',
  utmMedium: 'referral',
  utmCampaign: '',
  utmContent: '',
  utmTerm: '',
  signupBonusPoints: '',
  pointsMultiplier: '',
  multiplierDays: '',
  couponCode: '',
  discountPercent: '',
  discountFixedAmount: '',
  maxRedemptions: '',
  expiresAt: '',
};

function optionalNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export function toCreateLinkBody(form: TrackedLinkFormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: form.name.trim(),
    utmSource: form.utmSource.trim(),
  };
  if (form.code.trim()) body.code = form.code.trim();
  if (form.targetUrl.trim()) body.targetUrl = form.targetUrl.trim();
  if (form.utmMedium.trim()) body.utmMedium = form.utmMedium.trim();
  if (form.utmCampaign.trim()) body.utmCampaign = form.utmCampaign.trim();
  if (form.utmContent.trim()) body.utmContent = form.utmContent.trim();
  if (form.utmTerm.trim()) body.utmTerm = form.utmTerm.trim();
  const signup = optionalNumber(form.signupBonusPoints);
  if (signup != null) body.signupBonusPoints = signup;
  const multiplier = optionalNumber(form.pointsMultiplier);
  if (multiplier != null) body.pointsMultiplier = multiplier;
  const days = optionalNumber(form.multiplierDays);
  if (days != null) body.multiplierDays = days;
  if (form.couponCode.trim()) body.couponCode = form.couponCode.trim();
  const discountPct = optionalNumber(form.discountPercent);
  if (discountPct != null) body.discountPercent = discountPct;
  const discountFixed = optionalNumber(form.discountFixedAmount);
  if (discountFixed != null) body.discountFixedAmount = discountFixed;
  const maxRedemptions = optionalNumber(form.maxRedemptions);
  if (maxRedemptions != null) body.maxRedemptions = maxRedemptions;
  if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();
  return body;
}

type Props = {
  submitting: boolean;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function TrackedLinkForm({ submitting, onSubmit, onCancel, submitLabel = 'Create link' }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<TrackedLinkFormValues>(EMPTY);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const previewUrl = useMemo(
    () =>
      buildPartnerRefUrl({
        origin,
        code: form.code.trim() || 'PARTNER-AUTO-CODE',
        utmSource: form.utmSource,
        utmMedium: form.utmMedium,
        utmCampaign: form.utmCampaign,
        utmContent: form.utmContent,
        utmTerm: form.utmTerm,
      }),
    [origin, form],
  );

  const set = (key: keyof TrackedLinkFormValues) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(toCreateLinkBody(form));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="bg-stone-900 border border-stone-800 rounded-lg p-6 space-y-4">
        <h2 className="font-primary text-lg text-amber-100">Link Details</h2>
        <label className="block text-sm font-secondary">
          <span className="text-stone-300">Name</span>
          <input className={FIELD_CLASS} value={form.name} onChange={set('name')} required />
        </label>
        <label className="block text-sm font-secondary">
          <span className="text-stone-300">Code (optional, auto-generated)</span>
          <input
            className={FIELD_CLASS}
            value={form.code}
            onChange={set('code')}
            placeholder="PARTNER-HILTON-NYC-A7F2"
          />
        </label>
        <label className="block text-sm font-secondary">
          <span className="text-stone-300">Target URL</span>
          <input className={FIELD_CLASS} value={form.targetUrl} onChange={set('targetUrl')} />
        </label>
      </section>

      <section className="bg-stone-900 border border-stone-800 rounded-lg p-6 space-y-4">
        <h2 className="font-primary text-lg text-amber-100">UTM Parameters</h2>
        <label className="block text-sm font-secondary">
          <span className="text-stone-300">Source <span className="text-red-400">*</span></span>
          <input className={FIELD_CLASS} value={form.utmSource} onChange={set('utmSource')} required />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Medium</span>
            <input className={FIELD_CLASS} value={form.utmMedium} onChange={set('utmMedium')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Campaign</span>
            <input className={FIELD_CLASS} value={form.utmCampaign} onChange={set('utmCampaign')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Content</span>
            <input className={FIELD_CLASS} value={form.utmContent} onChange={set('utmContent')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Term</span>
            <input className={FIELD_CLASS} value={form.utmTerm} onChange={set('utmTerm')} />
          </label>
        </div>
      </section>

      <section className="bg-stone-900 border border-stone-800 rounded-lg p-6 space-y-4">
        <h2 className="font-primary text-lg text-amber-100">Incentives</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Signup Bonus Points</span>
            <input type="number" min={0} className={FIELD_CLASS} value={form.signupBonusPoints} onChange={set('signupBonusPoints')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Points Multiplier</span>
            <input type="number" min={1} max={10} step="0.1" className={FIELD_CLASS} value={form.pointsMultiplier} onChange={set('pointsMultiplier')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Multiplier Duration (days)</span>
            <input type="number" min={1} max={365} className={FIELD_CLASS} value={form.multiplierDays} onChange={set('multiplierDays')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Coupon Code</span>
            <input className={FIELD_CLASS} value={form.couponCode} onChange={set('couponCode')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Discount %</span>
            <input type="number" min={0} max={100} step="0.01" className={FIELD_CLASS} value={form.discountPercent} onChange={set('discountPercent')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Discount Fixed Amount</span>
            <input type="number" min={0} step="0.01" className={FIELD_CLASS} value={form.discountFixedAmount} onChange={set('discountFixedAmount')} />
          </label>
        </div>
      </section>

      <section className="bg-stone-900 border border-stone-800 rounded-lg p-6 space-y-4">
        <h2 className="font-primary text-lg text-amber-100">Limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Max Redemptions</span>
            <input type="number" min={1} className={FIELD_CLASS} value={form.maxRedemptions} onChange={set('maxRedemptions')} />
          </label>
          <label className="block text-sm font-secondary">
            <span className="text-stone-300">Expiry Date</span>
            <input type="date" className={FIELD_CLASS} value={form.expiresAt} onChange={set('expiresAt')} />
          </label>
        </div>
      </section>

      <section className="bg-stone-900 border border-stone-800 rounded-lg p-6 space-y-4">
        <h2 className="font-primary text-lg text-amber-100">Live Preview</h2>
        <label className="block text-sm font-secondary">
          <span className="text-stone-300">Generated URL</span>
          <div className="mt-1 flex gap-2">
            <input className={FIELD_CLASS + ' mt-0'} value={previewUrl} readOnly />
            <button
              type="button"
              className={SECONDARY_BTN}
              onClick={async () => {
                const ok = await copyText(previewUrl);
                if (ok) toast.success('URL copied');
                else toast.error('Could not copy URL');
              }}
            >
              Copy
            </button>
          </div>
          {!form.code.trim() && (
            <p className="text-xs text-stone-500 mt-1">Code is a placeholder until the link is saved.</p>
          )}
        </label>
        <div>
          <p className="text-sm text-stone-300 font-secondary mb-2">QR Code</p>
          {form.utmSource.trim() ? (
            <CustomerQr value={previewUrl} size={180} className="flex flex-col items-start gap-1" />
          ) : (
            <p className="text-sm text-stone-500 font-secondary">Enter a UTM source to preview the QR code.</p>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={submitting} className={PRIMARY_BTN}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={SECONDARY_BTN}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
