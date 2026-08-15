/**
 * Self-hosted @font-face declarations for every storefront theme font.
 *
 * Replaces a runtime <link> to fonts.googleapis.com, which leaked visitor IPs to Google.
 * Sellers choose a family at runtime, so every option has to be declared statically —
 * import this module (for its side effects) from any route that renders a themed storefront.
 *
 * Latin subsets only, weights 400-700 to match what the storefront UI uses. The @font-face
 * rules are cheap (~14KB of CSS total); font files are only fetched when a storefront
 * actually renders text in that family.
 *
 * Keep THEME_FONT_FAMILIES in sync with the imports below: a family listed there but not
 * imported here will silently fall back to system-ui.
 */
import '@fontsource/cormorant-garamond/latin-400.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
// Lato ships 400 and 700 only; 500/600 render as synthetic intermediates.
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/merriweather/latin-400.css';
import '@fontsource/merriweather/latin-500.css';
import '@fontsource/merriweather/latin-600.css';
import '@fontsource/merriweather/latin-700.css';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-500.css';
import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/open-sans/latin-400.css';
import '@fontsource/open-sans/latin-500.css';
import '@fontsource/open-sans/latin-600.css';
import '@fontsource/open-sans/latin-700.css';
import '@fontsource/oswald/latin-400.css';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/latin-700.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/raleway/latin-400.css';
import '@fontsource/raleway/latin-500.css';
import '@fontsource/raleway/latin-600.css';
import '@fontsource/raleway/latin-700.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-600.css';
import '@fontsource/roboto/latin-700.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-500.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-700.css';

/** Canonical list of families a storefront may select. */
export const THEME_FONT_FAMILIES = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Raleway',
  'Playfair Display',
  'Merriweather',
  'Oswald',
  'Nunito',
  'Source Sans 3',
  'Cormorant Garamond',
  'Figtree',
] as const;

export type ThemeFontFamily = (typeof THEME_FONT_FAMILIES)[number];

const THEME_FONT_FAMILY_SET: ReadonlySet<string> = new Set(THEME_FONT_FAMILIES);

/** Returns the family if it is a known self-hosted theme font, else null. */
export function sanitizeThemeFontFamily(family: string | undefined | null): ThemeFontFamily | null {
  const name = family?.trim();
  if (!name || !THEME_FONT_FAMILY_SET.has(name)) return null;
  return name as ThemeFontFamily;
}
