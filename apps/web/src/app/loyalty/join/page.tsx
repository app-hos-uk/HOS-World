'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { CustomerQr } from '@/components/CustomerQr';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient, markLoginSuccess, setFrontendSessionCookie } from '@/lib/api';
import { COUNTRIES } from '@/lib/countries';
import { normalizeWhitespace, validateNameLike, validatePhoneMaxDigits } from '@/lib/formFieldValidation';
import { formatMoney } from '@/lib/money';
import { getRegionConfig } from '@/lib/regionConfig';
import {
  clearPendingReferral,
  getPendingReferralCode,
  isValidProgramReferralCode,
  stashReferralFromQuery,
} from '@/lib/referralAttribution';

/** Points-per-currency-unit fallback when the actual balance is not yet available. */
const DEFAULT_POINTS_PER_CURRENCY_UNIT = 100;

const NAME_RE = /^[\p{L}\s\-'.]+$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const INPUT_CLS =
  'mt-1 w-full rounded-lg border border-amber-700/30 bg-stone-950/70 px-3.5 py-3 text-base text-stone-100 placeholder:text-stone-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 font-secondary min-h-11';

type JoinSuccess = {
  firstName: string;
  cardNumber: string | null;
  qrPayload: string;
  balance: number | null;
  alreadyMember?: boolean;
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

function welcomeRewardAmount(balance: number | null | undefined): number | null {
  if (balance == null || !Number.isFinite(balance) || balance <= 0) return null;
  return Math.round((balance / DEFAULT_POINTS_PER_CURRENCY_UNIT) * 100) / 100;
}

function isAlreadyRegisteredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('already exists') ||
    m.includes('already registered') ||
    m.includes('already a member') ||
    m.includes('please sign in') ||
    m.includes('please log in')
  );
}

function JoinPageInner() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [success, setSuccess] = useState<JoinSuccess | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const didCheckSession = useRef(false);

  const countryCode = getRegionConfig().country || 'US';
  const countryName = COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
  const loginHref = `/login?returnUrl=${encodeURIComponent('/loyalty/card')}`;

  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) stashReferralFromQuery(refParam);
    const pending = getPendingReferralCode();
    if (pending) setReferralCode(pending);
    else if (refParam) setReferralCode(refParam);
  }, [searchParams]);

  const loadExistingMembership = useCallback(async (): Promise<JoinSuccess | null> => {
    try {
      const [cardRes, memberRes] = await Promise.allSettled([
        apiClient.getLoyaltyCard(),
        apiClient.getLoyaltyMembership(),
      ]);
      const card = cardRes.status === 'fulfilled' ? asRecord(cardRes.value?.data) : null;
      const membership = memberRes.status === 'fulfilled' ? asRecord(memberRes.value?.data) : null;
      if (!card && !membership) return null;
      const cardNumber =
        (typeof card?.cardNumber === 'string' && card.cardNumber) ||
        (typeof membership?.cardNumber === 'string' && membership.cardNumber) ||
        null;
      const balanceRaw = card?.balance ?? membership?.currentBalance;
      const balance = typeof balanceRaw === 'number' ? balanceRaw : Number(balanceRaw);
      return {
        firstName: user?.firstName || '',
        cardNumber,
        qrPayload: asQrValue(card?.qrPayload, cardNumber, user?.id ?? null),
        balance: Number.isFinite(balance) ? balance : null,
        alreadyMember: true,
      };
    } catch {
      return null;
    }
  }, [user?.firstName, user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (didCheckSession.current) {
      setCheckingSession(false);
      return;
    }
    let cancelled = false;
    (async () => {
      if (user?.role === 'CUSTOMER') {
        const existing = await loadExistingMembership();
        if (!cancelled && existing) {
          setSuccess(existing);
        }
      }
      didCheckSession.current = true;
      if (!cancelled) setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, loadExistingMembership]);

  const rewardLabel = useMemo(() => {
    const amount = welcomeRewardAmount(success?.balance);
    if (amount == null) return null;
    return formatMoney(amount);
  }, [success?.balance]);

  const enrollLoggedIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const ref = referralCode.trim() || getPendingReferralCode();
      await apiClient.enrollLoyalty({
        enrollmentChannel: 'STORE',
        ...(ref ? { referralCode: ref } : {}),
      });
      if (ref) clearPendingReferral();
      await refreshUser();
      const existing = await loadExistingMembership();
      setSuccess(
        existing ?? {
          firstName: user?.firstName || firstName,
          cardNumber: null,
          qrPayload: '',
          balance: null,
        },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not join right now';
      if (/already|enrolled/i.test(msg)) {
        const existing = await loadExistingMembership();
        if (existing) {
          setSuccess(existing);
          return;
        }
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setAlreadyMember(false);

    const fn = normalizeWhitespace(firstName);
    const ln = normalizeWhitespace(lastName);
    const em = email.trim().toLowerCase();
    const ph = phone.trim();
    const ref = referralCode.trim() || getPendingReferralCode();
    const inviteParam = searchParams.get('invite')?.trim();

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
    if (!NAME_RE.test(fn) || !NAME_RE.test(ln)) {
      setError('Names may only contain letters, spaces, hyphens, or apostrophes');
      return;
    }
    if (!EMAIL_RE.test(em)) {
      setError('Enter a valid email address');
      return;
    }
    const phoneErr = validatePhoneMaxDigits(ph, 'Phone number');
    if (phoneErr) {
      setError(phoneErr);
      return;
    }
    if (!PASSWORD_RE.test(password)) {
      setError(
        'Password must be at least 8 characters and include upper and lower case letters, a number, and a symbol (@$!%*?&)',
      );
      return;
    }
    if (!gdprConsent) {
      setError('Please acknowledge the Privacy Policy to join');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.register({
        email: em,
        password,
        role: 'customer',
        firstName: fn,
        lastName: ln,
        countryCode: countryCode.length === 2 ? countryCode : undefined,
        country: countryName,
        whatsappNumber: ph || undefined,
        preferredCommunicationMethod: ph ? 'SMS' : 'EMAIL',
        gdprConsent: true,
        dataProcessingConsent: { essential: true, marketing: true },
        ...(ref && isValidProgramReferralCode(ref) ? { referralCode: ref } : {}),
        ...(inviteParam
          ? { inviteCode: inviteParam }
          : ref && !isValidProgramReferralCode(ref)
            ? { inviteCode: ref }
            : {}),
      });

      setFrontendSessionCookie();
      markLoginSuccess();

      try {
        await apiClient.enrollLoyalty({
          enrollmentChannel: 'STORE',
          ...(ref ? { referralCode: ref } : {}),
        });
        if (ref) clearPendingReferral();
      } catch {
        // Register already auto-enrolls; a second enroll is a no-op or "already enrolled".
      }

      await refreshUser();
      const existing = await loadExistingMembership();
      setSuccess({
        firstName: fn,
        cardNumber: existing?.cardNumber ?? null,
        qrPayload: existing?.qrPayload ?? '',
        balance: existing?.balance ?? null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not complete sign-up';
      if (isAlreadyRegisteredError(msg)) {
        setAlreadyMember(true);
        setError(null);
      } else {
        setError(msg || 'Could not complete sign-up. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const showLoggedInEnroll = !success && !authLoading && !checkingSession && user?.role === 'CUSTOMER';

  return (
    <div className="relative min-h-dvh overflow-hidden bg-stone-950 text-stone-100">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-[-8rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full border border-amber-500/25" />
        <div className="absolute left-1/2 top-[-5.5rem] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full border border-amber-400/15" />
        <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(30,41,59,0.55),_transparent_55%)]" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-6 sm:px-5">
        <header className="mb-6 flex flex-col items-center text-center">
          <BrandLogo variant="emblem" linked href="/" priority className="mb-4" />
          <p className="font-secondary text-[11px] font-medium uppercase tracking-[0.28em] text-amber-500/90">
            House of Spells
          </p>
          <h1 className="font-primary mt-2 text-3xl text-amber-100 sm:text-4xl">The Enchanted Circle</h1>
          <p className="font-secondary mt-2 max-w-sm text-sm leading-relaxed text-stone-400">
            Join our loyalty programme in seconds. Earn on every visit — in store and online.
          </p>
        </header>

        {authLoading || checkingSession ? (
          <p className="font-secondary py-12 text-center text-stone-500">Preparing your circle…</p>
        ) : success ? (
          <div className="flex flex-1 flex-col items-center text-center">
            <div className="w-full rounded-2xl border border-amber-600/40 bg-gradient-to-b from-stone-900/90 to-stone-950 p-6 shadow-[0_0_40px_rgba(217,119,6,0.12)]">
              <p className="font-primary text-2xl text-amber-100 sm:text-3xl">
                {success.alreadyMember
                  ? 'You are already in the Enchanted Circle'
                  : 'Welcome to the Enchanted Circle!'}
              </p>
              {success.firstName ? (
                <p className="font-secondary mt-1 text-sm text-stone-400">
                  {success.alreadyMember ? `Welcome back, ${success.firstName}.` : `You're in, ${success.firstName}.`}
                </p>
              ) : null}

              <div className="mt-5 rounded-xl border border-amber-700/40 bg-amber-950/30 px-4 py-4">
                <p className="font-secondary text-[11px] uppercase tracking-[0.2em] text-amber-400/80">
                  {success.alreadyMember ? 'Points balance' : 'Welcome Reward'}
                </p>
                {rewardLabel ? (
                  <p className="font-primary mt-1 text-4xl text-amber-200">{rewardLabel}</p>
                ) : (
                  <p className="font-secondary mt-1 text-sm text-stone-400">Your reward is ready</p>
                )}
                {success.balance != null && (
                  <p className="font-secondary mt-1 text-xs text-stone-400">
                    {success.balance} points ready to use
                  </p>
                )}
              </div>

              {success.qrPayload ? (
                <div className="mt-6 flex flex-col items-center">
                  <CustomerQr
                    value={success.qrPayload}
                    size={200}
                    alt="Enchanted Circle loyalty card"
                    showValue={false}
                    className="flex flex-col items-center"
                  />
                  {success.cardNumber && (
                    <p className="font-mono mt-3 text-sm tracking-wide text-amber-100/90 break-all">
                      {success.cardNumber}
                    </p>
                  )}
                </div>
              ) : success.cardNumber ? (
                <p className="font-mono mt-6 text-sm tracking-wide text-amber-100/90 break-all">
                  {success.cardNumber}
                </p>
              ) : null}

              <p className="font-secondary mt-6 rounded-lg border border-amber-700/30 bg-stone-950/50 px-3 py-3 text-sm text-amber-100/90">
                {success.alreadyMember
                  ? 'Show this screen to staff at the till to earn or redeem.'
                  : 'Show this screen to staff at the till to apply your Welcome Reward.'}
              </p>
            </div>
            <Link
              href="/loyalty"
              className="font-secondary mt-6 text-sm text-amber-500/90 underline-offset-4 hover:text-amber-400 hover:underline"
            >
              Open my Enchanted Circle
            </Link>
          </div>
        ) : showLoggedInEnroll ? (
          <div className="rounded-2xl border border-amber-700/30 bg-stone-900/60 p-6 text-center">
            <p className="font-secondary text-stone-300">
              You&apos;re signed in as {user.email}. Join the Enchanted Circle with one tap.
            </p>
            {error && <p className="font-secondary mt-3 text-sm text-red-300">{error}</p>}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void enrollLoggedIn()}
              className="mt-5 min-h-12 w-full rounded-lg bg-amber-500 px-4 py-3 text-base font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {submitting ? 'Joining…' : 'Join the Enchanted Circle'}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
            {alreadyMember && (
              <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-4">
                <p className="font-secondary text-sm text-amber-100">
                  You&apos;re already a member of the Enchanted Circle.
                </p>
                <Link
                  href={loginHref}
                  className="font-secondary mt-2 inline-block text-sm font-medium text-amber-400 hover:text-amber-300"
                >
                  Log in to show your card at the till →
                </Link>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-4" role="alert">
                <p className="font-secondary text-sm text-red-200">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-sm font-secondary text-stone-300">
                First name
                <input
                  className={INPUT_CLS}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  autoCapitalize="words"
                  required
                  maxLength={50}
                  placeholder="Hermione"
                />
              </label>
              <label className="block text-sm font-secondary text-stone-300">
                Last name
                <input
                  className={INPUT_CLS}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  autoCapitalize="words"
                  required
                  maxLength={50}
                  placeholder="Granger"
                />
              </label>
            </div>

            <label className="block text-sm font-secondary text-stone-300">
              Email
              <input
                className={INPUT_CLS}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="you@email.com"
              />
            </label>

            <label className="block text-sm font-secondary text-stone-300">
              Phone <span className="text-stone-500">(optional)</span>
              <input
                className={INPUT_CLS}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={32}
                placeholder="Mobile number"
              />
            </label>

            <label className="block text-sm font-secondary text-stone-300">
              Password
              <span className="relative mt-1 block">
                <input
                  className={`${INPUT_CLS} pr-16`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-amber-400/90 hover:text-amber-300"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
              <span className="mt-1 block text-xs text-stone-500">
                8+ characters with upper, lower, number, and symbol
              </span>
            </label>

            <label className="block text-sm font-secondary text-stone-300">
              Referral code <span className="text-stone-500">(optional)</span>
              <input
                className={INPUT_CLS}
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                autoComplete="off"
                maxLength={80}
                placeholder="HOS-FRIEND-A7F2"
              />
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-stone-800 bg-stone-900/40 p-3 text-sm font-secondary text-stone-300">
              <input
                type="checkbox"
                checked={gdprConsent}
                onChange={(e) => setGdprConsent(e.target.checked)}
                required
                className="mt-1 h-4 w-4 rounded border-amber-700/50 bg-stone-950 text-amber-500 focus:ring-amber-400/40"
              />
              <span>
                I acknowledge the{' '}
                <Link href="/privacy-policy" target="_blank" className="text-amber-400 underline-offset-2 hover:underline">
                  Privacy Policy
                </Link>{' '}
                and agree to join the Enchanted Circle.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-12 w-full rounded-lg bg-amber-500 px-4 py-3 text-base font-semibold text-stone-950 shadow-[0_8px_24px_rgba(245,158,11,0.25)] hover:bg-amber-400 disabled:opacity-60"
            >
              {submitting ? 'Joining…' : 'Join in seconds'}
            </button>

            <p className="text-center font-secondary text-sm text-stone-500">
              Already a member?{' '}
              <Link href={loginHref} className="text-amber-400 hover:text-amber-300">
                Log in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoyaltyJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-stone-950 text-stone-400 font-secondary flex items-center justify-center text-sm">
          Loading…
        </div>
      }
    >
      <JoinPageInner />
    </Suspense>
  );
}
