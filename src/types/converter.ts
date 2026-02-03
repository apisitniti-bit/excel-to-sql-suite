/**
 * Re-export core types for backwards compatibility
 * UI components should migrate to using @/core/types directly
 * @deprecated Use @/core/types instead
 */

export type { SqlMode } from '@/core/types';
export type { PostgresDataType } from '@/core/types';
export type { ExcelColumn } from '@/core/types';
export type { ColumnMapping } from '@/core/types';
export type { SqlConfig } from '@/core/types';
export type { ValidationError } from '@/core/types';

/**
 * @deprecated Use ExcelSheet from @/core/types
 */
export interface ExcelData {
  headers: string[];
  rows: unknown[][];
  totalRows: number;
  fileName: string;
  sheetName: string;
  sheets: string[];
}

import type { SqlConfig as CoreSqlConfig, ColumnMapping as CoreColumnMapping, ValidationError as CoreValidationError } from '@/core/types';

/**
 * @deprecated Use ValidationResult from @/core/types
 */
export interface ValidationResult {
  valid: boolean;
  errors: CoreValidationError[];
  warnings: CoreValidationError[];
}

/**
 * @deprecated Use ConversionState from @/core/types
 */
export interface ConversionState {
  step: 'upload' | 'mapping' | 'preview';
  excelData: {
    headers: string[];
    rows: unknown[][];
    totalRows: number;
    fileName: string;
    sheetName: string;
    sheets: string[];
  } | null;
  columns: {
    name: string;
    index: number;
    sampleValues: string[];
    detectedType: import('@/core/types').PostgresDataType;
  }[];
  mappings: CoreColumnMapping[];
  config: CoreSqlConfig;
  sql: string;
  errors: CoreValidationError[];
}
