'use client';

import { useEffect } from 'react';

export function MagicCursor() {
  useEffect(() => {
    const cur = document.getElementById('cur');
    const curR = document.getElementById('curR');
    const root = document.querySelector('.landing-site');
    if (!root) return;

    const mqFine = window.matchMedia('(pointer: fine)');
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const sync = () => {
      root.classList.toggle('use-magic-cursor', mqFine.matches && !mqReduce.matches);
    };
    mqFine.addEventListener('change', sync);
    mqReduce.addEventListener('change', sync);
    sync();

    let mx = -200;
    let my = -200;
    let rx = -200;
    let ry = -200;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    document.addEventListener('mousemove', onMove);

    let rafId = 0;
    const loop = () => {
      if (root.classList.contains('use-magic-cursor') && cur && curR) {
        cur.style.transform = `translate3d(${mx}px,${my}px,0)`;
        rx += (mx - rx) * 0.34;
        ry += (my - ry) * 0.34;
        curR.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMove);
      mqFine.removeEventListener('change', sync);
      mqReduce.removeEventListener('change', sync);
      root.classList.remove('use-magic-cursor');
    };
  }, []);

  return (
    <>
      <div className="cur" id="cur" aria-hidden="true" />
      <div className="cur-r" id="curR" aria-hidden="true" />
    </>
  );
}
