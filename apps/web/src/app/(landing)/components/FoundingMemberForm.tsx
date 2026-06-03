'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FANDOMS, OTHER_UNIVERSE_NAME } from '../lib/fandoms';
import { REG_GOOGLE_SCRIPT_URL } from '../lib/constants';

const REG_MIN_HUMAN_FILL_MS = 1800;

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
      ? '/api/proxy'
      : 'https://hos-marketplaceapi-production.up.railway.app/api');

async function postRegistrationPayload(data: Record<string, unknown>) {
  // Primary: POST to platform API
  try {
    const res = await fetch(`${API_BASE}/founding-members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        country: data.country,
        fandoms: data.fandoms,
        otherFranchises: data.otherFranchises,
        source: data.source,
        spendBracket: data.spend,
      }),
    });
    if (res.ok) return true;
    if (res.status === 409) return true; // Already registered — treat as success
    throw new Error('api_error');
  } catch {
    // Fallback: Google Script (fire-and-forget for redundancy)
    const googleUrl = REG_GOOGLE_SCRIPT_URL.trim();
    if (googleUrl.includes('script.google.com')) {
      const jsonStr = JSON.stringify(data);
      fetch(googleUrl, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: jsonStr,
      }).catch(() => {});
      return true;
    }
    throw new Error('no_backend_config');
  }
}

export function FoundingMemberForm() {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hint, setHint] = useState('Select at least one universe ↑');
  const [hintColor, setHintColor] = useState<string>('var(--gold-d)');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ name: string; fandoms: string[]; other: string } | null>(null);
  const [formStartedAt] = useState(() => Date.now());

  const syncHint = useCallback((size: number) => {
    if (size > 0) {
      setHint(`${size} universe${size > 1 ? 's' : ''} selected ✦`);
      setHintColor('var(--gold)');
    } else {
      setHint('Select at least one universe ↑');
      setHintColor('var(--gold-d)');
    }
  }, []);

  useEffect(() => {
    const interests = searchParams.getAll('interest').map((s) => s.trim()).filter(Boolean);
    if (interests.length === 0) return;
    const next = new Set<number>();
    interests.forEach((name) => {
      const idx = FANDOMS.findIndex((f) => f.n === decodeURIComponent(name));
      if (idx >= 0) next.add(idx);
    });
    if (next.size > 0) {
      setSelected(next);
      syncHint(next.size);
    }
  }, [searchParams, syncHint]);

  const otherSelected = (() => {
    const idx = FANDOMS.findIndex((f) => f.n === OTHER_UNIVERSE_NAME);
    return idx >= 0 && selected.has(idx);
  })();

  const toggleFandom = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      syncHint(next.size);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const hp = form.querySelector<HTMLInputElement>('#websiteField');
    if (hp && hp.value.trim() !== '') return;

    if (selected.size === 0) {
      setHint('Select at least one universe to continue');
      setHintColor('#c75c5c');
      document.querySelector('.reg-left')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

    const otherIdx = FANDOMS.findIndex((f) => f.n === OTHER_UNIVERSE_NAME);
    const otherTa = form.querySelector<HTMLTextAreaElement>('#otherFranchises');
    let otherFranchises = '';
    if (otherIdx >= 0 && selected.has(otherIdx)) {
      otherFranchises = (otherTa?.value || '').trim();
      if (!otherFranchises) {
        setHint('Please name the franchises you are into (required with Other Universe).');
        setHintColor('#c75c5c');
        document.getElementById('otherFranchisesWrap')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        otherTa?.focus();
        return;
      }
    }

    const nowMs = Date.now();
    if (nowMs - formStartedAt < REG_MIN_HUMAN_FILL_MS) {
      setHint('Please review details and submit again.');
      setHintColor('#c75c5c');
      return;
    }

    const fandoms = Array.from(selected).map((i) => FANDOMS[i].n);
    const firstName = (form.querySelector<HTMLInputElement>('#fn')?.value || '').trim();
    const data = {
      firstName,
      lastName: form.querySelector<HTMLInputElement>('#ln')?.value || '',
      email: form.querySelector<HTMLInputElement>('#em')?.value || '',
      phone: form.querySelector<HTMLInputElement>('#ph')?.value || '',
      country: (form.querySelector<HTMLSelectElement>('#co')?.value || ''),
      source: (form.querySelector<HTMLSelectElement>('#src')?.value || ''),
      spend: (form.querySelector<HTMLSelectElement>('#sp')?.value || ''),
      fandoms,
      otherFranchises,
      timestamp: new Date().toISOString(),
      formStartedAt,
      submittedAt: nowMs,
      website: '',
      userAgent: navigator.userAgent.slice(0, 180),
      pagePath: '/founding-members',
    };

    setSubmitting(true);
    try {
      await postRegistrationPayload(data);
      setSuccess({ name: firstName || 'Friend', fandoms, other: otherFranchises });
    } catch (err) {
      const message = err instanceof Error && err.message === 'no_backend_config'
        ? 'Registration backend is not configured yet. Please contact us at houseofspells.com.'
        : 'Something went wrong. Please try again.';
      setHint(message);
      setHintColor('#c75c5c');
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="reg-form-inner rv vis" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <h2 className="confirm-h1">Welcome, {success.name} ✦</h2>
        <p className="confirm-msg">Your place in the circle is claimed. We&apos;ll summon you when the gates open in Times Square.</p>
        <div className="confirm-fandoms" id="confirmFandoms">
          {success.fandoms.map((n) => {
            const f = FANDOMS.find((x) => x.n === n);
            return (
              <div key={n} className="cf-tag">
                {f?.logo ? <img className="cf-brand-img" src={f.logo} alt="" loading="lazy" /> : null}
                <span>{n}</span>
              </div>
            );
          })}
        </div>
        {success.other ? (
          <p className="confirm-other-note" id="confirmOtherNote">
            Other worlds you shared: {success.other}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="reg-layout" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="reg-left">
        <h3>Your Universes</h3>
        <p>Select every fandom you love. This directly shapes what we stock — your choices build our shelves.</p>
        <div className="fan-grid" id="fanGrid">
          {FANDOMS.map((f, i) => (
            <button
              key={f.n}
              type="button"
              className={`fan-card${selected.has(i) ? ' sel' : ''}`}
              onClick={() => toggleFandom(i)}
              aria-pressed={selected.has(i)}
            >
              <div className="fan-chk">✓</div>
              <div className="fan-brand">
                <div className="fan-brand-plate">
                  <img className="fan-brand-img" src={f.logo} alt="" loading="lazy" />
                  <span className="fan-em">{f.e}</span>
                </div>
              </div>
              <div className="fan-nm">{f.n}</div>
            </button>
          ))}
        </div>
        <p className="fan-hint" id="fanHint" style={{ color: hintColor }}>
          {hint}
        </p>
      </div>
      <div className="reg-right">
        <div id="formState">
          <div className="reg-form-inner">
            <div className="reg-head">
              <h2>Your Details</h2>
              <p>We&apos;ll summon you when the gates open. Your data shapes our store — it&apos;s always used for your benefit.</p>
            </div>
            <form id="regForm" onSubmit={handleSubmit}>
              <div aria-hidden="true" style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
                <label htmlFor="websiteField">Leave this field empty</label>
                <input type="text" id="websiteField" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <div className="f-row">
                <div className="f-g">
                  <label htmlFor="fn">First Name</label>
                  <input type="text" id="fn" name="firstName" autoComplete="given-name" placeholder="First name" required />
                </div>
                <div className="f-g">
                  <label htmlFor="ln">Last Name</label>
                  <input type="text" id="ln" name="lastName" autoComplete="family-name" placeholder="Last name" required />
                </div>
              </div>
              <div className="f-g">
                <label htmlFor="em">Email Address</label>
                <input type="email" id="em" name="email" autoComplete="email" placeholder="your@email.com" required />
              </div>
              <div className="f-g">
                <label htmlFor="ph">Phone (Optional)</label>
                <input type="tel" id="ph" name="phone" autoComplete="tel" placeholder="+1 (000) 000-0000" />
              </div>
              <div className="f-row">
                <div className="f-g">
                  <label htmlFor="co">Country</label>
                  <select id="co" name="country" required defaultValue="">
                    <option value="">Select country</option>
                    <option>United States</option>
                    <option>United Kingdom</option>
                    <option>Canada</option>
                    <option>Australia</option>
                    <option>Germany</option>
                    <option>France</option>
                    <option>Japan</option>
                    <option>India</option>
                    <option>Brazil</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="f-g">
                  <label htmlFor="src">How Found Us?</label>
                  <select id="src" name="source" required defaultValue="">
                    <option value="">Select source</option>
                    <option>QR Code / Flyer</option>
                    <option>Instagram</option>
                    <option>TikTok</option>
                    <option>Friend / Word of Mouth</option>
                    <option>houseofspells.com</option>
                    <option>houseofspells.co.uk</option>
                    <option>Times Square Ad</option>
                    <option>Google Search</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="f-g">
                <label htmlFor="sp">Monthly Fandom Spend</label>
                <select id="sp" name="spend" required defaultValue="">
                  <option value="">Select range — helps us stock wisely</option>
                  <option>Under $25</option>
                  <option>$25 – $75</option>
                  <option>$75 – $150</option>
                  <option>$150 – $300</option>
                  <option>$300+</option>
                </select>
              </div>
              <div className="f-g" id="otherFranchisesWrap" hidden={!otherSelected}>
                <label htmlFor="otherFranchises">Franchises you&apos;re into</label>
                <textarea
                  id="otherFranchises"
                  name="otherFranchises"
                  rows={4}
                  maxLength={2000}
                  autoComplete="off"
                  placeholder="Name the worlds, series, or fandoms you love (we use this to shape our shelves)."
                  required={otherSelected}
                />
              </div>
              <button type="submit" className="sub-btn" disabled={submitting}>
                {submitting ? '✦  Sending...' : '✦   Claim My Place   ✦'}
              </button>
            </form>
            <div className="reg-perks">
              <span className="perk">Early access invite</span>
              <span className="perk">Launch day exclusive</span>
              <span className="perk">Founding member status</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
