import Link from 'next/link';
import { cookies } from 'next/headers';
import { LandingShell } from './LandingShell';
import { HubFandomWorld } from './HubFandomWorld';
import { LANDING_LOGO, LANDING_WORDMARK } from '../lib/constants';
import { fetchFandomWorldFeed } from '../lib/fandomWorldApi';

const COUNTRIES = [
  {
    code: 'GB',
    name: 'United Kingdom',
    href: 'https://www.houseofspells.co.uk',
    shopHref: 'https://www.houseofspells.co.uk',
    detail: 'Where It All Began',
    tagline: 'The original home of House of Spells. Multiple locations across the UK serving fans since day one.',
    status: 'established' as const,
    accent: 'uk' as const,
  },
  {
    code: 'US',
    name: 'United States',
    href: 'https://us.houseofspells.com',
    shopHref: 'https://shop.houseofspells.com',
    detail: 'Times Square, New York',
    tagline: 'The flagship has landed in the heart of Manhattan. 50,000 sq ft of multi-fandom immersion at the crossroads of the world.',
    status: 'open' as const,
    accent: 'us' as const,
  },
  {
    code: 'MY',
    name: 'Malaysia',
    href: 'https://houseofspells.my',
    shopHref: 'https://shop.houseofspells.my',
    detail: 'Kuala Lumpur — November 2026',
    tagline: 'The House is coming to Southeast Asia. Be the first to know when the gates open in Kuala Lumpur.',
    status: 'coming-soon' as const,
    accent: 'my' as const,
  },
];

const GEO_REGIONS: Record<string, string> = {
  // UK & Europe → UK
  GB: 'GB',
  IE: 'GB',
  DE: 'GB',
  FR: 'GB',
  IT: 'GB',
  ES: 'GB',
  NL: 'GB',
  BE: 'GB',
  AT: 'GB',
  PT: 'GB',
  GR: 'GB',
  FI: 'GB',
  SE: 'GB',
  DK: 'GB',
  NO: 'GB',
  PL: 'GB',
  CZ: 'GB',
  RO: 'GB',
  HU: 'GB',
  CH: 'GB',
  BG: 'GB',
  HR: 'GB',
  SK: 'GB',
  LT: 'GB',
  LV: 'GB',
  EE: 'GB',
  SI: 'GB',
  LU: 'GB',
  MT: 'GB',
  CY: 'GB',
  IS: 'GB',
  // Africa → UK
  ZA: 'GB',
  NG: 'GB',
  KE: 'GB',
  GH: 'GB',
  EG: 'GB',
  MA: 'GB',
  TZ: 'GB',
  ET: 'GB',
  // Americas → US
  US: 'US',
  CA: 'US',
  MX: 'US',
  BR: 'US',
  AR: 'US',
  CO: 'US',
  CL: 'US',
  PE: 'US',
  // Asia-Pacific → MY
  MY: 'MY',
  SG: 'MY',
  TH: 'MY',
  ID: 'MY',
  PH: 'MY',
  VN: 'MY',
  BN: 'MY',
  KH: 'MY',
  LA: 'MY',
  MM: 'MY',
  IN: 'MY',
  BD: 'MY',
  LK: 'MY',
  NP: 'MY',
  AU: 'MY',
  NZ: 'MY',
  JP: 'MY',
  KR: 'MY',
  CN: 'MY',
  TW: 'MY',
  HK: 'MY',
  MO: 'MY',
  // Gulf → MY
  AE: 'MY',
  SA: 'MY',
  QA: 'MY',
  KW: 'MY',
  BH: 'MY',
  OM: 'MY',
};

const STATUS_LABEL = {
  established: 'Est. Original',
  open: 'Now Open',
  'coming-soon': 'Coming Nov 2026',
} as const;

export async function GlobalHub() {
  const jar = await cookies();
  const hinted = jar.get('hos_geo_country')?.value?.toUpperCase();
  const mapped = hinted ? GEO_REGIONS[hinted] : undefined;
  const suggested = COUNTRIES.find((country) => country.code === mapped);
  const fandomShopBase = 'https://shop.houseofspells.com';
  const fandomItems = await fetchFandomWorldFeed(12, '');

  return (
    <LandingShell nav="home" mainId="pg-home">
      <main id="pg-home" className="hos-page hub" tabIndex={-1}>
        <header className="hub-hero">
          <div className="hub-hero-glow" aria-hidden="true" />
          <div className="hero-brand-lockup">
            <div className="hero-logo-wrap">
              <div className="hero-logo-ring" />
              <div className="hero-logo-ring2" />
              <img className="hero-logo-img" src={LANDING_LOGO} width={240} height={240} alt="" />
            </div>
            <h1 className="h-brand-title">
              <img
                className="hero-wordmark-img"
                src={LANDING_WORDMARK}
                width={1024}
                height={258}
                alt="House of Spells"
              />
            </h1>
          </div>
          <p className="hub-hero-tagline">Earth&apos;s Multi-Fandom Universe</p>
        </header>

        <section className="hub-brand" aria-labelledby="hub-brand-heading">
          <p className="eyebrow">The House</p>
          <h2 id="hub-brand-heading" className="sec-h2">
            What is House of Spells?
          </h2>
          <p className="hub-brand-tagline">Earth&apos;s Multi-Fandom Universe</p>
          <p className="hub-brand-oneliner">Every fandom. Every universe. One planet-scale destination.</p>
          <p className="hub-brand-manifesto">
            <strong>House of Spells</strong> was established in the United Kingdom — built on one radical belief that
            every fandom deserves a home worthy of its legend. The original UK chapter continues to serve fans across
            multiple locations.
          </p>
          <p className="hub-brand-manifesto">
            Now the House has crossed the Atlantic, opening a 50,000 sq ft flagship in{' '}
            <strong>Times Square, New York</strong> — and the journey doesn&apos;t stop there.{' '}
            <strong>Kuala Lumpur, Malaysia</strong> is next, arriving November 2026.
          </p>
        </section>

        <section className="hub-countries" aria-labelledby="hub-countries-heading">
          <p className="eyebrow">Our Locations</p>
          <h2 id="hub-countries-heading" className="sec-h2">
            One House. Three Chapters.
          </h2>
          {suggested ? (
            <p className="hub-suggest-note">We&apos;ve highlighted the chapter nearest to you.</p>
          ) : (
            <p className="hub-suggest-note">Choose the chapter closest to you.</p>
          )}
          <div className="hub-country-grid">
            {COUNTRIES.map((country) => {
              const isSuggested = suggested?.code === country.code;
              return (
                <article
                  key={country.code}
                  className={`hub-card hub-card--${country.accent}${isSuggested ? ' hub-card--suggested' : ''}`}
                >
                  <div className="hub-card-meta">
                    <span className={`hub-badge hub-badge--${country.status}`}>{STATUS_LABEL[country.status]}</span>
                    {isSuggested ? <span className="hub-suggest">Suggested for you</span> : null}
                  </div>
                  <h3 className="hub-card-name">{country.name}</h3>
                  <p className="hub-card-detail">{country.detail}</p>
                  <p className="hub-card-tagline">{country.tagline}</p>
                  <div className="hub-card-ctas">
                    <a
                      className="btn-p"
                      href={country.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${country.name}`}
                    >
                      {country.status === 'coming-soon' ? 'Learn More' : 'Visit'}
                    </a>
                    <a
                      className="btn-g"
                      href={country.shopHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Shop ${country.name}`}
                    >
                      {country.status === 'coming-soon' ? 'Pre-Register' : 'Shop'}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <HubFandomWorld initialItems={fandomItems} defaultShopHref={fandomShopBase} />

        <footer className="hub-footer">
          <nav className="hub-footer-links" aria-label="Hub">
            <Link href="/privacy">Privacy</Link>
            <a href="https://houseofspells.com/careers" target="_blank" rel="noopener noreferrer">
              Careers
            </a>
          </nav>
          <p className="hub-footer-copyright">
            © 2026 House of Spells. All rights reserved.
            <br />
            Born in the United Kingdom. The original chapter lives on at{' '}
            <a href="https://www.houseofspells.co.uk" target="_blank" rel="noopener noreferrer">
              houseofspells.co.uk
            </a>
            .
          </p>
        </footer>
      </main>
    </LandingShell>
  );
}
