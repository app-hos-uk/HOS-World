'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK, type LandingNavKey } from '../lib/constants';
import { useShopEnabled } from '@/hooks/useShopEnabled';

type Props = {
  active: LandingNavKey;
};

const LINKS: { key: LandingNavKey; href: string; label: string }[] = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'universes', href: '/universes', label: 'Universes' },
  { key: 'experience', href: '/the-experience', label: 'The Experience' },
  { key: 'register', href: LANDING_REGISTER_PATH, label: 'Register' },
];

export function LandingNav({ active }: Props) {
  const shopEnabled = useShopEnabled();
  const shopLink = shopEnabled ? '/shop' : '/coming-soon';
  const shopLabel = shopEnabled ? 'Enter Shop' : 'Coming Soon';
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const nav = document.getElementById('mainNav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <div
        className={`mobile-menu${mobileOpen ? ' open' : ''}`}
        id="mobileMenu"
        aria-hidden={!mobileOpen}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <button type="button" className="mobile-menu-close" onClick={closeMobile} aria-label="Close menu">
          ✕
        </button>
        {LINKS.map((l) => (
          <Link key={l.key} href={l.href} className="nav-link" onClick={closeMobile}>
            {l.label}
          </Link>
        ))}
        <Link href={shopLink} className="nav-link" onClick={closeMobile}>
          {shopLabel}
        </Link>
      </div>

      <nav id="mainNav" role="navigation" aria-label="Primary">
        <Link href="/" className="nav-logo" aria-label="House of Spells">
          <img className="nav-logo-img" src={LANDING_LOGO} width={64} height={64} alt="" aria-hidden="true" />
          <img className="nav-logo-mark" src={LANDING_WORDMARK} width={1024} height={258} alt="" aria-hidden="true" />
        </Link>
        <div className="nav-links-center">
          {LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className={`nav-link${active === l.key ? ' active' : ''}`}
              aria-current={active === l.key ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ))}
          <Link href={shopLink} className="nav-link nav-link-shop">
            {shopLabel}
          </Link>
        </div>
        {active !== 'register' && (
          <Link href={LANDING_REGISTER_PATH} className="nav-cta">
            Claim Your Place
          </Link>
        )}
        <button
          type="button"
          className="nav-burger"
          id="navBurger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          aria-controls="mobileMenu"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>
    </>
  );
}
