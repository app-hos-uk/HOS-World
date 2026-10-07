import { cookies } from 'next/headers';
import { LandingShell } from './LandingShell';
import { LANDING_LOGO, LANDING_WORDMARK } from '../lib/constants';

const COUNTRIES = [
  {
    code: 'US',
    name: 'United States',
    href: 'https://us.houseofspells.com',
    shopHref: 'https://shop.houseofspells.com',
    detail: 'Times Square, New York',
  },
  {
    code: 'MY',
    name: 'Malaysia',
    href: 'https://houseofspells.my',
    shopHref: 'https://shop.houseofspells.my',
    detail: 'Kuala Lumpur',
  },
];

export async function GlobalHub() {
  const jar = await cookies();
  const hinted = jar.get('hos_geo_country')?.value?.toUpperCase();
  const hint = COUNTRIES.find((c) => c.code === hinted);
  const defaultShop = hint?.shopHref ?? COUNTRIES[0].shopHref;

  return (
    <LandingShell nav="home" mainId="pg-home">
      <main id="pg-home" className="hos-page" tabIndex={-1}>
        <div className="hero-inner hero-inner--launch">
          <div className="hero-brand-lockup">
            <div className="hero-logo-wrap">
              <img
                className="hero-logo-img"
                src={LANDING_LOGO}
                width={240}
                height={240}
                alt=""
              />
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
          <p className="h-pre">
            <span className="h-pre-line">Choose your country</span>
          </p>
          {hint && (
            <p className="h-tag">
              It looks like you are in {hint.name}.{' '}
              <a href={hint.href}>{hint.detail}</a>
            </p>
          )}
          <div className="h-btns">
            {COUNTRIES.map((country) => (
              <a key={country.code} href={country.href} className="btn-p">
                {country.name}
              </a>
            ))}
            <a href={defaultShop} className="btn-g">
              Shop
            </a>
          </div>
        </div>
      </main>
    </LandingShell>
  );
}
