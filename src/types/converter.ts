import type { DatabaseType } from '@/lib/adapters';

export type SqlMode = 'INSERT' | 'UPDATE' | 'UPSERT';

export type PostgresDataType =
  | 'TEXT'
  | 'VARCHAR'
  | 'INTEGER'
  | 'BIGINT'
  | 'DECIMAL'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIMESTAMP'
  | 'TIMESTAMPTZ'
  | 'JSON'
  | 'JSONB'
  | 'UUID';

export interface ExcelColumn {
  name: string;
  index: number;
  sampleValues: string[];
  detectedType: PostgresDataType;
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
  mode: SqlMode;
  database: DatabaseType;
  primaryKey: string[];
  conflictKeys: string[];
  options: {
    ignoreNullValues: boolean;
    trimStrings: boolean;
    castTypes: boolean;
    batchSize: number;
    wrapInTransaction: boolean;
    onConflictAction: 'DO NOTHING' | 'DO UPDATE';
  };
}

export interface ExcelData {
  headers: string[];
  rows: any[][];
  totalRows: number;
  fileName: string;
  sheetName: string;
  sheets: string[];
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ConversionState {
  step: 'upload' | 'mapping' | 'preview';
  excelData: ExcelData | null;
  columns: ExcelColumn[];
  mappings: ColumnMapping[];
  config: SqlConfig;
  sql: string;
  errors: ValidationError[];
}
