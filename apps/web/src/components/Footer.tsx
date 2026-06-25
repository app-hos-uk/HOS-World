'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';
import { BrandLogo } from '@/components/BrandLogo';
import {
  FOOTER_ABOUT,
  FOOTER_CONTACT,
  FOOTER_POLICY_LINKS,
  FOOTER_SHOP_LINKS,
  SOCIAL_LINKS,
  resolveSocialHref,
  type SocialPlatform,
} from '@/lib/storefrontNavigation';

type SocialEntry = { platform: SocialPlatform; label: string; ariaLabel: string; href: string };

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === 'facebook') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  if (platform === 'instagram') {
    return (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    );
  }

  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
    </svg>
  );
}

function FooterNavColumn({
  title,
  ariaLabel,
  links,
}: {
  title: string;
  ariaLabel: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-col min-w-0">
      <h4 className="text-hos-text-secondary text-sm font-bold font-ui mb-4">{title}</h4>
      <ul className="space-y-2 text-hos-text-muted text-[13px]">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            {link.external ? (
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-hos-gold transition-colors duration-200"
              >
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className="hover:text-hos-gold transition-colors duration-200">
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterNewsletter() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      await apiClient.newsletterSubscribe({ email, source: 'footer' });
      setStatus('success');
      setEmail('');
      setConsent(false);
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(errorMessageFrom(err));
    }
  };

  function errorMessageFrom(err: unknown): string {
    if (err instanceof Error && err.message) return err.message;
    return 'Something went wrong. Please try again.';
  }

  return (
    <div className="flex flex-col min-w-0">
      <h4 className="text-hos-text-secondary text-sm font-bold font-ui mb-4">Newsletter</h4>
      <p className="text-hos-text-muted text-[13px] leading-relaxed mb-3">
        Get updates on new collections, vendor spotlights, and exclusive offers.
      </p>

      {status === 'success' ? (
        <p className="text-sm text-hos-new-green">You&apos;re subscribed! Thank you.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={status === 'loading'}
              className="flex-1 min-w-0 bg-hos-bg border border-hos-border rounded-md px-3 py-2 text-sm text-hos-text-secondary placeholder:text-hos-text-muted focus:outline-none focus:border-hos-gold disabled:opacity-50"
              aria-label="Email address for newsletter"
            />
            <button
              type="submit"
              disabled={status === 'loading' || !consent}
              className="shrink-0 px-4 py-2 text-sm font-semibold rounded-md bg-hos-gold text-[#1a1406] hover:bg-hos-gold-hover transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Submitting…' : 'Subscribe'}
            </button>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={status === 'loading'}
              required
              className="mt-0.5 accent-hos-gold w-4 h-4 shrink-0"
            />
            <span className="text-hos-text-muted text-xs leading-snug">
              I agree to receive marketing communications from House of Spells.
            </span>
          </label>

          {status === 'error' && (
            <p className="text-hos-sale-red text-xs">{errorMessage}</p>
          )}
        </form>
      )}
    </div>
  );
}

export function Footer() {
  const socialEntries = useMemo(() => {
    const out: SocialEntry[] = [];
    for (const social of SOCIAL_LINKS) {
      const href = resolveSocialHref(social.envKey, social.fallbackEnvKey, social.defaultHref);
      if (href) {
        out.push({
          platform: social.platform,
          label: social.label,
          ariaLabel: social.ariaLabel,
          href,
        });
      }
    }
    return out;
  }, []);

  const phoneHref = FOOTER_CONTACT.phone.replace(/[^\d+]/g, '');

  return (
    <footer className="w-full bg-hos-bg border-t border-hos-border" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Row 1: brand, shop, policies, newsletter */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-10 lg:gap-x-14 items-start [&>div]:min-w-0">
          <div className="flex flex-col">
            <BrandLogo variant="stacked" linked href="/shop" />
            <p className="text-hos-text-muted text-[13px] leading-relaxed mt-4">{FOOTER_ABOUT}</p>

            <div className="flex flex-wrap gap-3 mt-4 text-hos-text-muted">
              {socialEntries.map(({ platform, ariaLabel, href, label }) => (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={ariaLabel}
                  title={label}
                  className="hover:text-hos-gold transition-colors duration-200"
                >
                  <SocialIcon platform={platform} />
                </a>
              ))}
            </div>
          </div>

          <FooterNavColumn
            title="Main Menu"
            ariaLabel="Shop and main navigation"
            links={FOOTER_SHOP_LINKS}
          />

          <FooterNavColumn
            title="Help & Policies"
            ariaLabel="Help and policies"
            links={FOOTER_POLICY_LINKS}
          />

          <FooterNewsletter />
        </div>

        {/* Row 2: contact details in a single line */}
        <div className="border-t border-hos-border mt-10 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-hos-text-muted text-[13px] text-center">
            <span>{FOOTER_CONTACT.address}</span>
            <span className="hidden sm:inline text-hos-border" aria-hidden>
              |
            </span>
            <a
              href={`tel:${phoneHref}`}
              className="hover:text-hos-gold transition-colors duration-200"
            >
              {FOOTER_CONTACT.phone}
            </a>
            <span className="hidden sm:inline text-hos-border" aria-hidden>
              |
            </span>
            <a
              href={`mailto:${FOOTER_CONTACT.email}`}
              className="hover:text-hos-gold transition-colors duration-200"
            >
              {FOOTER_CONTACT.email}
            </a>
          </div>
        </div>

        {/* Subfooter */}
        <div className="border-t border-hos-border mt-6 pt-5">
          <p className="text-hos-text-muted text-[11px] text-center">
            © {new Date().getFullYear()} House of Spells. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
