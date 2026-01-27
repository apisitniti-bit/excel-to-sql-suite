/**
 * Example Component: Theme System Usage
 * 
 * This file demonstrates various ways to use the theme system in components.
 */

import { useTheme } from '@/contexts/ThemeContext';
import { useThemeConfig } from '@/hooks/use-theme';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * Example 1: Basic Theme Information Display
 */
export function ThemeInfoCard() {
  const { theme, resolvedTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Theme Information</CardTitle>
        <CardDescription>Current theme settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <span className="text-sm font-medium">User Preference:</span>
          <Badge className="ml-2">{theme}</Badge>
        </div>
        <div>
          <span className="text-sm font-medium">Resolved Theme:</span>
          <Badge variant="secondary" className="ml-2">{resolvedTheme}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Example 2: Theme-Aware Styling with Conditional Classes
 */
export function ThemedBox() {
  const { isDark, getThemeClass } = useThemeConfig();

  return (
    <div
      className={`p-6 rounded-lg border ${getThemeClass(
        'bg-blue-50 border-blue-200 text-blue-900',
        'bg-blue-950 border-blue-800 text-blue-100'
      )}`}
    >
      <p className="font-medium">
        {isDark ? '🌙 Dark Mode' : '☀️ Light Mode'} is currently active
      </p>
    </div>
  );
}

/**
 * Example 3: Theme-Sensitive Data Display
 */
export function DataVisualization() {
  const { isDark, getThemeValue } = useThemeConfig();

  const chartColors = getThemeValue(
    { primary: '#0084D4', secondary: '#00C2FF', accent: '#FFB81C' },
    { primary: '#00D9FF', secondary: '#0095FF', accent: '#FFC107' }
  );

  return (
    <div className="p-4 border rounded-lg">
      <p className="text-sm font-medium mb-3">Chart Colors</p>
      <div className="flex gap-2">
        <div
          className="w-12 h-12 rounded"
          style={{ backgroundColor: chartColors.primary }}
          title="Primary"
        />
        <div
          className="w-12 h-12 rounded"
          style={{ backgroundColor: chartColors.secondary }}
          title="Secondary"
        />
        <div
          className="w-12 h-12 rounded"
          style={{ backgroundColor: chartColors.accent }}
          title="Accent"
        />
      </div>
    </div>
  );
}

/**
 * Example 4: Feature Detection Based on Theme
 */
export function AdaptiveComponent() {
  const { resolvedTheme, theme, setTheme } = useTheme();

  const adaptiveContent = {
    light: {
      emoji: '🌅',
      message: 'Good morning! Light mode optimized for bright environments.',
      tips: 'Best for daytime use',
    },
    dark: {
      emoji: '🌙',
      message: 'Good evening! Dark mode reduces eye strain.',
      tips: 'Best for low-light environments',
    },
  };

  const content = adaptiveContent[resolvedTheme];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{content.emoji}</span>
          <span>Adaptive Content</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p>{content.message}</p>
        <Badge variant="outline">{content.tips}</Badge>
        {theme !== 'system' && (
          <p className="text-xs text-muted-foreground">
            Theme is locked to {theme} mode. Set to 'system' to auto-detect.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Example 5: Custom Color Palette Based on Theme
 */
export function ColorPalette() {
  const { isDark } = useThemeConfig();

  const palette = isDark
    ? {
        background: 'rgb(13, 13, 18)',
        surface: 'rgb(24, 24, 31)',
        primary: 'rgb(0, 150, 255)',
        text: 'rgb(230, 230, 240)',
      }
    : {
        background: 'rgb(250, 250, 252)',
        surface: 'rgb(255, 255, 255)',
        primary: 'rgb(0, 130, 220)',
        text: 'rgb(20, 20, 40)',
      };

  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(palette).map(([name, color]) => (
        <div key={name} className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded border"
            style={{ backgroundColor: color }}
          />
          <div className="text-xs">
            <p className="font-medium capitalize">{name}</p>
            <p className="text-muted-foreground">{color}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Integration Example: Using in a Real Component
 */
export function DataPreviewExample() {
  const { isDark } = useThemeConfig();

  // Example: Styling a data table based on theme
  const tableStyles = {
    headerBg: isDark ? 'bg-slate-800' : 'bg-slate-100',
    hoverBg: isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50',
    borderColor: isDark ? 'border-slate-700' : 'border-slate-200',
  };

  return (
    <div className={`border ${tableStyles.borderColor} rounded-lg overflow-hidden`}>
      <div className={`${tableStyles.headerBg} p-3 font-medium text-sm`}>
        Column Name
      </div>
      <div className={`p-3 ${tableStyles.hoverBg} cursor-pointer`}>
        Sample Data
      </div>
    </div>
  );
}
