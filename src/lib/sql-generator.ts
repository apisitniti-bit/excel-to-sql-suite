/**
 * Compatibility wrapper for legacy UI imports
 * Re-exports from new core modules
 * @deprecated UI should migrate to @/core directly
 */

import { generateSQL as coreGenerateSQL } from '@/core/sql/generator';
import type { ColumnMapping, SqlConfig, ValidationError } from '@/core/types';

/**
 * @deprecated Use @/core/sql/generator instead
 */
export function generateSQL(
  excelData: {
    headers: string[];
    rows: unknown[][];
    totalRows: number;
    fileName: string;
    sheetName: string;
  },
  mappings: ColumnMapping[],
  config: SqlConfig
): { sql: string; errors: ValidationError[] } {
  const result = coreGenerateSQL(
    config.tableName,
    mappings,
    excelData.rows,
    {
      tableName: config.tableName,
      mode: config.mode,
      primaryKey: config.primaryKey,
      conflictKeys: config.conflictKeys,
      batchSize: config.batchSize || 1000,
      wrapInTransaction: config.wrapInTransaction ?? true,
      onConflictAction: config.onConflictAction,
    },
    {
      includeComments: true,
      ifNotExists: true,
      createTable: false, // Legacy didn't include CREATE TABLE
    }
  );

  return {
    sql: result.sql,
    errors: result.errors,
  };
}

/**
 * @deprecated Use native clipboard API instead
 */
export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

/**
 * @deprecated Use native Blob/URL API instead
 */
export function downloadSQL(sql: string, filename: string): void {
  const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
