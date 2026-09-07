'use client';

import { FormEvent, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { CustomerQr } from '@/components/CustomerQr';
import { normalizeWhitespace, validateNameLike, validatePhoneMaxDigits } from '@/lib/formFieldValidation';
import { getRegionConfig } from '@/lib/regionConfig';

const INPUT_CLS =
  'mt-1 w-full border rounded px-3 py-2 bg-hos-bg-secondary text-hos-text-secondary placeholder-hos-text-muted focus:outline-none border-hos-border';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StaffEnrollSuccess = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  cardNumber: string | null;
  qrPayload: string;
  balance: number | null;
  tierName: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asQrValue(payload: unknown, cardNumber?: string | null, userId?: string | null): string {
  if (typeof payload === 'string' && payload.trim()) return payload;
  if (payload && typeof payload === 'object') return JSON.stringify(payload);
  if (cardNumber) {
    return JSON.stringify({ t: 'hos-loyalty', c: cardNumber, ...(userId ? { u: userId } : {}) });
  }
  return '';
}

type Props = {
  className?: string;
  onEnrolled?: (result: StaffEnrollSuccess) => void;
};

export function StaffLoyaltyEnrollForm({ className, onEnrolled }: Props) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StaffEnrollSuccess | null>(null);

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setError(null);
    setResult(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const em = email.trim().toLowerCase();
    const fn = normalizeWhitespace(firstName);
    const ln = normalizeWhitespace(lastName);
    const ph = phone.trim();

    if (!EMAIL_RE.test(em)) {
      setError('Enter a valid email address');
      return;
    }
    const fnErr = validateNameLike(fn, 'First name');
    if (fnErr) {
      setError(fnErr);
      return;
    }
    const lnErr = validateNameLike(ln, 'Last name');
    if (lnErr) {
      setError(lnErr);
      return;
    }
    const phoneErr = validatePhoneMaxDigits(ph, 'Phone number');
    if (phoneErr) {
      setError(phoneErr);
      return;
    }

    setSubmitting(true);
    try {
      const country = getRegionConfig().country;
      const r = await apiClient.enrollLoyaltyPos({
        email: em,
        firstName: fn,
        lastName: ln,
        ...(ph ? { phone: ph } : {}),
        ...(country ? { country } : {}),
      });
      const data = asRecord(r.data);
      const membership = asRecord(data?.membership);
      const cardNumber =
        (typeof data?.cardNumber === 'string' && data.cardNumber) ||
        (typeof membership?.cardNumber === 'string' && membership.cardNumber) ||
        null;
      const balanceRaw = membership?.currentBalance;
      const balance = typeof balanceRaw === 'number' ? balanceRaw : Number(balanceRaw);
      const enrolled: StaffEnrollSuccess = {
        firstName: typeof data?.firstName === 'string' ? data.firstName : fn,
        lastName: typeof data?.lastName === 'string' ? data.lastName : ln,
        email: typeof data?.email === 'string' ? data.email : em,
        cardNumber,
        qrPayload: asQrValue(
          data?.qrPayload,
          cardNumber,
          typeof data?.userId === 'string' ? data.userId : null,
        ),
        balance: Number.isFinite(balance) ? balance : null,
        tierName:
          typeof asRecord(membership?.tier)?.name === 'string'
            ? String(asRecord(membership?.tier)?.name)
            : null,
      };
      setResult(enrolled);
      onEnrolled?.(enrolled);
      toast.success('Member enrolled — show the QR at the till');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Enrolment failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className={className ?? 'space-y-4'}>
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-emerald-300">New Enchanted Circle member</p>
            <p className="text-hos-text-secondary mt-1">
              {[result.firstName, result.lastName].filter(Boolean).join(' ') || 'Member'}
            </p>
            <p className="text-sm text-hos-text-muted">{result.email}</p>
            {result.tierName && (
              <p className="text-sm text-hos-text-muted mt-1">
                {result.tierName}
                {result.balance != null ? ` · ${result.balance} pts` : ''}
              </p>
            )}
          </div>
          {result.qrPayload ? (
            <div className="flex flex-col items-center">
              <CustomerQr
                value={result.qrPayload}
                size={200}
                alt="New member loyalty QR"
                showValue={false}
                className="flex flex-col items-center"
              />
            </div>
          ) : null}
          {result.cardNumber && (
            <p className="font-mono text-center text-lg tracking-widest text-hos-text-secondary break-all">
              {result.cardNumber}
            </p>
          )}
          <p className="text-xs text-hos-text-muted text-center">
            Customer can show this QR at the till. Scan or key the card number into Lightspeed.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-md border border-hos-border px-4 py-2 text-sm text-hos-text-secondary hover:bg-hos-bg"
        >
          Enroll another customer
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className={className ?? 'space-y-3'} noValidate>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <label className="block text-sm">
        <span className="text-hos-text-secondary">Email</span>
        <input
          className={INPUT_CLS}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="customer@example.com"
        />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-hos-text-secondary">First name</span>
          <input
            className={INPUT_CLS}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            maxLength={100}
          />
        </label>
        <label className="block text-sm">
          <span className="text-hos-text-secondary">Last name</span>
          <input
            className={INPUT_CLS}
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            maxLength={100}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-hos-text-secondary">Phone (optional)</span>
        <input
          className={INPUT_CLS}
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile number"
          maxLength={32}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-violet-700 px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
      >
        {submitting ? 'Enrolling…' : 'Enroll member'}
      </button>
    </form>
  );
}
