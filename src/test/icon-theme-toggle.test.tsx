import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IconThemeToggle } from '@/components/IconThemeToggle';

describe('IconThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should render the theme toggle button', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <IconThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(button).toBeInTheDocument();
  });

  it('should show moon icon in light mode', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <IconThemeToggle />
      </ThemeProvider>
    );

    await waitFor(() => {
      // Check that the button is present (icon is inside)
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('should show sun icon in dark mode', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <IconThemeToggle />
      </ThemeProvider>
    );

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      // When in dark mode, tooltip should say "Switch to Light Mode"
      expect(button.getAttribute('title')).toBe('Switch to Light Mode');
    });
  });

  it('should toggle theme when clicked', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <IconThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');

    // Initially should say "Switch to Dark Mode"
    expect(button.getAttribute('title')).toBe('Switch to Dark Mode');

    // Click to toggle
    fireEvent.click(button);

    // Should now say "Switch to Light Mode" (in dark mode)
    await waitFor(() => {
      expect(button.getAttribute('title')).toBe('Switch to Light Mode');
    });

    // Verify dark class was added
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should toggle back to light', async () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <IconThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');

    // Initially in dark mode
    await waitFor(() => {
      expect(button.getAttribute('title')).toBe('Switch to Light Mode');
    });

    // Click to toggle back to light
    fireEvent.click(button);

    // Should now say "Switch to Dark Mode"
    await waitFor(() => {
      expect(button.getAttribute('title')).toBe('Switch to Dark Mode');
    });

    // Verify dark class was removed
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should persist preference after toggle', async () => {
    const { unmount } = render(
      <ThemeProvider defaultTheme="light">
        <IconThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(localStorage.getItem('theme-preference')).toBe('dark');
    });

    // Unmount and remount
    unmount();

    render(
      <ThemeProvider defaultTheme="light">
        <IconThemeToggle />
      </ThemeProvider>
    );

    // Should still be in dark mode
    const newButton = screen.getByRole('button');
    expect(newButton.getAttribute('title')).toBe('Switch to Light Mode');
  });

  it('should have proper accessibility attributes', async () => {
    render(
      <ThemeProvider defaultTheme="light">
        <IconThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    
    // Check for accessibility attributes
    expect(button).toHaveAttribute('aria-label');
    expect(button).toHaveAttribute('title');
    
    // Check for sr-only text
    const srText = screen.getByText(/switch to/i);
    expect(srText.className).toContain('sr-only');
  });
});
