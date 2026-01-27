import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Sun, Moon, Laptop } from 'lucide-react';

/**
 * Theme selector component with dropdown menu
 * Allows users to switch between light, dark, and system themes
 */
export function ThemeSelector() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Laptop className="h-4 w-4" /> },
  ];

  const currentThemeLabel = themeOptions.find(opt => opt.value === theme)?.label || 'Theme';
  
  // Icon for the trigger button based on resolved theme
  const TriggerIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        asChild
      >
        <div>
          <TriggerIcon className="h-4 w-4 transition-all duration-300" />
          <span className="sr-only">Toggle theme</span>
        </div>
      </Button>
      
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {themeOptions.map(option => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
            className="flex items-center gap-2 cursor-pointer"
            data-state={theme === option.value ? 'checked' : 'unchecked'}
          >
            <span className="flex items-center justify-center w-4 h-4">
              {option.icon}
            </span>
            <span className="flex-1">{option.label}</span>
            {theme === option.value && (
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
