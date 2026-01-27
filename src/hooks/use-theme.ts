import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Hook for getting theme-aware CSS classes and values
 * Provides convenient methods for working with themes in components
 */
export function useThemeConfig() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';
  const isLight = resolvedTheme === 'light';
  const isSystem = theme === 'system';

  /**
   * Get a conditional value based on current theme
   * @example
   * const bgColor = getThemeValue('bg-white', 'bg-slate-900');
   */
  function getThemeValue<T>(light: T, dark: T): T {
    return isDark ? dark : light;
  }

  /**
   * Get a conditional class based on current theme
   * @example
   * const className = getThemeClass('border-gray-200', 'border-gray-700');
   */
  function getThemeClass(light: string, dark: string): string {
    return isDark ? dark : light;
  }

  return {
    // Theme state
    theme,
    resolvedTheme,
    isDark,
    isLight,
    isSystem,
    
    // Theme controls
    setTheme,
    toggleTheme,
    
    // Utilities
    getThemeValue,
    getThemeClass,
  };
}

/**
 * Hook for listening to theme changes
 * Useful when you need to run side effects on theme change
 * @example
 * useThemeEffect(() => {
 *   // This runs when theme changes
 *   updateChartColors();
 * });
 */
export function useThemeEffect(callback: () => void) {
  const { resolvedTheme } = useTheme();
  
  React.useEffect(() => {
    callback();
  }, [resolvedTheme, callback]);
}
