import Link from 'next/link';
import { LandingShell } from './components/LandingShell';
import { LandingFooter } from './components/LandingFooter';
import { LandingStructuredData } from './components/LandingStructuredData';
import { Ticker } from './components/Ticker';
import { FanFloaters } from './components/FanFloaters';
import { LANDING_LOGO, LANDING_REGISTER_PATH, LANDING_WORDMARK } from './lib/constants';

export default function LandingHomePage() {
  return (
    <LandingShell nav="home" mainId="pg-home">
      <LandingStructuredData />
      <main id="pg-home" className="hos-page" tabIndex={-1}>
        <div className="hero-inner">
          <FanFloaters />
          <div className="hero-brand-lockup">
            <div className="hero-logo-wrap">
              <div className="hero-logo-ring" />
              <div className="hero-logo-ring2" />
              <img
                className="hero-logo-img"
                id="heroLogoImg"
                src={LANDING_LOGO}
                width={240}
                height={240}
                fetchPriority="high"
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
          <p className="h-ny-banner" role="status">
            A grand launch in <span className="h-ny-place">Times Square, New York</span> &mdash; coming soon.
          </p>
          <p className="h-pre">Earth&apos;s Multi-Fandom Universe &nbsp;·&nbsp; Times Square &nbsp;·&nbsp; New York</p>
          <div className="h-rule" />
          <p className="h-tag">
            <em>Every fandom. Every universe. Every legend.</em>
            <br />
            One planet-scale destination where all worlds collide.
          </p>
          <div className="h-btns">
            <Link href="/universes" className="btn-p">
              ✦ &nbsp;Explore Universes
            </Link>
            <Link href={LANDING_REGISTER_PATH} className="btn-g">
              Claim Your Place
            </Link>
          </div>
          <div className="h-scroll">
            <span>Discover</span>
            <div className="scroll-bar" />
          </div>
        </div>

        <Ticker />

        <div className="stats-strip">
          <div className="stat-cell rv">
            <div className="stat-value">50+</div>
            <div className="stat-label">Universes</div>
          </div>
          <div className="stat-cell rv" style={{ transitionDelay: '.1s' }}>
            <div className="stat-value">10K+</div>
            <div className="stat-label">Products</div>
          </div>
          <div className="stat-cell rv" style={{ transitionDelay: '.2s' }}>
            <div className="stat-value">1M+</div>
            <div className="stat-label">Fans Worldwide</div>
          </div>
          <div className="stat-cell rv" style={{ transitionDelay: '.3s' }}>
            <div className="stat-value">NYC</div>
            <div className="stat-label">Next Destination</div>
          </div>
        </div>

        <div className="manifesto-grid">
          <div className="rv-l">
            <div
              style={{
                fontFamily: "'Cinzel Decorative',serif",
                fontSize: 'clamp(5rem,12vw,10rem)',
                fontWeight: 900,
                lineHeight: 1,
                color: 'transparent',
                WebkitTextStroke: '1px rgba(201,168,76,.14)',
                userSelect: 'none',
              }}
            >
              ∞
            </div>
            <div
              style={{
                width: 1,
                height: 80,
                background: 'linear-gradient(180deg,transparent,var(--gold),transparent)',
                margin: '14px 0',
              }}
            />
            <div
              style={{
                fontFamily: "'Cinzel Decorative',serif",
                fontSize: 'clamp(3rem,7vw,6rem)',
                color: 'transparent',
                WebkitTextStroke: '1px rgba(201,168,76,.18)',
              }}
            >
              ONE
            </div>
          </div>
          <div className="rv-r">
            <h3 className="manifesto-h3">
              No single universe
              <br />
              owns this space.
            </h3>
            <p className="manifesto-lead">
              Born in the United Kingdom, <strong>House of Spells</strong> was built on one radical belief — that every
              fandom deserves a home worthy of its legend.
              <br />
              <br />
              <strong>Marvel or Middle Earth. Star Wars or Studio Ghibli. DC or Dragon Age.</strong> Every world stands
              equal. Every fan is sovereign.
              <br />
              <br />
              Now <strong>houseofspells.com</strong> brings that vision to the centre of the world — opening in Times
              Square, New York.
            </p>
            <div className="manifesto-cta">
              <Link href="/the-experience" className="btn-p">
                Discover the Experience
              </Link>
            </div>
          </div>
        </div>

        <Ticker reverse />

        <div style={{ height: 60 }} />
        <LandingFooter />
      </main>
    </LandingShell>
  );
}
