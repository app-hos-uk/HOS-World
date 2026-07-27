'use client';

const SPARKLE_COUNT = 28;

const PARTICLES = Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
  id: i,
  left: `${((i * 37 + 11) % 90) + 5}%`,
  top: `${((i * 23 + 7) % 82) + 8}%`,
  delay: `${-(i * 0.35)}s`,
  duration: `${4 + (i % 5) * 0.7}s`,
  variant: i % 4,
}));

/** Floating gold sparkles for launch celebration mood (CSS-only motion). */
export function CelebrationSparkles() {
  return (
    <div className="celebration-sparkles" aria-hidden="true">
      {PARTICLES.map(({ id, left, top, delay, duration, variant }) => (
        <span
          key={id}
          className={`celebration-sparkle celebration-sparkle--v${variant}`}
          style={{ left, top, animationDelay: delay, animationDuration: duration }}
        />
      ))}
      <span className="celebration-burst celebration-burst--1" />
      <span className="celebration-burst celebration-burst--2" />
    </div>
  );
}
