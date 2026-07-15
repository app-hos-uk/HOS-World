import type { Theme } from '@hos-marketplace/shared-types';
import { hosTheme } from './theme';

type AnyRecord = Record<string, any>;

function isObject(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Convert an API theme (design tokens nested under `config`) into the client
 * `Theme` shape. Every token falls back to the HOS default theme, so the
 * result is always fully populated and safe to render. Returns null when the
 * input has no usable colors, letting callers keep the current theme instead.
 */
export function normalizeApiTheme(raw: unknown): Theme | null {
  if (!isObject(raw)) return null;

  // Tokens may live under `config` (API shape) or at the root (client shape).
  const source: AnyRecord = isObject(raw.config) && isObject(raw.config.colors) ? raw.config : raw;
  const colors = isObject(source.colors) ? source.colors : null;
  if (!colors || typeof colors.primary !== 'string') return null;

  // `text` is usually { primary, secondary } but custom color maps may store a single string.
  const rawText = colors.text;
  const text = isObject(rawText)
    ? {
        primary: typeof rawText.primary === 'string' ? rawText.primary : hosTheme.colors.text.primary,
        secondary: typeof rawText.secondary === 'string' ? rawText.secondary : hosTheme.colors.text.secondary,
      }
    : typeof rawText === 'string'
      ? { primary: rawText, secondary: rawText }
      : { ...hosTheme.colors.text };

  const typography = isObject(source.typography) ? source.typography : {};
  const fontFamily = isObject(typography.fontFamily) ? typography.fontFamily : {};

  const type = raw.type === 'seller' || raw.type === 'customer' ? raw.type : 'hos';

  return {
    id: typeof raw.id === 'string' ? raw.id : hosTheme.id,
    name: typeof raw.name === 'string' ? raw.name : hosTheme.name,
    type,
    owner: typeof raw.sellerId === 'string' ? raw.sellerId : undefined,
    colors: {
      primary: colors.primary,
      secondary: typeof colors.secondary === 'string' ? colors.secondary : hosTheme.colors.secondary,
      background: typeof colors.background === 'string' ? colors.background : hosTheme.colors.background,
      surface: typeof colors.surface === 'string' ? colors.surface : hosTheme.colors.surface,
      text,
      accent: typeof colors.accent === 'string' ? colors.accent : hosTheme.colors.accent,
      error: typeof colors.error === 'string' ? colors.error : hosTheme.colors.error,
      success: typeof colors.success === 'string' ? colors.success : hosTheme.colors.success,
      warning: typeof colors.warning === 'string' ? colors.warning : hosTheme.colors.warning,
    },
    typography: {
      fontFamily: {
        primary: typeof fontFamily.primary === 'string' ? fontFamily.primary : hosTheme.typography.fontFamily.primary,
        secondary: typeof fontFamily.secondary === 'string' ? fontFamily.secondary : hosTheme.typography.fontFamily.secondary,
      },
      fontSize: { ...hosTheme.typography.fontSize, ...(isObject(typography.fontSize) ? typography.fontSize : {}) },
      fontWeight: { ...hosTheme.typography.fontWeight, ...(isObject(typography.fontWeight) ? typography.fontWeight : {}) },
    },
    spacing: { ...hosTheme.spacing, ...(isObject(source.spacing) ? source.spacing : {}) },
    borderRadius: { ...hosTheme.borderRadius, ...(isObject(source.borderRadius) ? source.borderRadius : {}) },
    shadows: { ...hosTheme.shadows, ...(isObject(source.shadows) ? source.shadows : {}) },
  };
}
