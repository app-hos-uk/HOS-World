#!/usr/bin/env node
/**
 * WCAG contrast guardrails for storefront tokens (mirrors globals.css :root).
 * Run: pnpm --filter @hos-marketplace/web test:contrast
 */

const TOKENS = {
  colorBgPrimary: '#070708',
  colorBgSecondary: '#0e0e12',
  colorTextPrimary: '#e8e4dc',
  colorTextSecondary: '#c9c3b6',
  colorTextMuted: '#9a958a',
  colorBorderInput: '#6b665c',
  colorAccentGold: '#C9A84C',
  colorAccentGoldDim: '#a08828',
  colorGoldCtaText: '#1a1406',
};

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  );
}

function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const checks = [
  {
    name: 'body primary text on page background (≥7:1)',
    ratio: contrastRatio(TOKENS.colorTextPrimary, TOKENS.colorBgPrimary),
    min: 7,
  },
  {
    name: 'secondary body text on card background (≥7:1)',
    ratio: contrastRatio(TOKENS.colorTextSecondary, TOKENS.colorBgSecondary),
    min: 7,
  },
  {
    name: 'muted / placeholder on card background (≥4.5:1)',
    ratio: contrastRatio(TOKENS.colorTextMuted, TOKENS.colorBgSecondary),
    min: 4.5,
  },
  {
    name: 'input border on card background (≥3:1)',
    ratio: contrastRatio(TOKENS.colorBorderInput, TOKENS.colorBgSecondary),
    min: 3,
  },
  {
    name: 'gold CTA text on gold button (≥4.5:1)',
    ratio: contrastRatio(TOKENS.colorGoldCtaText, TOKENS.colorAccentGold),
    min: 4.5,
  },
  {
    name: 'gold-dim label on page background (≥4.5:1)',
    ratio: contrastRatio(TOKENS.colorAccentGoldDim, TOKENS.colorBgPrimary),
    min: 4.5,
  },
  {
    name: 'primary input text brighter than muted placeholder',
    ratio: contrastRatio(TOKENS.colorTextPrimary, '#000000'),
    min: contrastRatio(TOKENS.colorTextMuted, '#000000'),
    compareOnly: true,
  },
];

let failed = 0;
for (const check of checks) {
  const pass = check.compareOnly
    ? check.ratio > check.min
    : check.ratio >= check.min;
  const label = check.compareOnly
    ? `${check.name}: ${check.ratio.toFixed(2)} vs ${check.min.toFixed(2)}`
    : `${check.name}: ${check.ratio.toFixed(2)}`;
  if (!pass) {
    console.error(`FAIL ${label}`);
    failed++;
  } else {
    console.log(`OK   ${label}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log('All contrast checks passed.');
