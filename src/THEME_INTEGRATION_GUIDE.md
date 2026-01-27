/**
 * Theme Integration Guide
 * 
 * This file shows how to integrate the theme system into existing components
 * from the Excel2SQL application (FileUpload, DataPreview, etc.)
 */

// ============================================
// Example 1: Updating FileUpload Component
// ============================================

/*
import { useThemeConfig } from '@/hooks/use-theme';

export function FileUpload({ onFileSelect, isLoading }: Props) {
  const { isDark, getThemeClass } = useThemeConfig();

  return (
    <div className={`drop-zone ${getThemeClass('drop-zone-idle', 'drop-zone-dark')}`}>
      {/* Drop zone with theme-aware styling */}
    </div>
  );
}
*/

// ============================================
// Example 2: Updating DataPreview Component
// ============================================

/*
export function DataPreview({ data }: Props) {
  const { isDark } = useThemeConfig();

  // Theme-aware class selection
  const headerClass = isDark
    ? 'bg-slate-800 text-slate-100'
    : 'bg-slate-50 text-slate-900';

  return (
    <div className="overflow-auto">
      <table className="text-xs font-mono">
        <thead className={headerClass}>
          {/* Headers */}
        </thead>
        <tbody className="divide-y">
          {/* Rows with alternating colors */}
        </tbody>
      </table>
    </div>
  );
}
*/

// ============================================
// Example 3: Updating SqlPreview Component
// ============================================

/*
import { useThemeEffect } from '@/hooks/use-theme';

export function SqlPreview({ sql }: Props) {
  const { isDark } = useThemeConfig();

  // Use theme effect to update syntax highlighting when theme changes
  useThemeEffect(() => {
    updateSyntaxHighlighting(isDark);
  });

  const syntaxTheme = isDark ? 'atom-one-dark' : 'atom-one-light';

  return (
    <SyntaxHighlighter language="sql" theme={syntaxTheme}>
      {sql}
    </SyntaxHighlighter>
  );
}
*/

// ============================================
// Example 4: Updating ColumnMappingPanel
// ============================================

/*
export function ColumnMappingPanel({ columns, mappings, onMappingsChange }: Props) {
  const { getThemeClass } = useThemeConfig();

  return (
    <div className={`panel ${getThemeClass('border-slate-200', 'border-slate-700')}`}>
      <div className={`panel-header ${getThemeClass('bg-slate-50', 'bg-slate-800')}`}>
        Column Mapping
      </div>
      {/* Panel content */}
    </div>
  );
}
*/

// ============================================
// Example 5: Updating SqlConfigPanel
// ============================================

/*
export function SqlConfigPanel({ config, onConfigChange }: Props) {
  const { isDark, getThemeValue } = useThemeConfig();

  // Switch between different option configurations based on theme
  const selectOptions = getThemeValue(
    { light: true, compact: false },
    { light: false, compact: true }
  );

  return (
    <div className="panel">
      {/* Configuration options */}
    </div>
  );
}
*/

// ============================================
// Example 6: Custom Hook for Excel2SQL Styling
// ============================================

export function useExcel2SQLTheme() {
  const { isDark, getThemeClass, getThemeValue } = useThemeConfig();

  return {
    // Panel styling
    panelClass: getThemeClass(
      'bg-white border-slate-200 text-slate-900',
      'bg-slate-800 border-slate-700 text-slate-100'
    ),

    // Header styling
    headerClass: getThemeClass(
      'bg-slate-50 text-slate-900',
      'bg-slate-700 text-slate-100'
    ),

    // Input styling
    inputClass: getThemeClass(
      'bg-white border-slate-300 text-slate-900',
      'bg-slate-700 border-slate-600 text-slate-100'
    ),

    // Table styling
    tableClass: getThemeClass(
      'border-slate-200',
      'border-slate-700'
    ),

    // Badge styling
    badgeVariant: isDark ? 'outline' : 'default',

    // Icon color
    iconColor: getThemeValue('#0084D4', '#00D9FF'),

    // SQL syntax highlighting theme
    syntaxTheme: isDark ? 'atom-one-dark' : 'atom-one-light',
  };
}

// ============================================
// Usage in Components
// ============================================

/*
import { useExcel2SQLTheme } from '@/hooks/use-excel2sql-theme';

export function MyComponent() {
  const theme = useExcel2SQLTheme();

  return (
    <div className={`panel ${theme.panelClass}`}>
      <div className={theme.headerClass}>Header</div>
      <input className={theme.inputClass} />
    </div>
  );
}
*/
