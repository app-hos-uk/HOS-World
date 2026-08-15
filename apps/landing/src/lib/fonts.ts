import localFont from 'next/font/local';

/**
 * Fonts are self-hosted from the `@fontsource/*` packages rather than fetched with
 * `next/font/google`, which downloads from fonts.gstatic.com during `next build` and
 * fails the Docker build whenever the builder cannot reach it.
 *
 * Paths are relative to this file. Weights and styles must stay in sync with the
 * `--font-*` variables consumed by the landing stylesheets.
 *
 * Every option must be an inline literal — the font loader is evaluated at build time and
 * rejects shared constants, so the repeated fallback arrays cannot be extracted.
 */

export const cinzelDecorative = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/cinzel-decorative/files/cinzel-decorative-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/cinzel-decorative/files/cinzel-decorative-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/cinzel-decorative/files/cinzel-decorative-latin-900-normal.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-cinzel-decorative',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const cinzel = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/cinzel/files/cinzel-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/cinzel/files/cinzel-latin-500-normal.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
  ],
  variable: '--font-cinzel',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});

export const cormorant = localFont({
  src: [
    {
      path: '../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-normal.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-italic.woff2',
      weight: '300',
      style: 'italic',
    },
    {
      path: '../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-italic.woff2',
      weight: '600',
      style: 'italic',
    },
  ],
  variable: '--font-cormorant-landing',
  display: 'swap',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});
