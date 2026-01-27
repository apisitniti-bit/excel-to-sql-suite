import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

// Test component that uses the theme
function TestComponent() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  
  return (
    <div>
      <div data-testid="theme-display">{theme}</div>
      <div data-testid="resolved-theme-display">{resolvedTheme}</div>
      <button onClick={() => setTheme('light')} data-testid="btn-light">
        Set Light
      </button>
      <button onClick={() => setTheme('dark')} data-testid="btn-dark">
        Set Dark
      </button>
      <button onClick={() => setTheme('system')} data-testid="btn-system">
        Set System
      </button>
      <button onClick={toggleTheme} data-testid="btn-toggle">
        Toggle
      </button>
      <div data-testid="dark-class">
        {document.documentElement.classList.contains('dark') ? 'has-dark' : 'no-dark'}
      </div>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Remove dark class before each test
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should render with default system theme', () => {
    render(
      <ThemeProvider defaultTheme="system">
        <TestComponent />
      </ThemeProvider>
    );

    const themeDisplay = screen.getByTestId('theme-display');
    expect(themeDisplay.textContent).toBe('system');
  });

  it('should set light theme', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>
    );

    const themeDisplay = screen.getByTestId('theme-display');
    expect(themeDisplay.textContent).toBe('light');

    // Verify dark class is not on html element
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('should set dark theme', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    );

    const themeDisplay = screen.getByTestId('theme-display');
    expect(themeDisplay.textContent).toBe('dark');

    // Verify dark class is on html element
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('should persist theme to localStorage', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>
    );

    const btnDark = screen.getByTestId('btn-dark');
    fireEvent.click(btnDark);

    await waitFor(() => {
      expect(localStorage.getItem('theme-preference')).toBe('dark');
    });
  });

  it('should restore theme from localStorage', () => {
    localStorage.setItem('theme-preference', 'dark');

    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>
    );

    const themeDisplay = screen.getByTestId('theme-display');
    // Should restore from localStorage, not use defaultTheme
    expect(themeDisplay.textContent).toBe('dark');
  });

  it('should toggle between light and dark', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <TestComponent />
      </ThemeProvider>
    );

    const btnToggle = screen.getByTestId('btn-toggle');
    const themeDisplay = screen.getByTestId('theme-display');

    // Initially light
    expect(themeDisplay.textContent).toBe('light');

    // Toggle to dark
    fireEvent.click(btnToggle);
    await waitFor(() => {
      expect(themeDisplay.textContent).toBe('dark');
    });

    // Toggle back to light
    fireEvent.click(btnToggle);
    await waitFor(() => {
      expect(themeDisplay.textContent).toBe('light');
    });
  });

  it('should apply dark class when resolvedTheme is dark', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('should remove dark class when resolvedTheme is light', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <TestComponent />
      </ThemeProvider>
    );

    const btnLight = screen.getByTestId('btn-light');
    fireEvent.click(btnLight);

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('should handle system theme with prefers-color-scheme', async () => {
    // Mock matchMedia
    const mockMatchMedia = (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    window.matchMedia = mockMatchMedia as any;

    render(
      <ThemeProvider defaultTheme="system">
        <TestComponent />
      </ThemeProvider>
    );

    const resolvedThemeDisplay = screen.getByTestId('resolved-theme-display');
    
    await waitFor(() => {
      // Should resolve to dark based on mocked prefers-color-scheme
      expect(resolvedThemeDisplay.textContent).toBe('dark');
    });
  });

  it('should throw error when useTheme is used outside ThemeProvider', () => {
    // Suppress console.error for this test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    spy.mockRestore();
  });
});
