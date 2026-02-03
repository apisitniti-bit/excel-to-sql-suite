/**
 * VLOOKUP Types - Clean separation from SQL generation
 * Cross-sheet lookup support with clear error handling
 */

import type { ExcelSheet } from './index';

/** Type of lookup source */
export type LookupSourceType = 'inline' | 'sheet' | 'file';

/** Single VLOOKUP configuration - completely separate from ColumnMapping */
export interface VLookupConfig {
  /** Unique identifier for this lookup */
  id: string;
  
  /** Column in main data that contains lookup keys */
  sourceColumn: string;

  /** Sheet where lookup results should be written (defaults to active sheet) */
  targetSheet?: string;
  
  /** Output column name (defaults to sourceColumn if not specified) */
  targetColumn?: string;

  /** Optional target cell (e.g. "G2") to write lookup results */
  targetCell?: string;

  /** Allow overwriting existing values at target cell column */
  allowOverwrite?: boolean;
  
  /** Type of lookup source */
  sourceType: LookupSourceType;
  
  // Inline lookup: key-value map
  inlineMap?: Record<string, string>;
  
  // Sheet lookup: cross-sheet reference
  sheetLookup?: {
    /** Name of sheet containing lookup table */
    sheetName: string;
    /** Column in lookup sheet containing keys */
    keyColumn: string;
    /** Column in lookup sheet containing values */
    valueColumn: string;
  };
  
  // File lookup: external file (future)
  fileLookup?: {
    fileId: string;
    keyColumn: string;
    valueColumn: string;
  };
  
  /** Value when key not found (null for NULL, string for default) */
  defaultValue: string | null;
  
  /** Case-sensitive matching */
  caseSensitive: boolean;
  
  /** Trim whitespace from keys before matching */
  trimKeys: boolean;
}

/** Collection of VLOOKUP configurations */
export interface VLookupSet {
  /** Whether VLOOKUP processing is enabled */
  enabled: boolean;
  
  /** Individual lookup configurations */
  lookups: VLookupConfig[];
  
  /** Preview mode - show lookups without generating SQL */
  previewOnly: boolean;
}

/** Result of applying VLOOKUPs */
export interface VLookupResult {
  /** Transformed rows */
  rows: unknown[][];
  
  /** Headers after VLOOKUP (may include new columns) */
  headers: string[];
  
  /** Statistics per lookup */
  stats: LookupStats[];
  
  /** Any errors encountered */
  errors: LookupError[];
}

/** Statistics for a single lookup */
export interface LookupStats {
  lookupId: string;
  sourceColumn: string;
  targetColumn: string;
  totalRows: number;
  matched: number;
  unmatched: number;
  nullInputs: number;
}

/** Lookup error with context */
export interface LookupError {
  lookupId: string;
  type: 'missing_sheet' | 'missing_column' | 'missing_key' | 'empty_result' | 'invalid_target_cell' | 'overwrite' | 'parse_error';
  message: string;
  /** Row index where error occurred (-1 for config errors) */
  row?: number;
  /** Source value that caused error */
  value?: unknown;
}

/** Multi-sheet context for cross-sheet lookups */
export interface MultiSheetContext {
  /** All available sheets */
  sheets: Map<string, ExcelSheet>;
  
  /** Primary/active sheet being processed */
  primarySheet: string;
  
  /** Get sheet by name (throws if not found) */
  getSheet(name: string): ExcelSheet;
  
  /** Check if sheet exists */
  hasSheet(name: string): boolean;
  
  /** Get column index by name (case/whitespace insensitive) */
  getColumnIndex(sheet: ExcelSheet, columnName: string): number;
  
  /** Get column name by index */
  getColumnName(sheet: ExcelSheet, index: number): string;
}

/** Column info with sample values for preview */
export interface ColumnInfo {
  name: string;
  index: number;
  /** Sample values from first few rows */
  samples: unknown[];
  /** Detected data type hint */
  typeHint: 'text' | 'number' | 'date' | 'boolean' | 'mixed';
  /** Null/empty count in samples */
  nullCount: number;
}

/** Preview data - independent from SQL generation */
export interface PreviewData {
  columns: ColumnInfo[];
  rowCount: number;
  sampleRows: unknown[][];
  sheets: string[];
  activeSheet: string;
}

/** Default empty VLOOKUP set */
export const DEFAULT_VLOOKUP_SET: VLookupSet = {
  enabled: false,
  lookups: [],
  previewOnly: false,
};

/** Create a cross-sheet lookup config */
export function createCrossSheetLookup(
  sourceColumn: string,
  targetSheet: string,
  keyColumn: string,
  valueColumn: string,
  options?: Partial<Omit<VLookupConfig, 'sourceType' | 'sheetLookup'>>
): VLookupConfig {
  return {
    id: options?.id ?? `lookup_${Date.now()}`,
    sourceColumn,
    targetColumn: options?.targetColumn ?? sourceColumn,
    sourceType: 'sheet',
    sheetLookup: {
      sheetName: targetSheet,
      keyColumn,
      valueColumn,
    },
    defaultValue: options?.defaultValue ?? null,
    caseSensitive: options?.caseSensitive ?? false,
    trimKeys: options?.trimKeys ?? true,
  };
}

/** Create an inline lookup config */
export function createInlineLookup(
  sourceColumn: string,
  map: Record<string, string>,
  options?: Partial<Omit<VLookupConfig, 'sourceType' | 'inlineMap'>>
): VLookupConfig {
  return {
    id: options?.id ?? `lookup_${Date.now()}`,
    sourceColumn,
    targetColumn: options?.targetColumn ?? sourceColumn,
    sourceType: 'inline',
    inlineMap: map,
    defaultValue: options?.defaultValue ?? null,
    caseSensitive: options?.caseSensitive ?? false,
    trimKeys: options?.trimKeys ?? true,
  };
}
