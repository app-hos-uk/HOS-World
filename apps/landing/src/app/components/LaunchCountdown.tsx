'use client';

import { useEffect } from 'react';

/** 29 July 2026, 10:00 AM America/New_York (EDT, UTC−4) */
const LAUNCH_INSTANT = Date.parse('2026-07-29T14:00:00.000Z');
const LAUNCH_LABEL = 'July 29, 2026 · 10:00 AM EDT';

type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function getRemaining(now: number): CountdownParts | null {
  const diff = LAUNCH_INSTANT - now;
  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function showLive(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('.launch-countdown__grid');
  const eyebrow = root.querySelector<HTMLElement>('.launch-countdown__eyebrow');
  const headline = root.querySelector<HTMLElement>('.launch-countdown__headline');
  const subline = root.querySelector<HTMLElement>('.launch-countdown__subline');
  if (grid) grid.hidden = true;
  if (eyebrow) eyebrow.hidden = true;
  if (headline) headline.hidden = true;
  if (subline) subline.hidden = true;
  if (root.querySelector('.launch-countdown--live-panel')) return;

  root.classList.add('launch-countdown--live');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');

  const panel = document.createElement('div');
  panel.className = 'launch-countdown--live-panel';
  panel.innerHTML =
    '<p class="launch-countdown__eyebrow launch-countdown__eyebrow--celebrate">The gates are open</p>' +
    '<p class="launch-countdown__headline launch-countdown__headline--live">We\'re live in <span class="launch-countdown__place">Times Square, New York</span></p>' +
    '<p class="launch-countdown__subline">House of Spells has arrived. Every universe. One destination.</p>';
  root.appendChild(panel);
}

/** Bind a live ticker to the current DOM nodes; safe to call on every client mount. */
function bindCountdown(root: HTMLElement) {
  const days = root.querySelector<HTMLElement>('#cd-days');
  const hours = root.querySelector<HTMLElement>('#cd-hours');
  const minutes = root.querySelector<HTMLElement>('#cd-minutes');
  const seconds = root.querySelector<HTMLElement>('#cd-seconds');

  const tick = () => {
    const remaining = getRemaining(Date.now());
    if (!remaining) {
      showLive(root);
      return;
    }
    if (days) days.textContent = pad2(remaining.days);
    if (hours) hours.textContent = pad2(remaining.hours);
    if (minutes) minutes.textContent = pad2(remaining.minutes);
    if (seconds) seconds.textContent = pad2(remaining.seconds);
    root.setAttribute(
      'aria-label',
      `Grand launch in Times Square, New York. ${remaining.days} days, ${remaining.hours} hours, ${remaining.minutes} minutes, ${remaining.seconds} seconds remaining.`,
    );
  };

  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}

/**
 * Server-painted countdown digits + client interval that rebinds on every mount
 * (including Next.js client navigations back to Home).
 */
export function LaunchCountdown() {
  const initial = getRemaining(Date.now());

  useEffect(() => {
    const root = document.getElementById('launch-countdown');
    if (!root) return;
    return bindCountdown(root);
  }, []);

  if (!initial) {
    return (
      <div className="launch-countdown launch-countdown--live" role="status" aria-live="polite">
        <p className="launch-countdown__eyebrow launch-countdown__eyebrow--celebrate">The gates are open</p>
        <p className="launch-countdown__headline launch-countdown__headline--live">
          We&apos;re live in <span className="launch-countdown__place">Times Square, New York</span>
        </p>
        <p className="launch-countdown__subline">
          House of Spells has arrived. Every universe. One destination.
        </p>
      </div>
    );
  }

  return (
    <div
      className="launch-countdown launch-countdown--ready"
      id="launch-countdown"
      role="timer"
      aria-live="off"
      data-launch-instant={String(LAUNCH_INSTANT)}
      aria-label={`Grand launch in Times Square, New York on ${LAUNCH_LABEL}`}
    >
      <p className="launch-countdown__eyebrow launch-countdown__eyebrow--celebrate">Grand Launch</p>
      <p className="launch-countdown__headline">
        <span className="launch-countdown__place">Times Square, New York</span>
      </p>
      <p className="launch-countdown__subline">{LAUNCH_LABEL}</p>

      <div className="launch-countdown__grid">
        <div className="launch-countdown__unit">
          <span className="launch-countdown__value" id="cd-days" suppressHydrationWarning>
            {pad2(initial.days)}
          </span>
          <span className="launch-countdown__label">Days</span>
        </div>
        <div className="launch-countdown__unit">
          <span className="launch-countdown__value" id="cd-hours" suppressHydrationWarning>
            {pad2(initial.hours)}
          </span>
          <span className="launch-countdown__label">Hours</span>
        </div>
        <div className="launch-countdown__unit">
          <span className="launch-countdown__value" id="cd-minutes" suppressHydrationWarning>
            {pad2(initial.minutes)}
          </span>
          <span className="launch-countdown__label">Minutes</span>
        </div>
        <div className="launch-countdown__unit launch-countdown__unit--pulse">
          <span className="launch-countdown__value" id="cd-seconds" suppressHydrationWarning>
            {pad2(initial.seconds)}
          </span>
          <span className="launch-countdown__label">Seconds</span>
        </div>
      </div>
    </div>
  );
}
