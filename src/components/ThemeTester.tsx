import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

/**
 * Simple theme tester component
 * Use this to debug theme switching
 */
export function ThemeTester() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [hasDarkClass, setHasDarkClass] = useState(false);

  // Track dark class changes
  useEffect(() => {
    const updateDarkClass = () => {
      setHasDarkClass(document.documentElement.classList.contains('dark'));
    };
    
    // Update immediately
    updateDarkClass();
    
    // Watch for class changes (in case theme changes elsewhere)
    const observer = new MutationObserver(updateDarkClass);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  return (
    <div className="p-4 bg-background text-foreground border border-border rounded-lg space-y-3">
      <div className="text-sm font-medium">
        <p>Current theme: <span className="font-bold">{resolvedTheme}</span></p>
        <p>User preference: <span className="font-bold">{theme}</span></p>
        <p>HTML dark class: <span className="font-bold">{hasDarkClass ? 'YES ✓' : 'NO ✗'}</span></p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button 
          variant={theme === 'light' ? 'default' : 'outline'}
          onClick={() => {
            console.log('[ThemeTester] Switching to light');
            setTheme('light');
          }}
        >
          Light
        </Button>
        <Button 
          variant={theme === 'dark' ? 'default' : 'outline'}
          onClick={() => {
            console.log('[ThemeTester] Switching to dark');
            setTheme('dark');
          }}
        >
          Dark
        </Button>
        <Button 
          variant={theme === 'system' ? 'default' : 'outline'}
          onClick={() => {
            console.log('[ThemeTester] Switching to system');
            setTheme('system');
          }}
        >
          System
        </Button>
      </div>

      <div className="text-xs text-muted-foreground pt-2 border-t">
        <p>Check browser console for logs when buttons are clicked</p>
      </div>
    </div>
  );
}
