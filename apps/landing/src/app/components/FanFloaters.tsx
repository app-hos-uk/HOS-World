import { FLOAT_EMOJIS } from '../lib/constants';

type Floater = {
  key: string;
  kind: 'emoji' | 'balloon';
  em?: string;
  left: string;
  duration: string;
  delay: string;
  size: string;
  sway: string;
  balloonTone: number;
};

/** Deterministic layout so particles don't jump between renders. */
function buildFloaters(): Floater[] {
  const items: Floater[] = [];

  FLOAT_EMOJIS.forEach((em, i) => {
    items.push({
      key: `e-${i}`,
      kind: 'emoji',
      em,
      left: `${((i * 41 + 7) % 92) + 4}%`,
      duration: `${14 + (i % 7) * 2.2}s`,
      delay: `${-((i * 1.1) % 12)}s`,
      size: `${1.35 + (i % 5) * 0.18}rem`,
      sway: `${(i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 4)}px`,
      balloonTone: i % 5,
    });
  });

  for (let i = 0; i < 10; i++) {
    items.push({
      key: `b-${i}`,
      kind: 'balloon',
      left: `${((i * 53 + 13) % 88) + 6}%`,
      duration: `${16 + (i % 5) * 2.5}s`,
      delay: `${-((i * 1.7) % 14)}s`,
      size: `${18 + (i % 4) * 6}px`,
      sway: `${(i % 2 === 0 ? 1 : -1) * (18 + (i % 3) * 6)}px`,
      balloonTone: i % 5,
    });
  }

  return items;
}

const FLOATERS = buildFloaters();

/**
 * Rising multi-fandom icons + balloon orbs.
 * CSS-driven so celebration shows even before/without hydration;
 * reduced-motion users get none via stylesheet media query.
 */
export function FanFloaters() {
  return (
    <div className="fan-floaters" aria-hidden="true">
      {FLOATERS.map((f) =>
        f.kind === 'balloon' ? (
          <span
            key={f.key}
            className={`floater floater--balloon floater--tone${f.balloonTone}`}
            style={{
              left: f.left,
              bottom: '-8%',
              width: f.size,
              height: `calc(${f.size} * 1.25)`,
              animationDuration: f.duration,
              animationDelay: f.delay,
              ['--floater-sway' as string]: f.sway,
            }}
          />
        ) : (
          <span
            key={f.key}
            className="floater floater--emoji"
            style={{
              left: f.left,
              bottom: '-5%',
              fontSize: f.size,
              animationDuration: f.duration,
              animationDelay: f.delay,
              ['--floater-sway' as string]: f.sway,
            }}
          >
            {f.em}
          </span>
        ),
      )}
    </div>
  );
}
