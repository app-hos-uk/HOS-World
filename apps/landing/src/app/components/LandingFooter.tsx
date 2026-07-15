'use client';

import Link from 'next/link';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK } from '../lib/constants';

const SOCIALS_NYC = [
  { label: 'Instagram', href: 'https://www.instagram.com/houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg> },
  { label: 'TikTok', href: 'https://www.tiktok.com/@houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.43 0-2.59-1.16-2.59-2.59a2.59 2.59 0 0 1 2.59-2.59c.28 0 .54.04.79.12V9.64a5.72 5.72 0 0 0-.79-.05A5.73 5.73 0 0 0 4.13 15.3a5.73 5.73 0 0 0 5.73 5.73 5.73 5.73 0 0 0 5.73-5.73V9.4a7.35 7.35 0 0 0 4.28 1.37V7.68a4.28 4.28 0 0 1-3.27-1.86z"/></svg> },
  { label: 'Facebook', href: 'https://www.facebook.com/HouseofspellsNYC', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
  { label: 'Threads', href: 'https://www.threads.net/@houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007C5.965 24 2 19.83 2 14.137v-.293C2 7.902 5.965 4 12.186 4h.007c3.114 0 5.65 1.16 7.33 3.354l-2.775 1.94C15.548 7.74 14.036 7.02 12.193 7.02c-3.87 0-6.86 3.11-6.86 6.824v.293c0 3.538 2.99 6.843 6.86 6.843 2.852 0 4.943-1.466 5.698-3.96h-5.698v-3.02h9.127c.08.49.12.99.12 1.49C21.44 20.37 17.45 24 12.186 24z"/></svg> },
];

export function LandingFooter() {
  return (
    <footer>
      <div className="footer-grid">
        <div className="footer-brand">
          <div className="f-logo-wrap" role="img" aria-label="House of Spells">
            <img className="f-logo-img" src={LANDING_LOGO} width={60} height={60} alt="" aria-hidden="true" />
            <img className="f-logo-mark" src={LANDING_WORDMARK} width={1024} height={258} alt="" aria-hidden="true" />
          </div>
          <p className="footer-tagline">
            <strong>House of Spells</strong>
            <br />
            Earth&apos;s Multi-Fandom Universe
          </p>
        </div>

        <div className="footer-visit">
          <h4>Visit Us</h4>
          <address>
            House of Spells — Times Square
            <br />
            234 West 42nd Street
            <br />
            New York, NY 10036
            <br />
            Between 7th &amp; 8th Avenues
          </address>
          <p>Open Daily · 10:00 AM – Midnight</p>
          <p>
            Tel: <a href="tel:+13322504251">+1 (332) 250-4251</a>
          </p>
          <p>
            <a
              href="https://maps.google.com/?q=House+of+Spells+234+West+42nd+Street+New+York+NY+10036"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Directions
            </a>
          </p>
        </div>

        <div className="footer-connect">
          <h4>Connect</h4>
          <div className="footer-social-links">
            {SOCIALS_NYC.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-social-link"
              >
                {s.icon}
                <span>{s.label}</span>
              </a>
            ))}
          </div>
          <p className="footer-ext-links">
            <a href="https://shop.houseofspells.com">Shop Online</a> ·{' '}
            <a href="https://houseofspells.com/careers">Careers</a>
          </p>
        </div>

        <div className="footer-legal">
          <p>
            © 2026 House of Spells. All rights reserved.
            <br />
            houseofspells.com is the global flagship — the UK store lives on at houseofspells.co.uk.
          </p>
          <div className="f-links">
            <Link href="/">Home</Link>
            <Link href="/universes">Universes</Link>
            <Link href="/the-experience">Experience</Link>
            <Link href={LANDING_REGISTER_PATH}>Register</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
