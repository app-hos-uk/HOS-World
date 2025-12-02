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

// House of Spells Default Theme - Magical Color Palette
export const hosTheme: Theme = {
  id: 'hos-default',
  name: 'House of Spells Default',
  type: 'hos',
  colors: {
    primary: '#4c1d95',        // Deep purple - main brand color
    secondary: '#7c3aed',       // Medium purple - secondary accents
    background: '#ffffff',      // White background
    surface: '#faf5ff',        // Very light purple tint
    text: {
      primary: '#1e1b4b',      // Deep indigo for text
      secondary: '#6366f1',     // Indigo for secondary text
    },
    accent: '#d97706',          // Amber/gold - magical accent
    error: '#dc2626',           // Red for errors
    success: '#059669',          // Green for success
    warning: '#d97706',         // Amber for warnings
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

// Customer Dark Theme - Magical Dark Mode
export const customerDarkTheme: Theme = {
  ...hosTheme,
  id: 'customer-dark',
  name: 'Dark Theme',
  type: 'customer',
  colors: {
    primary: '#c4b5fd',         // Light purple
    secondary: '#a78bfa',        // Medium purple
    background: '#0f172a',       // Deep navy/slate
    surface: '#1e293b',          // Dark slate
    text: {
      primary: '#f1f5f9',        // Light gray
      secondary: '#cbd5e1',       // Medium gray
    },
    accent: '#fbbf24',           // Gold/amber
    error: '#f87171',            // Light red
    success: '#34d399',          // Light green
    warning: '#fbbf24',          // Amber
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


