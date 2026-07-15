import type { Theme } from '@hos-marketplace/shared-types';
import { hosTheme } from './theme';

type LooseTheme = Partial<Theme> & {
  id?: string;
  name?: string;
  config?: Partial<Theme> & Record<string, unknown>;
  colors?: Theme['colors'];
  typography?: Theme['typography'];
};

/**
 * API themes store tokens under `config`, while the client Theme type
 * expects top-level `colors` / `typography` / etc. Normalize either shape
 * and fill gaps from the HOS default theme.
 */
export function normalizeTheme(input: unknown): Theme | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as LooseTheme;
  const fromConfig = (raw.config && typeof raw.config === 'object' ? raw.config : {}) as Partial<Theme>;
  const colors = raw.colors ?? fromConfig.colors;
  const typography = raw.typography ?? fromConfig.typography;

  if (!colors || typeof colors !== 'object' || !('primary' in colors)) {
    // Incomplete API payload — keep hos defaults rather than crashing
    if (!raw.id) return null;
    return {
      ...hosTheme,
      id: String(raw.id),
      name: String(raw.name || hosTheme.name),
      type: (raw.type as Theme['type']) || hosTheme.type,
    };
  }

  return {
    ...hosTheme,
    ...fromConfig,
    ...raw,
    id: String(raw.id || hosTheme.id),
    name: String(raw.name || hosTheme.name),
    type: (raw.type as Theme['type']) || hosTheme.type,
    colors: {
      ...hosTheme.colors,
      ...colors,
      text: {
        ...hosTheme.colors.text,
        ...(colors.text || {}),
      },
    },
    typography: {
      ...hosTheme.typography,
      ...(typography || {}),
      fontFamily: {
        ...hosTheme.typography.fontFamily,
        ...(typography?.fontFamily || {}),
      },
      fontSize: {
        ...hosTheme.typography.fontSize,
        ...(typography?.fontSize || {}),
      },
      fontWeight: {
        ...hosTheme.typography.fontWeight,
        ...(typography?.fontWeight || {}),
      },
    },
    spacing: {
      ...hosTheme.spacing,
      ...((raw.spacing || fromConfig.spacing) as Theme['spacing']),
    },
    borderRadius: {
      ...hosTheme.borderRadius,
      ...((raw.borderRadius || fromConfig.borderRadius) as Theme['borderRadius']),
    },
    shadows: {
      ...hosTheme.shadows,
      ...((raw.shadows || fromConfig.shadows) as Theme['shadows']),
    },
  } as Theme;
}

export function isApplyableTheme(theme: unknown): theme is Theme {
  const normalized = normalizeTheme(theme);
  return Boolean(normalized?.colors?.primary && normalized?.typography?.fontFamily?.primary);
}
