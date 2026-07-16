'use client';

import Link from 'next/link';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK } from '../lib/constants';

const SOCIALS_NYC = [
  { label: 'Instagram', href: 'https://www.instagram.com/houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg> },
  { label: 'TikTok', href: 'https://www.tiktok.com/@houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.43 0-2.59-1.16-2.59-2.59a2.59 2.59 0 0 1 2.59-2.59c.28 0 .54.04.79.12V9.64a5.72 5.72 0 0 0-.79-.05A5.73 5.73 0 0 0 4.13 15.3a5.73 5.73 0 0 0 5.73 5.73 5.73 5.73 0 0 0 5.73-5.73V9.4a7.35 7.35 0 0 0 4.28 1.37V7.68a4.28 4.28 0 0 1-3.27-1.86z"/></svg> },
  { label: 'Facebook', href: 'https://www.facebook.com/HouseofspellsNYC', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
  { label: 'Threads', href: 'https://www.threads.net/@houseofspellsnyc', icon: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.186 24h-.007c-4.334 0-7.851-1.977-9.443-5.315l1.732-1.017c1.335 2.803 4.195 4.485 7.711 4.485h.007c4.745 0 8.607-3.86 8.607-8.605 0-1.894-.613-3.675-1.772-5.147l1.46-1.268c1.429 1.815 2.159 4.008 2.159 6.415 0 5.846-4.761 10.607-10.607 10.607zm-5.024-13.267c-1.024 0-1.857.833-1.857 1.857s.833 1.857 1.857 1.857 1.857-.833 1.857-1.857-.833-1.857-1.857-1.857zm9.676 0c-1.024 0-1.857.833-1.857 1.857s.833 1.857 1.857 1.857 1.857-.833 1.857-1.857-.833-1.857-1.857-1.857zm-4.838-8.52c-3.516 0-6.376 1.682-7.711 4.485L2.557 5.68C4.149 2.342 7.666.365 12 .365h.007c5.846 0 10.607 4.761 10.607 10.607 0 2.407-.73 4.6-2.159 6.415l-1.46-1.268c1.159-1.472 1.772-3.253 1.772-5.147 0-4.745-3.862-8.605-8.607-8.605z"/></svg> },
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
