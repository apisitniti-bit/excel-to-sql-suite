import type { ExcelData, ExcelColumn, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';

/**
 * Default configuration settings for Excel-to-SQL conversion
 */
export const DEFAULT_CONFIG: Partial<SqlConfig> = {
  tableName: 'my_table',
  mode: 'INSERT',
  database: 'postgresql',
  options: {
    ignoreNullValues: false,
    trimStrings: true,
    castTypes: false,
    batchSize: 50000,  // 50k rows per batch
    wrapInTransaction: true,
    onConflictAction: 'DO UPDATE',
  },
};

/**
 * Apply default configuration on file import
 * - Sets all columns to TEXT data type by default
 * - Marks first column as Primary Key
 */
export function applyDefaults(
  excelData: ExcelData,
  columns: ExcelColumn[]
): {
  columns: ExcelColumn[];
  mappings: ColumnMapping[];
  primaryKeyIndex: number;
} {
  // Update columns: all default to TEXT
  const updatedColumns = columns.map((col, index) => ({
    ...col,
    detectedType: 'TEXT' as const,
  }));

  // Create column mappings with first column as PK
  const mappings: ColumnMapping[] = updatedColumns.map((col, index) => ({
    excelColumn: col.name,
    pgColumn: col.name.replace(/\s+/g, '_').toLowerCase(),
    dataType: 'TEXT' as const,
    isPrimaryKey: index === 0, // First column is PK
    isNullable: index !== 0,   // PK is not nullable
    isUnique: index === 0,     // PK is unique
  }));

  return {
    columns: updatedColumns,
    mappings,
    primaryKeyIndex: 0,
  };
}

/**
 * Get default SQL config with batch size optimizations
 */
export function getDefaultSqlConfig(tableName: string = 'my_table'): SqlConfig {
  return {
    tableName,
    mode: 'INSERT',
    database: 'postgresql',
    primaryKey: [], // Will be set based on primary key column
    conflictKeys: [],
    options: {
      ignoreNullValues: false,
      trimStrings: true,
      castTypes: false,
      batchSize: 50000, // 50k rows per batch
      wrapInTransaction: true,
      onConflictAction: 'DO UPDATE',
    },
  };
}

/**
 * Update config with primary key from mapping
 */
export function updateConfigWithPrimaryKey(
  config: SqlConfig,
  mappings: ColumnMapping[]
): SqlConfig {
  const pkColumns = mappings
    .filter(m => m.isPrimaryKey && m.pgColumn)
    .map(m => m.pgColumn);

  return {
    ...config,
    primaryKey: pkColumns,
  };
}
