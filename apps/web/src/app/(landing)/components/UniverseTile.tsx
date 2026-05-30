'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { Universe } from '../lib/universes';
import { LANDING_REGISTER_PATH } from '../lib/constants';

function uniHash(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function uniRand(seed?: number) {
  let a = seed || 1;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildUniGen(seedStr: string) {
  const rnd = uniRand(uniHash(seedStr) || 1);
  const blobs = Array.from({ length: 8 }, () => ({
    x: rnd(),
    y: rnd(),
    rx: rnd() * 0.38 + 0.1,
    ry: rnd() * 0.26 + 0.07,
    rot: rnd() * 6.28318,
    a: rnd() * 0.2 + 0.05,
  }));
  const stars = Array.from({ length: 48 }, () => ({ x: rnd(), y: rnd(), s: rnd() * 2.2 + 0.35, ph: rnd() * 6.28 }));
  const nodes = Array.from({ length: 7 }, () => ({ x: rnd() * 0.76 + 0.12, y: rnd() * 0.55 + 0.1 }));
  const lines: { a: (typeof nodes)[0]; b: (typeof nodes)[0]; o: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (rnd() > 0.52) lines.push({ a: nodes[i], b: nodes[j], o: rnd() });
    }
  }
  const rings = Array.from({ length: 5 }, () => ({ x: rnd(), y: rnd(), r: rnd() * 0.18 + 0.04, ph: rnd() * 6.28 }));
  const shards = Array.from({ length: 14 }, () => ({
    x: rnd(),
    y: rnd(),
    len: rnd() * 0.12 + 0.02,
    ang: rnd() * 6.28,
    w: rnd() * 0.5 + 0.2,
  }));
  return { blobs, stars, lines, rings, shards };
}

type Props = { u: Universe; idx: number };

export function UniverseTile({ u, idx }: Props) {
  const tileRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tile = tileRef.current;
    const cv = canvasRef.current;
    if (!tile || !cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const gen = buildUniGen(`${u.n}|hos-universe`);
    const rndP = uniRand(uniHash(`${u.n}particles`) || 2);
    const ptCount = innerWidth < 520 ? 22 : 38;
    const pts = Array.from({ length: ptCount }, () => ({
      x: rndP(),
      y: rndP(),
      vx: (rndP() - 0.5) * 0.001,
      vy: (rndP() - 0.5) * 0.001,
      r: rndP() * 1.6 + 0.25,
      a: rndP() * 0.45 + 0.08,
    }));
    let t = idx * 1.7;
    let rafId: number | null = null;
    let visible = false;

    const drawGenerated = (cW: number, cH: number, time: number) => {
      const drift = time * 0.014;
      gen.blobs.forEach((b) => {
        ctx.save();
        ctx.globalAlpha = b.a;
        const gx = b.x * cW + Math.sin(drift + b.rot) * 14;
        const gy = b.y * cH + Math.cos(drift * 0.82 + b.rot) * 11;
        ctx.translate(gx, gy);
        ctx.rotate(b.rot + drift * 0.28);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cW * b.rx);
        g.addColorStop(0, `${u.ac}66`);
        g.addColorStop(0.45, `${u.ac}24`);
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, cW * b.rx, cH * b.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      gen.rings.forEach((rg) => {
        ctx.save();
        ctx.strokeStyle = `${u.ac}40`;
        ctx.lineWidth = 1;
        const cx = rg.x * cW + Math.sin(time * 0.19 + rg.ph) * 10;
        const cy = rg.y * cH + Math.cos(time * 0.16 + rg.ph * 0.9) * 9;
        const rad = cW * rg.r * (0.88 + 0.12 * Math.sin(time * 0.9 + rg.ph));
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
      ctx.save();
      gen.lines.forEach((L) => {
        ctx.globalAlpha = 0.12 + L.o * 0.18;
        ctx.strokeStyle = u.ac;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(L.a.x * cW, L.a.y * cH);
        ctx.lineTo(L.b.x * cW, L.b.y * cH);
        ctx.stroke();
      });
      ctx.restore();
      gen.stars.forEach((s) => {
        const tw = 0.35 + 0.65 * Math.sin(time * 1.15 + s.ph + s.x * 18);
        ctx.fillStyle = u.ac;
        ctx.globalAlpha = tw * 0.5;
        ctx.beginPath();
        ctx.arc(s.x * cW, s.y * cH, s.s, 0, Math.PI * 2);
        ctx.fill();
      });
      gen.shards.forEach((sh) => {
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = u.ac;
        ctx.lineWidth = sh.w;
        const sx = sh.x * cW;
        const sy = sh.y * cH;
        const len = cH * sh.len;
        ctx.translate(sx, sy);
        ctx.rotate(sh.ang + drift * 0.15);
        ctx.beginPath();
        ctx.moveTo(0, -len);
        ctx.lineTo(0, len);
        ctx.stroke();
        ctx.restore();
      });
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      if (!visible) {
        rafId = null;
        return;
      }
      const cW = (cv.width = tile.offsetWidth || 330);
      const cH = (cv.height = tile.offsetHeight || 400);
      ctx.clearRect(0, 0, cW, cH);
      const bg = ctx.createLinearGradient(0, 0, cW, cH);
      u.cols.forEach((c2, i) => bg.addColorStop(i / (u.cols.length - 1), c2));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, cW, cH);
      drawGenerated(cW, cH, t);
      const bx = cW * 0.5 + Math.sin(t * 0.55) * cW * 0.11;
      const by = cH * 0.34 + Math.cos(t * 0.42) * cH * 0.09;
      const b1 = ctx.createRadialGradient(bx, by, 0, bx, by, cW * 0.48);
      b1.addColorStop(0, `${u.ac}1c`);
      b1.addColorStop(0.5, `${u.ac}08`);
      b1.addColorStop(1, 'transparent');
      ctx.fillStyle = b1;
      ctx.fillRect(0, 0, cW, cH);
      pts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;
        ctx.save();
        ctx.globalAlpha = p.a * (0.62 + 0.38 * Math.sin(t * 1.35 + p.x * 12));
        ctx.fillStyle = u.ac;
        ctx.shadowColor = u.ac;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x * cW, p.y * cH, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      for (let y = 0; y < cH; y += 5) {
        ctx.fillStyle = 'rgba(0,0,0,0.02)';
        ctx.fillRect(0, y, cW, 1);
      }
      t += 0.011;
      rafId = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          visible = en.isIntersecting;
          if (visible && rafId == null) rafId = requestAnimationFrame(loop);
        });
      },
      { rootMargin: '120px', threshold: 0 },
    );
    io.observe(tile);

    return () => {
      io.disconnect();
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [u, idx]);

  return (
    <div ref={tileRef} className={`uni-tile${u.featured ? ' featured' : ''}`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="uni-tile-overlay" />
      <div className="uni-tile-content">
        <div className="uni-tile-copy">
          <img className="uni-tile-logo" src={u.logo} alt={`${u.n} logo`} loading="lazy" />
          <div className="uni-tile-tag">{u.tag}</div>
          <div className="uni-tile-name">{u.n}</div>
          <div className="uni-tile-desc">{u.d}</div>
          <Link
            className="uni-tile-badge"
            href={`${LANDING_REGISTER_PATH}?interest=${encodeURIComponent(u.n)}`}
            aria-label={`I am interested in ${u.n} — register`}
          >
            I am Interested
          </Link>
        </div>
      </div>
    </div>
  );
}
