import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'theme-preference';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Get the system theme preference using prefers-color-scheme
 */
function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia(MEDIA_QUERY).matches ? 'dark' : 'light';
}

/**
 * Resolve the actual theme based on preference and system settings
 */
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

/**
 * Apply theme to document
 */
function applyTheme(resolvedTheme: 'light' | 'dark') {
  const html = document.documentElement;
  if (resolvedTheme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  
  // Set data attribute for alternative styling
  html.setAttribute('data-theme', resolvedTheme);
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage and system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem(storageKey) as Theme | null;
    const initialTheme = (savedTheme || defaultTheme) as Theme;
    
    setThemeState(initialTheme);
    const resolved = resolveTheme(initialTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    setMounted(true);
  }, [defaultTheme, storageKey]);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia(MEDIA_QUERY);
    
    const handleChange = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        applyTheme(newResolved);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply theme changes
  useEffect(() => {
    if (!mounted) return;

    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [theme, mounted]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(storageKey, newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  };

  const value: ThemeContextType = {
    theme,
    setTheme,
    resolvedTheme,
    toggleTheme,
  };

  // Prevent rendering until mounted to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to use the theme context
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
