/**
 * Platform display locale. Keep in sync with the API's PLATFORM_LOCALE /
 * PlatformRegionService and the storefront's DEFAULT_REGION.locale.
 */
export const LANDING_LOCALE = process.env.NEXT_PUBLIC_PLATFORM_LOCALE || 'en-US';

/** Official transparent brand marks (shared with storefront) */
export const LANDING_LOGO = '/assets/logo-emblem.png';
export const LANDING_WORDMARK = '/assets/logo-wordmark.png';

/** Founding member registration (avoids conflict with e-commerce /register) */
export const LANDING_REGISTER_PATH = '/founding-members';

export const TICKER_ITEMS = [
  "Earth's Multi-Fandom Universe",
  'Grand Launch · July 29 · 10:00 AM EDT',
  'Times Square · New York',
  'Marvel · Star Wars · DC Universe',
  'Naruto · Middle Earth · Studio Ghibli',
  'House Of Spells',
  'Every Universe. One Destination.',
  'Game of Thrones · Avatar · The Witcher',
];

/** Abstract multi-fandom / anime celebration icons (no trademarked logos). */
export const FLOAT_EMOJIS = [
  '🕷️', '🛸', '🦇', '💍', '⚡', '🐉', '🍥', '🦁', '🦊', '🌊',
  '🌀', '🗡️', '🎮', '🤖', '🌙', '👾', '🏰', '🔮', '🪄', '⚔️',
  '🦸', '🧿', '🌟', '🔥', '💫', '🦄', '🎭', '🧬',
];

export const REG_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbx51QGCWyhj7YepAjv1o1YF5d_1zJqJg1E-yoirSQgVKrP3vwazgcntXARn0kFQdLeW/exec';

export type LandingNavKey = 'home' | 'universes' | 'experience' | 'blog' | 'gallery' | 'register';
