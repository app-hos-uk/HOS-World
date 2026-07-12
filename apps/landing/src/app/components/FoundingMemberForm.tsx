'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { FANDOMS, OTHER_UNIVERSE_NAME, type Fandom } from '../lib/fandoms';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const REG_MIN_HUMAN_FILL_MS = 1800;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegistrationError =
  | 'duplicate_email'
  | 'registration_closed'
  | 'invalid_email'
  | 'invalid_input'
  | 'registration_failed';

async function postRegistrationPayload(data: Record<string, unknown>) {
  const email = String(data.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new Error('invalid_email' satisfies RegistrationError);
  }

  if (!API_BASE_URL) {
    throw new Error('registration_failed' satisfies RegistrationError);
  }

  const payload = {
    firstName: String(data.firstName || '').trim(),
    lastName: String(data.lastName || '').trim(),
    email,
    phone: data.phone,
    country: data.country,
    fandoms: data.fandoms,
    otherFranchises: data.otherFranchises,
    source: data.source,
    spendBracket: data.spend,
  };

  const res = await fetch(`${API_BASE_URL}/founding-members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 403) {
    throw new Error('registration_closed' satisfies RegistrationError);
  }
  if (res.status === 409) {
    throw new Error('duplicate_email' satisfies RegistrationError);
  }
  if (res.status === 400 || res.status === 422) {
    throw new Error('invalid_input' satisfies RegistrationError);
  }
  if (!res.ok) {
    throw new Error('registration_failed' satisfies RegistrationError);
  }
}

type Props = {
  registrationOpen?: boolean;
  fandoms?: Fandom[];
};

export function FoundingMemberForm({ registrationOpen = true, fandoms = FANDOMS }: Props) {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hint, setHint] = useState('Select at least one universe ↑');
  const [hintColor, setHintColor] = useState<string>('var(--gold-d)');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ name: string; fandoms: string[]; other: string } | null>(null);
  const [formStartedAt] = useState(() => Date.now());

  const syncHint = useCallback((size: number) => {
    if (size > 0) {
      setHint(`${size} universe${size > 1 ? 's' : ''} selected`);
      setHintColor('var(--gold)');
    } else {
      setHint('Select at least one universe ↑');
      setHintColor('var(--gold-d)');
    }
  }, []);

  useEffect(() => {
    const interests = searchParams.getAll('interest').map((s) => s.trim()).filter(Boolean);
    if (interests.length === 0) return;

    const FANDOM_ALIASES: Record<string, string> = {
      'harry potter': 'Wizarding World',
      'hogwarts': 'Wizarding World',
      'hp': 'Wizarding World',
      'lotr': 'Middle Earth',
      'lord of the rings': 'Middle Earth',
      'got': 'Game of Thrones',
      'mcu': 'Marvel',
      'dc': 'DC Universe',
      'dc comics': 'DC Universe',
      'superman': 'DC Universe',
      'batman': 'DC Universe',
    };

    const next = new Set<number>();
    interests.forEach((raw) => {
      const decoded = decodeURIComponent(raw);
      let idx = fandoms.findIndex((f) => f.n === decoded);
      if (idx < 0) {
        idx = fandoms.findIndex((f) => f.n.toLowerCase() === decoded.toLowerCase());
      }
      if (idx < 0) {
        const aliasTarget = FANDOM_ALIASES[decoded.toLowerCase()];
        if (aliasTarget) {
          idx = fandoms.findIndex((f) => f.n === aliasTarget);
        }
      }
      if (idx >= 0) next.add(idx);
    });
    if (next.size > 0) {
      setSelected(next);
      syncHint(next.size);
    }
  }, [searchParams, syncHint, fandoms]);

  const otherSelected = (() => {
    const idx = fandoms.findIndex((f) => f.n === OTHER_UNIVERSE_NAME);
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

    const otherIdx = fandoms.findIndex((f) => f.n === OTHER_UNIVERSE_NAME);
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

    const selectedFandoms = Array.from(selected).map((i) => fandoms[i].n);
    const firstName = (form.querySelector<HTMLInputElement>('#fn')?.value || '').trim();
    const email = (form.querySelector<HTMLInputElement>('#em')?.value || '').trim();
    if (!EMAIL_RE.test(email)) {
      setHint('Please enter a valid email address.');
      setHintColor('#c75c5c');
      form.querySelector<HTMLInputElement>('#em')?.focus();
      return;
    }

    const data = {
      firstName,
      lastName: (form.querySelector<HTMLInputElement>('#ln')?.value || '').trim(),
      email,
      phone: form.querySelector<HTMLInputElement>('#ph')?.value || '',
      country: (form.querySelector<HTMLSelectElement>('#co')?.value || ''),
      source: (form.querySelector<HTMLSelectElement>('#src')?.value || ''),
      spend: (form.querySelector<HTMLSelectElement>('#sp')?.value || ''),
      fandoms: selectedFandoms,
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
      setSuccess({ name: firstName || 'Friend', fandoms: selectedFandoms, other: otherFranchises });
    } catch (err) {
      const code = err instanceof Error ? err.message : 'registration_failed';
      const messages: Record<string, string> = {
        duplicate_email: 'This email is already registered as a founding member.',
        registration_closed: 'Founding member registration is currently unavailable.',
        invalid_email: 'Please enter a valid email address.',
        invalid_input: 'Please check your details and try again.',
        registration_failed: 'Something went wrong. Please try again or contact us at House Of Spells.',
      };
      setHint(messages[code] || messages.registration_failed);
      setHintColor('#c75c5c');
      setSubmitting(false);
    }
  };

  if (!registrationOpen) {
    return (
      <div className="reg-form-inner rv vis" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <h2 className="confirm-h1">Registration Closed</h2>
        <p className="confirm-msg">
          Founding member registration is currently unavailable. Please check back soon.
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reg-form-inner rv vis" style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
        <h2 className="confirm-h1">Welcome, {success.name}</h2>
        <p className="confirm-msg">Your place in the circle is claimed. We&apos;ll summon you when the gates open in Times Square.</p>
        <div className="confirm-fandoms" id="confirmFandoms">
          {success.fandoms.map((n) => {
            const f = fandoms.find((x) => x.n === n);
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
          {fandoms.map((f, i) => (
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
                  <img className="fan-brand-img" src={f.logo} alt={`${f.n} logo`} loading="lazy" />
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
                    <option>House Of Spells</option>
                    <option>House Of Spells UK</option>
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
                {submitting ? 'Sending...' : 'Claim My Place'}
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
