import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * Simple icon-based theme toggle button
 * Positioned for top-right placement
 * Shows Moon icon for light mode, Sun for dark mode
 */
export function IconThemeToggle() {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure component only renders after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Show appropriate icon based on resolved theme (not user preference)
  const isDark = resolvedTheme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const tooltip = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9 hover:bg-accent"
      title={tooltip}
      aria-label={tooltip}
    >
      <Icon className="h-4 w-4 transition-all duration-300 ease-in-out" />
      <span className="sr-only">{tooltip}</span>
    </Button>
  );
}
