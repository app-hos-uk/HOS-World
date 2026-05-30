'use client';

import { useEffect, useMemo, useState } from 'react';
import { FLOAT_EMOJIS } from '../lib/constants';

export function FanFloaters() {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const floaters = useMemo(
    () =>
      FLOAT_EMOJIS.map((em, i) => ({
        em,
        left: `${Math.random() * 100}%`,
        duration: `${15 + Math.random() * 20}s`,
        delay: `${Math.random() * 15}s`,
        size: `${1.2 + Math.random() * 0.8}rem`,
        key: i,
      })),
    [],
  );

  if (reducedMotion) return null;

  return (
    <div className="fan-floaters" id="fanFloaters" aria-hidden="true">
      {floaters.map((f) => (
        <div
          key={f.key}
          className="floater"
          style={{
            left: f.left,
            bottom: '-5%',
            animationDuration: f.duration,
            animationDelay: f.delay,
            fontSize: f.size,
          }}
        >
          {f.em}
        </div>
      ))}
    </div>
  );
}
