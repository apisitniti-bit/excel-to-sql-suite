import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Index from '@/pages/Index';

describe('Index Page - Footer and Layout', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <ThemeProvider defaultTheme="system">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            {component}
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    );
  };

  describe('Footer Text Update', () => {
    it('should display "Excel-HelpMe Converter" instead of "Excel2SQL Converter"', () => {
      renderWithProviders(<Index />);
      
      // Check for new text
      const footerText = screen.getByText(/Excel-HelpMe Converter • SQL injection safe • UTF-8 encoded/i);
      expect(footerText).toBeInTheDocument();
    });

    it('should NOT display old "Excel2SQL Converter" text', () => {
      renderWithProviders(<Index />);
      
      // Verify old text is not present
      const oldText = screen.queryByText(/Excel2SQL Converter • SQL injection safe • UTF-8 encoded/i);
      expect(oldText).not.toBeInTheDocument();
    });

    it('should contain all required footer information', () => {
      renderWithProviders(<Index />);
      
      const footerText = screen.getByText(/Excel-HelpMe Converter • SQL injection safe • UTF-8 encoded/i);
      expect(footerText).toHaveTextContent('Excel-HelpMe Converter');
      expect(footerText).toHaveTextContent('SQL injection safe');
      expect(footerText).toHaveTextContent('UTF-8 encoded');
    });
  });

  describe('Layout Structure', () => {
    it('should have footer element in document', () => {
      const { container } = renderWithProviders(<Index />);
      const footer = container.querySelector('footer');
      
      expect(footer).toBeInTheDocument();
    });

    it('should have footer with correct CSS classes for responsive layout', () => {
      const { container } = renderWithProviders(<Index />);
      const footer = container.querySelector('footer');
      
      // Check for responsive layout classes
      expect(footer?.className).toContain('border-t');
      expect(footer?.className).toContain('shrink-0');
      expect(footer?.className).toContain('py-4');
      expect(footer?.className).toContain('text-center');
    });

    it('should have main content area with overflow handling', () => {
      const { container } = renderWithProviders(<Index />);
      const main = container.querySelector('main');
      
      expect(main).toBeInTheDocument();
      expect(main?.className).toContain('overflow-auto');
      expect(main?.className).toContain('flex-1');
    });

    it('should have proper flex layout structure', () => {
      const { container } = renderWithProviders(<Index />);
      const layoutDiv = container.querySelector('.min-h-screen');
      
      expect(layoutDiv?.className).toContain('flex');
      expect(layoutDiv?.className).toContain('flex-col');
      expect(layoutDiv?.className).toContain('bg-background');
    });
  });

  describe('Footer Positioning', () => {
    it('should have footer with backdrop blur for visual hierarchy', () => {
      const { container } = renderWithProviders(<Index />);
      const footer = container.querySelector('footer');
      
      expect(footer?.className).toContain('backdrop-blur-sm');
      expect(footer?.className).toContain('bg-card/50');
    });

    it('should have paragraph inside footer with no margin', () => {
      const { container } = renderWithProviders(<Index />);
      const footer = container.querySelector('footer');
      const paragraph = footer?.querySelector('p');
      
      expect(paragraph).toBeInTheDocument();
      expect(paragraph?.className).toContain('m-0');
    });
  });

  describe('Responsive Behavior', () => {
    it('should maintain footer visibility on small screens', () => {
      renderWithProviders(<Index />);
      const footerText = screen.getByText(/Excel-HelpMe Converter/i);
      
      expect(footerText).toBeVisible();
    });

    it('should have header with sticky positioning', () => {
      const { container } = renderWithProviders(<Index />);
      const header = container.querySelector('header');
      
      expect(header?.className).toContain('sticky');
      expect(header?.className).toContain('top-0');
      expect(header?.className).toContain('z-50');
    });
  });
});
