'use client';

import { useEffect, useRef } from 'react';

type Star = {
  x: number;
  y: number;
  r: number;
  a: number;
  da: number;
  vx: number;
  vy: number;
  gold: boolean;
};

type Blob = {
  x: number;
  y: number;
  r: number;
  h: number;
  a: number;
  vx: number;
  vy: number;
  ph: number;
};

const BLOBS: Blob[] = [
  { x: 0.15, y: 0.2, r: 0.22, h: 260, a: 0.028, vx: 0.00008, vy: 0.00005, ph: 0 },
  { x: 0.8, y: 0.15, r: 0.18, h: 200, a: 0.022, vx: -0.00007, vy: 0.00009, ph: 1 },
  { x: 0.5, y: 0.6, r: 0.26, h: 280, a: 0.025, vx: 0.00005, vy: -0.00008, ph: 2 },
  { x: 0.2, y: 0.75, r: 0.2, h: 220, a: 0.02, vx: 0.00009, vy: 0.00007, ph: 3 },
  { x: 0.85, y: 0.7, r: 0.19, h: 240, a: 0.022, vx: -0.00006, vy: -0.00006, ph: 4 },
  { x: 0.5, y: 0.08, r: 0.15, h: 300, a: 0.018, vx: 0.00004, vy: 0.00008, ph: 5 },
];

function starCount() {
  try {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData) return 64;
  } catch {
    /* ignore */
  }
  if (innerWidth < 420) return 72;
  if (innerWidth < 760) return 130;
  return 200;
}

export function NebulaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let T = 0;
    let paused = false;
    let rafId = 0;

    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let stars: Star[] = Array.from({ length: starCount() }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.3 + 0.15,
      a: Math.random() * 0.55 + 0.05,
      da: (Math.random() - 0.5) * 0.0007,
      vx: (Math.random() - 0.5) * 0.00009,
      vy: (Math.random() - 0.5) * 0.00009,
      gold: Math.random() > 0.72,
    }));

    const resize = () => {
      W = canvas.width = innerWidth;
      H = canvas.height = innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = (advance: boolean) => {
      if (advance) T += 0.004;
      ctx.clearRect(0, 0, W, H);
      BLOBS.forEach((b) => {
        if (advance) {
          b.x += b.vx;
          b.y += b.vy;
          if (b.x < -0.3 || b.x > 1.3) b.vx *= -1;
          if (b.y < -0.3 || b.y > 1.3) b.vy *= -1;
        }
        const p = 1 + 0.14 * Math.sin(T + b.ph);
        const g = ctx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r * W * p);
        g.addColorStop(0, `hsla(${b.h},55%,28%,${b.a})`);
        g.addColorStop(0.5, `hsla(${b.h},40%,18%,${b.a * 0.38})`);
        g.addColorStop(1, `hsla(${b.h},30%,10%,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(b.x * W, b.y * H, b.r * W * p, b.r * W * p * 0.58, T * 0.08, 0, Math.PI * 2);
        ctx.fill();
      });
      stars.forEach((s) => {
        if (advance) {
          s.x += s.vx;
          s.y += s.vy;
          s.a += s.da;
          if (s.x < 0 || s.x > 1) s.vx *= -1;
          if (s.y < 0 || s.y > 1) s.vy *= -1;
          if (s.a < 0.02 || s.a > 0.62) s.da *= -1;
        }
        ctx.save();
        ctx.globalAlpha = s.a;
        ctx.fillStyle = s.gold ? '#C9A84C' : '#EDE5D5';
        ctx.shadowColor = s.gold ? '#C9A84C' : '#fff';
        ctx.shadowBlur = s.gold ? 8 : 2;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    const loop = () => {
      if (!paused && !mqReduce.matches) {
        render(true);
        rafId = requestAnimationFrame(loop);
      }
    };

    const onVis = () => {
      paused = document.hidden;
      if (!paused && !mqReduce.matches) rafId = requestAnimationFrame(loop);
    };

    document.addEventListener('visibilitychange', onVis);

    if (mqReduce.matches) {
      render(false);
    } else {
      const kick = () => {
        rafId = requestAnimationFrame(loop);
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(kick, { timeout: 2200 });
      } else {
        setTimeout(kick, 48);
      }
    }

    const onReduce = () => {
      cancelAnimationFrame(rafId);
      if (mqReduce.matches) render(false);
      else rafId = requestAnimationFrame(loop);
    };
    mqReduce.addEventListener('change', onReduce);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      mqReduce.removeEventListener('change', onReduce);
    };
  }, []);

  return <canvas id="nebula" ref={canvasRef} aria-hidden="true" />;
}
