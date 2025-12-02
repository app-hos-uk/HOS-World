import type { Theme } from '@hos-marketplace/shared-types';

/**
 * Generates CSS variables from a theme object
 */
export function themeToCSSVariables(theme: Theme): string {
  return `
    --color-primary: ${theme.colors.primary};
    --color-secondary: ${theme.colors.secondary};
    --color-background: ${theme.colors.background};
    --color-surface: ${theme.colors.surface};
    --color-text-primary: ${theme.colors.text.primary};
    --color-text-secondary: ${theme.colors.text.secondary};
    --color-accent: ${theme.colors.accent};
    --color-error: ${theme.colors.error};
    --color-success: ${theme.colors.success};
    --color-warning: ${theme.colors.warning};
    --font-family-primary: ${theme.typography.fontFamily.primary};
    --font-family-secondary: ${theme.typography.fontFamily.secondary};
    --spacing-xs: ${theme.spacing.xs};
    --spacing-sm: ${theme.spacing.sm};
    --spacing-md: ${theme.spacing.md};
    --spacing-lg: ${theme.spacing.lg};
    --spacing-xl: ${theme.spacing.xl};
    --spacing-2xl: ${theme.spacing['2xl']};
    --spacing-3xl: ${theme.spacing['3xl']};
    --border-radius-sm: ${theme.borderRadius.sm};
    --border-radius-md: ${theme.borderRadius.md};
    --border-radius-lg: ${theme.borderRadius.lg};
    --border-radius-xl: ${theme.borderRadius.xl};
    --border-radius-full: ${theme.borderRadius.full};
  `.trim();
}

/**
 * Merges a partial theme with a base theme
 */
export function mergeTheme(base: Theme, overrides: Partial<Theme>): Theme {
  return {
    ...base,
    ...overrides,
    colors: {
      ...base.colors,
      ...overrides.colors,
      text: {
        ...base.colors.text,
        ...overrides.colors?.text,
      },
    },
    typography: {
      ...base.typography,
      ...overrides.typography,
      fontFamily: {
        ...base.typography.fontFamily,
        ...overrides.typography?.fontFamily,
      },
      fontSize: {
        ...base.typography.fontSize,
        ...overrides.typography?.fontSize,
      },
      fontWeight: {
        ...base.typography.fontWeight,
        ...overrides.typography?.fontWeight,
      },
    },
    spacing: {
      ...base.spacing,
      ...overrides.spacing,
    },
    borderRadius: {
      ...base.borderRadius,
      ...overrides.borderRadius,
    },
    shadows: {
      ...base.shadows,
      ...overrides.shadows,
    },
    sellerBranding: {
      ...base.sellerBranding,
      ...overrides.sellerBranding,
    },
  };
}

/**
 * Validates if an object is a valid theme
 */
export function isValidTheme(obj: any): obj is Theme {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    ['hos', 'seller', 'customer'].includes(obj.type) &&
    typeof obj.colors === 'object' &&
    typeof obj.typography === 'object' &&
    typeof obj.spacing === 'object' &&
    typeof obj.borderRadius === 'object' &&
    typeof obj.shadows === 'object'
  );
}


