import type { Theme } from '@hos-marketplace/shared-types';

// Base theme tokens
export const baseSpacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
};

export const baseBorderRadius = {
  sm: '0.25rem',    // 4px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  full: '9999px',
};

export const baseShadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

// House of Spells Default Theme - Dark luxury storefront
export const hosTheme: Theme = {
  id: 'hos-default',
  name: 'House of Spells Default',
  type: 'hos',
  colors: {
    primary: '#D4A847',           // Gold accent
    secondary: '#E0BC6A',         // Gold hover
    background: '#0D0D0D',        // Primary background
    surface: '#1E1E1E',           // Card / panel surface
    text: {
      primary: '#FFFFFF',         // Headings, primary text
      secondary: '#B0B0B0',       // Body text
    },
    accent: '#D4A847',            // Gold accent
    error: '#C0392B',             // Sale / error red
    success: '#27AE60',           // New / success green
    warning: '#D4A847',           // Gold warnings
  },
  typography: {
    fontFamily: {
      primary: '"Cinzel", serif',    // For headings, brand name, fandom titles
      secondary: '"Lora", serif',     // For body text, descriptions, prices
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: baseSpacing,
  borderRadius: baseBorderRadius,
  shadows: baseShadows,
};

// Customer Light Theme
export const customerLightTheme: Theme = {
  ...hosTheme,
  id: 'customer-light',
  name: 'Light Theme',
  type: 'customer',
};

// Customer Dark Theme - Dark luxury storefront (matches default)
export const customerDarkTheme: Theme = {
  ...hosTheme,
  id: 'customer-dark',
  name: 'Dark Theme',
  type: 'customer',
  colors: {
    primary: '#D4A847',
    secondary: '#E0BC6A',
    background: '#0D0D0D',
    surface: '#1E1E1E',
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
    },
    accent: '#D4A847',
    error: '#C0392B',
    success: '#27AE60',
    warning: '#D4A847',
  },
};

// Customer Accessibility Theme
export const customerAccessibilityTheme: Theme = {
  ...hosTheme,
  id: 'customer-accessibility',
  name: 'Accessibility Theme',
  type: 'customer',
  colors: {
    primary: '#000000',
    secondary: '#333333',
    background: '#ffffff',
    surface: '#f5f5f5',
    text: {
      primary: '#000000',
      secondary: '#333333',
    },
    accent: '#0066cc',
    error: '#cc0000',
    success: '#006600',
    warning: '#cc6600',
  },
  typography: {
    ...hosTheme.typography,
    fontSize: {
      xs: '0.875rem',   // 14px
      sm: '1rem',       // 16px
      base: '1.125rem', // 18px
      lg: '1.25rem',    // 20px
      xl: '1.5rem',     // 24px
      '2xl': '1.875rem', // 30px
      '3xl': '2.25rem',  // 36px
    },
  },
};

// Seller Theme Templates
export const sellerTemplateMinimal: Omit<Theme, 'id' | 'name' | 'type' | 'owner'> = {
  ...hosTheme,
  colors: {
    ...hosTheme.colors,
    primary: '#2563eb',
    accent: '#3b82f6',
  },
};

export const sellerTemplateModern: Omit<Theme, 'id' | 'name' | 'type' | 'owner'> = {
  ...hosTheme,
  colors: {
    ...hosTheme.colors,
    primary: '#7c3aed',
    accent: '#8b5cf6',
  },
};

export const sellerTemplateClassic: Omit<Theme, 'id' | 'name' | 'type' | 'owner'> = {
  ...hosTheme,
  colors: {
    ...hosTheme.colors,
    primary: '#059669',
    accent: '#10b981',
  },
};

export const sellerTemplateBold: Omit<Theme, 'id' | 'name' | 'type' | 'owner'> = {
  ...hosTheme,
  colors: {
    ...hosTheme.colors,
    primary: '#dc2626',
    accent: '#ef4444',
  },
};

// Theme registry
export const defaultThemes: Record<string, Theme> = {
  'hos-default': hosTheme,
  'customer-light': customerLightTheme,
  'customer-dark': customerDarkTheme,
  'customer-accessibility': customerAccessibilityTheme,
};

export const sellerTemplateThemes = {
  minimal: sellerTemplateMinimal,
  modern: sellerTemplateModern,
  classic: sellerTemplateClassic,
  bold: sellerTemplateBold,
};


