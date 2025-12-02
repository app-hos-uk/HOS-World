/**
 * Theme Switcher Utility
 * Handles runtime theme switching without page reload
 */

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: {
      primary: string;
      secondary: string;
    };
    accent: string;
    error: string;
    success: string;
    warning: string;
  };
  typography: {
    fontFamily: {
      primary: string;
      secondary: string;
    };
    fontSize: Record<string, string>;
  };
  spacing?: Record<string, string>;
  borderRadius?: Record<string, string>;
  shadows?: Record<string, string>;
}

export class ThemeSwitcher {
  private rootElement: HTMLElement;

  constructor(rootElement?: HTMLElement) {
    this.rootElement = rootElement || document.documentElement;
  }

  /**
   * Apply theme to the document
   */
  applyTheme(config: ThemeConfig): void {
    // Apply colors as CSS variables
    this.setCSSVariable('--color-primary', config.colors.primary);
    this.setCSSVariable('--color-secondary', config.colors.secondary);
    this.setCSSVariable('--color-background', config.colors.background);
    this.setCSSVariable('--color-surface', config.colors.surface);
    this.setCSSVariable('--color-text-primary', config.colors.text.primary);
    this.setCSSVariable('--color-text-secondary', config.colors.text.secondary);
    this.setCSSVariable('--color-accent', config.colors.accent);
    this.setCSSVariable('--color-error', config.colors.error);
    this.setCSSVariable('--color-success', config.colors.success);
    this.setCSSVariable('--color-warning', config.colors.warning);

    // Apply typography
    this.setCSSVariable(
      '--font-family-primary',
      config.typography.fontFamily.primary,
    );
    this.setCSSVariable(
      '--font-family-secondary',
      config.typography.fontFamily.secondary,
    );

    Object.entries(config.typography.fontSize).forEach(([key, value]) => {
      this.setCSSVariable(`--font-size-${key}`, value);
    });

    // Apply spacing
    if (config.spacing) {
      Object.entries(config.spacing).forEach(([key, value]) => {
        this.setCSSVariable(`--spacing-${key}`, value);
      });
    }

    // Apply border radius
    if (config.borderRadius) {
      Object.entries(config.borderRadius).forEach(([key, value]) => {
        this.setCSSVariable(`--border-radius-${key}`, value);
      });
    }

    // Apply shadows
    if (config.shadows) {
      Object.entries(config.shadows).forEach(([key, value]) => {
        this.setCSSVariable(`--shadow-${key}`, value);
      });
    }
  }

  /**
   * Apply seller custom colors on top of base theme
   */
  applyCustomColors(customColors: Record<string, string>): void {
    Object.entries(customColors).forEach(([key, value]) => {
      this.setCSSVariable(`--color-${key}`, value);
    });
  }

  /**
   * Switch theme smoothly with transition
   */
  switchTheme(config: ThemeConfig, transitionDuration: number = 300): void {
    this.rootElement.style.transition = `background-color ${transitionDuration}ms, color ${transitionDuration}ms`;
    this.applyTheme(config);

    // Remove transition after animation
    setTimeout(() => {
      this.rootElement.style.transition = '';
    }, transitionDuration);
  }

  /**
   * Get current theme from CSS variables
   */
  getCurrentTheme(): Partial<ThemeConfig> {
    return {
      colors: {
        primary: this.getCSSVariable('--color-primary') || '',
        secondary: this.getCSSVariable('--color-secondary') || '',
        background: this.getCSSVariable('--color-background') || '',
        surface: this.getCSSVariable('--color-surface') || '',
        text: {
          primary: this.getCSSVariable('--color-text-primary') || '',
          secondary: this.getCSSVariable('--color-text-secondary') || '',
        },
        accent: this.getCSSVariable('--color-accent') || '',
        error: this.getCSSVariable('--color-error') || '',
        success: this.getCSSVariable('--color-success') || '',
        warning: this.getCSSVariable('--color-warning') || '',
      },
    };
  }

  /**
   * Reset to default theme
   */
  resetTheme(): void {
    const defaultTheme: ThemeConfig = {
      colors: {
        primary: '#1a1a1a',
        secondary: '#6b7280',
        background: '#ffffff',
        surface: '#f9fafb',
        text: {
          primary: '#111827',
          secondary: '#6b7280',
        },
        accent: '#8b5cf6',
        error: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
      },
      typography: {
        fontFamily: {
          primary: '"Inter", system-ui, -apple-system, sans-serif',
          secondary: '"Georgia", serif',
        },
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
        },
      },
    };

    this.applyTheme(defaultTheme);
  }

  private setCSSVariable(name: string, value: string): void {
    this.rootElement.style.setProperty(name, value);
  }

  private getCSSVariable(name: string): string | null {
    return getComputedStyle(this.rootElement).getPropertyValue(name).trim() ||
      null;
  }
}

// Browser-only export
export const createThemeSwitcher = (rootElement?: HTMLElement) => {
  if (typeof window === 'undefined') {
    // Server-side: return no-op implementation
    return {
      applyTheme: () => {},
      applyCustomColors: () => {},
      switchTheme: () => {},
      getCurrentTheme: () => ({}),
      resetTheme: () => {},
    };
  }

  return new ThemeSwitcher(rootElement);
};


