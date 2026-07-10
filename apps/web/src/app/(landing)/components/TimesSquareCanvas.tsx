'use client';

import { useEffect, useRef } from 'react';
import { LANDING_LOGO, LANDING_WORDMARK } from '../lib/constants';

export function TimesSquareCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tc = canvas.getContext('2d');
    if (!tc) return;

    let tsW = 0;
    let tsH = 0;
    const parent = canvas.parentElement;
    if (!parent) return;

    const buildings = [
      { x: 0.02, w: 0.12, h: 0.7, col: '#0A0A18' },
      { x: 0.15, w: 0.08, h: 0.55, col: '#080810' },
      { x: 0.24, w: 0.14, h: 0.8, col: '#0C0C20' },
      { x: 0.39, w: 0.1, h: 0.65, col: '#0A0A18' },
      { x: 0.5, w: 0.16, h: 0.9, col: '#080812' },
      { x: 0.67, w: 0.09, h: 0.6, col: '#0C0C1A' },
      { x: 0.77, w: 0.12, h: 0.75, col: '#080810' },
      { x: 0.9, w: 0.1, h: 0.55, col: '#0A0A18' },
    ];
    const billboards = [
      { bx: 0.05, by: 0.12, bw: 0.1, bh: 0.18, col: '#FF3822', logo: '/landing/fandom/marvel-tile.svg', alt: 'MARVEL' },
      { bx: 0.18, by: 0.22, bw: 0.08, bh: 0.12, col: '#FFE81F', logo: '/landing/fandom/starwars.svg', alt: 'STAR WARS' },
      { bx: 0.27, by: 0.08, bw: 0.12, bh: 0.2, col: '#9C55DD', logo: '/landing/fandom/wizarding.svg', alt: 'WIZARDING' },
      { bx: 0.44, by: 0.05, bw: 0.14, bh: 0.22, col: '#5B8A32', logo: '/landing/fandom/vikings.svg', alt: 'VIKINGS' },
      { bx: 0.6, by: 0.15, bw: 0.09, bh: 0.14, col: '#4DAAFF', logo: '/landing/fandom/dc.svg', alt: 'DC' },
      { bx: 0.72, by: 0.1, bw: 0.11, bh: 0.18, col: '#E85D04', logo: '/landing/fandom/naruto-konoha.svg', alt: 'NARUTO' },
      { bx: 0.86, by: 0.2, bw: 0.1, bh: 0.14, col: '#44BB77', logo: '/landing/fandom/ghibli.svg', alt: 'GHIBLI' },
    ];
    const images = new Map<string, HTMLImageElement>();
    billboards.forEach((bb) => {
      if (!bb.logo) return;
      const im = new Image();
      im.src = bb.logo;
      images.set(bb.logo, im);
    });
    const hosLogo = new Image();
    hosLogo.src = LANDING_WORDMARK;
    images.set(LANDING_WORDMARK, hosLogo);

    const crowd = Array.from({ length: 120 }, () => ({
      x: Math.random(),
      y: 0.78 + Math.random() * 0.15,
      vx: (Math.random() - 0.5) * 0.002,
      a: Math.random() * 0.6 + 0.2,
      r: Math.random() * 1.5 + 0.5,
    }));

    let tsT = 0;
    let rafId = 0;

    const rsz = () => {
      tsW = canvas.width = parent.offsetWidth;
      tsH = canvas.height = parent.offsetHeight;
    };
    rsz();
    window.addEventListener('resize', rsz);

    const loop = () => {
      tc.clearRect(0, 0, tsW, tsH);
      const sky = tc.createLinearGradient(0, 0, 0, tsH);
      sky.addColorStop(0, '#02020A');
      sky.addColorStop(0.5, '#05051A');
      sky.addColorStop(1, '#0A0A28');
      tc.fillStyle = sky;
      tc.fillRect(0, 0, tsW, tsH);
      for (let i = 0; i < 60; i++) {
        tc.fillStyle = `rgba(255,255,255,${0.1 + 0.3 * Math.sin(tsT + i)})`;
        tc.fillRect(Math.sin(i * 7.3) * tsW * 0.5 + tsW * 0.5, (i / 60) * tsH * 0.4, 1, 1);
      }
      buildings.forEach((b) => {
        tc.fillStyle = b.col;
        tc.fillRect(b.x * tsW, tsH * (1 - b.h), b.w * tsW, tsH * b.h);
        for (let wy = 0; wy < 20; wy++)
          for (let wx = 0; wx < 5; wx++) {
            if (Math.sin(wy * 3.7 + wx * 5.1 + tsT * 0.5 + b.x * 10) > 0.3) {
              tc.fillStyle = `rgba(255,220,100,${0.2 + 0.3 * Math.sin(tsT + wy)})`;
              tc.fillRect(b.x * tsW + wx * ((b.w * tsW) / 5) + 2, tsH * (1 - b.h) + wy * 20 + 4, (b.w * tsW) / 5 - 4, 12);
            }
          }
      });
      billboards.forEach((bb) => {
        const pulse = 0.7 + 0.3 * Math.sin(tsT * 2 + bb.bx * 10);
        tc.save();
        tc.globalAlpha = pulse;
        tc.fillStyle = `${bb.col}40`;
        tc.fillRect(bb.bx * tsW, bb.by * tsH, bb.bw * tsW, bb.bh * tsH);
        tc.strokeStyle = bb.col;
        tc.lineWidth = 1;
        tc.strokeRect(bb.bx * tsW, bb.by * tsH, bb.bw * tsW, bb.bh * tsH);
        tc.shadowColor = bb.col;
        tc.shadowBlur = 20;
        const ix = bb.bx * tsW;
        const iy = bb.by * tsH;
        const iw = bb.bw * tsW;
        const ih = bb.bh * tsH;
        const im = images.get(bb.logo);
        if (im?.complete && im.naturalWidth > 0) {
          const pad = Math.max(4, Math.min(iw, ih) * 0.12);
          const aw = iw - pad * 2;
          const ah = ih - pad * 2;
          const ir = im.naturalWidth / im.naturalHeight;
          const dr = aw / ah;
          let dw: number;
          let dh: number;
          let dx: number;
          let dy: number;
          if (ir > dr) {
            dw = aw;
            dh = aw / ir;
            dx = ix + pad;
            dy = iy + (ih - dh) / 2;
          } else {
            dh = ah;
            dw = ah * ir;
            dx = ix + (iw - dw) / 2;
            dy = iy + pad;
          }
          tc.drawImage(im, dx, dy, dw, dh);
        } else {
          tc.fillStyle = bb.col;
          tc.font = `bold ${bb.bh * tsH * 0.33}px Cinzel Decorative,serif`;
          tc.textAlign = 'center';
          tc.textBaseline = 'middle';
          tc.fillText(bb.alt || '', ix + iw / 2, iy + ih / 2);
        }
        tc.restore();
      });
      const street = tc.createLinearGradient(0, tsH * 0.78, 0, tsH);
      street.addColorStop(0, 'rgba(201,168,76,.12)');
      street.addColorStop(1, 'rgba(5,5,13,.9)');
      tc.fillStyle = street;
      tc.fillRect(0, tsH * 0.78, tsW, tsH * 0.22);
      crowd.forEach((p) => {
        p.x += p.vx;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        tc.save();
        tc.globalAlpha = p.a;
        tc.fillStyle = '#8A8070';
        tc.beginPath();
        tc.arc(p.x * tsW, p.y * tsH, p.r, 0, Math.PI * 2);
        tc.fill();
        tc.restore();
      });
      tc.save();
      const signW = Math.min(tsW * 0.48, 420);
      const signH = signW * 0.252;
      const cx = tsW * 0.5;
      const cy = tsH * 0.45;
      tc.shadowColor = '#C9A84C';
      tc.shadowBlur = 30 + 10 * Math.sin(tsT);
      tc.strokeStyle = 'rgba(201,168,76,.55)';
      tc.lineWidth = 1.5;
      tc.strokeRect(cx - signW * 0.5 - 8, cy - signH * 0.5 - 6, signW + 16, signH + 12);
      const logo = images.get(LANDING_WORDMARK);
      if (logo?.complete && logo.naturalWidth > 0) {
        tc.imageSmoothingEnabled = true;
        tc.imageSmoothingQuality = 'high';
        tc.drawImage(logo, cx - signW * 0.5, cy - signH * 0.5, signW, signH);
      } else {
        tc.font = `bold ${Math.max(18, tsH * 0.045)}px Cinzel Decorative,serif`;
        tc.textAlign = 'center';
        tc.fillStyle = 'rgba(201,168,76,.9)';
        tc.fillText('HOUSE OF SPELLS', cx, cy + 4);
      }
      tc.restore();
      tsT += 0.02;
      rafId = requestAnimationFrame(loop);
    };

    const kick = () => setTimeout(() => {
      rafId = requestAnimationFrame(loop);
    }, 80);
    if ('requestIdleCallback' in window) requestIdleCallback(kick, { timeout: 3200 });
    else kick();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', rsz);
    };
  }, []);

  return <canvas className="ts-canvas" id="tsCanvas" ref={canvasRef} aria-hidden="true" />;
}
