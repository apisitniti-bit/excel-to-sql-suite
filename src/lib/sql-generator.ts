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
  const legacyOptions = (config as SqlConfig & { options?: Partial<SqlConfig> & { batchSize?: number; wrapInTransaction?: boolean; onConflictAction?: 'DO NOTHING' | 'DO UPDATE' } }).options;
  const batchSize = config.batchSize ?? legacyOptions?.batchSize ?? 1000;
  const wrapInTransaction = config.wrapInTransaction ?? legacyOptions?.wrapInTransaction ?? true;
  const onConflictAction = config.onConflictAction ?? legacyOptions?.onConflictAction ?? 'DO UPDATE';
  const primaryKeyFromMappings = mappings
    .filter(m => m.isPrimaryKey)
    .map(m => m.pgColumn)
    .filter(Boolean);
  const conflictKeys = config.conflictKeys?.length
    ? config.conflictKeys
    : (config.primaryKey?.length ? config.primaryKey : primaryKeyFromMappings);

  const result = coreGenerateSQL(
    config.tableName,
    mappings,
    excelData.rows,
    {
      tableName: config.tableName,
      mode: config.mode,
      primaryKey: config.primaryKey,
      conflictKeys,
      batchSize,
      wrapInTransaction,
      onConflictAction,
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
