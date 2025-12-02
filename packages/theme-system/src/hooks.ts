import { useThemeContext } from './theme-provider';
import type { Theme } from '@hos-marketplace/shared-types';

export function useTheme(): Theme {
  const { theme } = useThemeContext();
  return theme;
}

export function useThemeActions() {
  const { setTheme, setThemeById, loadTheme } = useThemeContext();
  return {
    setTheme,
    setThemeById,
    loadTheme,
  };
}


