'use client';

import Link from 'next/link';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK } from '../lib/constants';

const SOCIALS_NYC = [
  { label: 'Instagram', href: 'https://www.instagram.com/houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg> },
  { label: 'TikTok', href: 'https://www.tiktok.com/@houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.43 0-2.59-1.16-2.59-2.59a2.59 2.59 0 0 1 2.59-2.59c.28 0 .54.04.79.12V9.64a5.72 5.72 0 0 0-.79-.05A5.73 5.73 0 0 0 4.13 15.3a5.73 5.73 0 0 0 5.73 5.73 5.73 5.73 0 0 0 5.73-5.73V9.4a7.35 7.35 0 0 0 4.28 1.37V7.68a4.28 4.28 0 0 1-3.27-1.86z"/></svg> },
  { label: 'Facebook', href: 'https://www.facebook.com/HouseofspellsNYC', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
  { label: 'Threads', href: 'https://www.threads.net/@houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.52 11.41c-.14-.06-.28-.12-.43-.18-.15-.85-.55-1.6-1.19-2.16-.64-.56-1.48-.88-2.44-.88-1.21 0-2.16.5-2.76 1.46l1.1.74c.37-.6.91-.89 1.63-.89.48 0 .89.14 1.21.42.32.27.53.65.61 1.1-.53-.08-1.09-.1-1.68-.04-1.64.17-2.7 1.06-2.63 2.28.03.62.35 1.15.88 1.51.46.31 1.05.46 1.67.43.82-.04 1.46-.33 1.93-.85.35-.4.58-.91.69-1.55.41.25.72.58.88.98.28.68.3 1.8-.62 2.72-.81.81-1.78 1.16-3.1 1.17-1.47-.01-2.59-.48-3.33-1.39-.68-.85-1.04-2.06-1.04-3.59 0-1.53.36-2.74 1.04-3.59.74-.91 1.86-1.38 3.33-1.39 1.49.01 2.64.49 3.39 1.4.36.44.64.98.82 1.59l1.24-.33c-.24-.81-.61-1.5-1.11-2.07-1-.12-2.42-1.79-4.35-1.81h-.03c-1.91.02-3.37.69-4.32 1.86-.83 1.03-1.27 2.48-1.27 4.33 0 1.85.44 3.3 1.27 4.33.95 1.17 2.41 1.84 4.32 1.86h.03c1.57-.01 2.78-.47 3.82-1.51 1.33-1.33 1.28-3.01.86-3.98zm-3.24 1.74c-.69.04-1.37-.27-1.4-.71-.03-.33.25-.7 1.14-.79.1-.01.2-.01.29-.01.4 0 .77.04 1.1.12-.13 1.01-.62 1.36-1.13 1.39z"/></svg> },
];

export function LandingFooter() {
  return (
    <footer>
      <div className="footer-container">
        {/* Main footer content */}
        <div className="footer-main">
          <div className="footer-brand">
            <div className="f-logo-wrap" role="img" aria-label="House of Spells">
              <img className="f-logo-img" src={LANDING_LOGO} width={60} height={60} alt="" aria-hidden="true" />
              <img className="f-logo-mark" src={LANDING_WORDMARK} width={1024} height={258} alt="" aria-hidden="true" />
            </div>
            <p className="footer-tagline">Earth&apos;s Multi-Fandom Universe</p>
          </div>

          <div className="footer-visit">
            <h4>Visit Us</h4>
            <address>
              House of Spells — Times Square
              <br />
              234 West 42nd Street, New York, NY 10036
              <br />
              Between 7th &amp; 8th Avenues
            </address>
            <p className="footer-hours">Open Daily · 10:00 AM – Midnight</p>
            <p className="footer-contact">
              Tel: <a href="tel:+13322504251">+1 (332) 250-4251</a> ·{' '}
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
            <div className="footer-social-icons">
              {SOCIALS_NYC.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-icon"
                  aria-label={s.label}
                  title={s.label}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer bottom */}
        <div className="footer-bottom">
          <div className="f-links">
            <Link href="/">Home</Link>
            <a href="https://houseofspells.com/careers">Careers</a>
            <Link href="/universes">Universes</Link>
            <Link href="/the-experience">Experience</Link>
            <Link href={LANDING_REGISTER_PATH}>Register</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
          <p className="footer-copyright">
            © 2026 House of Spells. All rights reserved. · houseofspells.com is the global flagship.
            <br />
            The UK store lives on at{' '}
            <a href="https://www.houseofspells.co.uk" target="_blank" rel="noopener noreferrer">
              houseofspells.co.uk
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
