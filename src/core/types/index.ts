/**
 * Core types for excel-to-sql-suite
 * Framework-agnostic - usable in browser, Node.js, or CLI
 */

export type SqlMode = 'INSERT' | 'UPDATE' | 'UPSERT';

export type PostgresDataType =
  | 'TEXT'
  | 'VARCHAR'
  | 'CHAR'
  | 'INTEGER'
  | 'BIGINT'
  | 'SERIAL'
  | 'BIGSERIAL'
  | 'DECIMAL'
  | 'NUMERIC'
  | 'REAL'
  | 'DOUBLE PRECISION'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIME'
  | 'TIMESTAMP'
  | 'TIMESTAMPTZ'
  | 'INTERVAL'
  | 'JSON'
  | 'JSONB'
  | 'UUID'
  | 'BYTEA';

export interface ExcelCell {
  value: unknown;
  row: number;
  col: number;
}

export interface ExcelRow {
  cells: ExcelCell[];
  rowNumber: number;
}

export interface ExcelSheet {
  name: string;
  rowCount: number;
  headers: string[];
  rows: unknown[][];
}

/**
 * @deprecated Use ColumnAnalysis instead
 */
export interface ExcelColumn {
  name: string;
  index: number;
  sampleValues: string[];
  detectedType: PostgresDataType;
}

export interface ParsedExcelFile {
  fileName: string;
  sheets: ExcelSheet[];
  activeSheet: string;
}

export interface ColumnAnalysis {
  name: string;
  index: number;
  sampleValues: unknown[];
  nullCount: number;
  emptyStringCount: number;
  totalCount: number;
  uniqueValues: Set<unknown>;
  detectedType: PostgresDataType;
  confidence: number; // 0-1
}

export interface SchemaInference {
  columns: ColumnAnalysis[];
  suggestedPrimaryKey?: string;
  qualityScore: number; // 0-100
}

export interface ColumnMapping {
  excelColumn: string;
  pgColumn: string;
  dataType: PostgresDataType;
  isPrimaryKey: boolean;
  isNullable: boolean;
  isUnique: boolean;
  defaultValue?: string;
}

export interface SqlConfig {
  tableName: string;
  mode: 'INSERT' | 'UPDATE' | 'UPSERT';
  primaryKey: string[];
  conflictKeys: string[];
  batchSize: number;
  wrapInTransaction: boolean;
  onConflictAction: 'DO NOTHING' | 'DO UPDATE';
}

export interface ValidationError {
  row: number;
  column: string;
  value: unknown;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationError[];
  valid: boolean;
  rowCount: number;
  errorCount: number;
  warningCount: number;
}

export interface SqlGenerationResult {
  sql: string;
  statements: string[];
  rowCount: number;
  errors: ValidationError[];
}

export interface TypeRule {
  type: PostgresDataType;
  test: (value: string) => boolean;
  priority: number;
}
