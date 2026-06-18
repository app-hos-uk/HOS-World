'use client';

import { NebulaCanvas } from './NebulaCanvas';
import { MagicCursor } from './MagicCursor';
import { LandingNav } from './LandingNav';
import { useScrollReveal } from './useScrollReveal';
import type { LandingNavKey } from '../lib/constants';

type Props = {
  nav: LandingNavKey;
  mainId: string;
  children: React.ReactNode;
  revealKey?: unknown;
};

export function LandingShell({ nav, mainId, children, revealKey }: Props) {
  useScrollReveal([revealKey]);

  return (
    <>
      <a className="skip-link" href={`#${mainId}`}>
        Skip to main content
      </a>
      <div className="grain" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <MagicCursor />
      <NebulaCanvas />
      <LandingNav active={nav} />
      {children}
    </>
  );
}
