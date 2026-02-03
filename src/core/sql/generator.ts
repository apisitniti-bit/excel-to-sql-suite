/**
 * SQL Generation Module
 * PostgreSQL-only, framework-agnostic
 * Generates CREATE TABLE and INSERT/UPDATE/UPSERT statements
 */

import type {
  PostgresDataType,
  ColumnMapping,
  SqlConfig,
  ValidationError,
  SqlGenerationResult,
} from '../types';

export interface GenerateOptions {
  includeComments?: boolean;
  ifNotExists?: boolean;
  createTable?: boolean;
}

const DEFAULT_OPTIONS: GenerateOptions = {
  includeComments: true,
  ifNotExists: true,
  createTable: true,
};

/**
 * Escape a string value for PostgreSQL
 * Handles single quotes, backslashes, and null bytes
 */
export function escapeString(value: string): string {
  // Remove null bytes (PostgreSQL doesn't allow them in text)
  let escaped = value.replace(/\x00/g, '');
  
  // Escape backslashes first
  escaped = escaped.replace(/\\/g, '\\\\');
  
  // Escape single quotes
  escaped = escaped.replace(/'/g, "''");
  
  return escaped;
}

/**
 * Quote an identifier (table/column name)
 * Only quotes if necessary (reserved words or special chars)
 */
export function quoteIdentifier(name: string): string {
  // PostgreSQL reserved words that need quoting
  const reservedWords = new Set([
    'all', 'analyse', 'analyze', 'and', 'any', 'array', 'as', 'asc',
    'asymmetric', 'authorization', 'binary', 'both', 'case', 'cast',
    'check', 'collate', 'collation', 'column', 'concurrently', 'constraint',
    'create', 'cross', 'current_catalog', 'current_date', 'current_role',
    'current_schema', 'current_time', 'current_timestamp', 'current_user',
    'default', 'deferrable', 'desc', 'distinct', 'do', 'else', 'end',
    'except', 'false', 'fetch', 'for', 'foreign', 'freeze', 'from', 'full',
    'grant', 'group', 'having', 'ilike', 'in', 'initially', 'inner',
    'intersect', 'into', 'is', 'isnull', 'join', 'lateral', 'leading',
    'left', 'like', 'limit', 'localtime', 'localtimestamp', 'natural',
    'not', 'notnull', 'null', 'offset', 'on', 'only', 'or', 'order',
    'outer', 'overlaps', 'placing', 'primary', 'references', 'returning',
    'right', 'select', 'session_user', 'similar', 'some', 'symmetric',
    'table', 'tablesample', 'then', 'to', 'trailing', 'true', 'union',
    'unique', 'user', 'using', 'variadic', 'verbose', 'when', 'where',
    'window', 'with',
  ]);
  
  const lowerName = name.toLowerCase();
  
  // Quote if: reserved word, contains uppercase, starts with number, or has special chars
  if (
    reservedWords.has(lowerName) ||
    /[A-Z]/.test(name) ||
    /^\d/.test(name) ||
    /[^a-zA-Z0-9_]/.test(name)
  ) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  
  return name;
}

/**
 * Format a value for SQL based on its PostgreSQL type
 */
export function formatValue(
  value: unknown,
  dataType: PostgresDataType
): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  const strValue = String(value).trim();
  
  if (strValue === '') {
    return 'NULL';
  }
  
  switch (dataType) {
    case 'INTEGER':
    case 'BIGINT':
    case 'SERIAL':
    case 'BIGSERIAL':
      const intVal = parseInt(strValue, 10);
      if (isNaN(intVal)) {
        return 'NULL';
      }
      return `${intVal}`;
      
    case 'DECIMAL':
    case 'NUMERIC':
    case 'REAL':
    case 'DOUBLE PRECISION':
      const numVal = parseFloat(strValue);
      if (isNaN(numVal)) {
        return 'NULL';
      }
      return `${numVal}`;
      
    case 'BOOLEAN':
      const lower = strValue.toLowerCase();
      if (['true', '1', 'yes', 'y', 't'].includes(lower)) {
        return 'TRUE';
      }
      if (['false', '0', 'no', 'n', 'f'].includes(lower)) {
        return 'FALSE';
      }
      return 'NULL';
      
    case 'DATE':
    case 'TIMESTAMP':
    case 'TIMESTAMPTZ':
    case 'TIME':
      return `'${escapeString(strValue)}'`;
      
    case 'JSON':
    case 'JSONB':
      // Validate JSON
      try {
        JSON.parse(strValue);
        return `'${escapeString(strValue)}'`;
      } catch {
        return 'NULL';
      }
      
    case 'UUID':
      // Validate UUID format
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strValue)) {
        return `'${strValue.toLowerCase()}'`;
      }
      return 'NULL';
      
    case 'BYTEA':
      // Encode as hex
      const hex = Array.from(strValue)
        .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('');
      return `\\x${hex}`;
      
    case 'TEXT':
    case 'VARCHAR':
    case 'CHAR':
    default:
      return `'${escapeString(strValue)}'`;
  }
}

/**
 * Generate CREATE TABLE statement
 */
export function generateCreateTable(
  tableName: string,
  mappings: ColumnMapping[],
  options: GenerateOptions = {}
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const quotedTable = quoteIdentifier(tableName);
  const ifNotExists = opts.ifNotExists ? 'IF NOT EXISTS ' : '';
  
  const columns = mappings.map(mapping => {
    const parts: string[] = [quoteIdentifier(mapping.pgColumn), mapping.dataType];
    
    if (!mapping.isNullable) {
      parts.push('NOT NULL');
    }
    
    if (mapping.defaultValue !== undefined) {
      parts.push(`DEFAULT ${mapping.defaultValue}`);
    }
    
    if (mapping.isUnique) {
      parts.push('UNIQUE');
    }
    
    return parts.join(' ');
  });
  
  // Add primary key constraint
  const pkColumns = mappings.filter(m => m.isPrimaryKey);
  if (pkColumns.length > 0) {
    const pkNames = pkColumns.map(m => quoteIdentifier(m.pgColumn)).join(', ');
    columns.push(`PRIMARY KEY (${pkNames})`);
  }
  
  return `CREATE TABLE ${ifNotExists}${quotedTable} (
  ${columns.join(',\n  ')}
);`;
}

/**
 * Generate INSERT statements
 */
export function generateInserts(
  tableName: string,
  mappings: ColumnMapping[],
  rows: unknown[][],
  batchSize: number = 1000
): string[] {
  if (rows.length === 0) return [];
  
  const quotedTable = quoteIdentifier(tableName);
  const activeMappings = mappings.filter(m => m.pgColumn);
  
  if (activeMappings.length === 0) return [];
  
  const columnNames = activeMappings.map(m => quoteIdentifier(m.pgColumn));
  const colList = columnNames.join(', ');
  
  const statements: string[] = [];
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valueRows: string[] = [];
    
    for (const row of batch) {
      const values = activeMappings.map((mapping, idx) => {
        const value = row[mapping.excelColumn ? 
          parseInt(mapping.excelColumn.replace(/\D/g, ''), 10) || idx : idx];
        return formatValue(value, mapping.dataType);
      });
      valueRows.push(`(${values.join(', ')})`);
    }
    
    const stmt = `INSERT INTO ${quotedTable} (${colList})
VALUES
${valueRows.join(',\n')};`;
    
    statements.push(stmt);
  }
  
  return statements;
}

/**
 * Generate UPSERT statements (INSERT ... ON CONFLICT)
 */
export function generateUpserts(
  tableName: string,
  mappings: ColumnMapping[],
  rows: unknown[][],
  conflictKeys: string[],
  onConflictAction: 'DO NOTHING' | 'DO UPDATE' = 'DO UPDATE',
  batchSize: number = 1000
): string[] {
  if (rows.length === 0 || conflictKeys.length === 0) {
    return generateInserts(tableName, mappings, rows, batchSize);
  }
  
  const quotedTable = quoteIdentifier(tableName);
  const activeMappings = mappings.filter(m => m.pgColumn);
  
  if (activeMappings.length === 0) return [];
  
  const columnNames = activeMappings.map(m => quoteIdentifier(m.pgColumn));
  const colList = columnNames.join(', ');
  const conflictList = conflictKeys.map(k => quoteIdentifier(k)).join(', ');
  
  // Columns to update (exclude conflict keys)
  const updateColumns = activeMappings
    .filter(m => !conflictKeys.includes(m.pgColumn))
    .map(m => m.pgColumn);
  
  const statements: string[] = [];
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valueRows: string[] = [];
    
    for (const row of batch) {
      const values = activeMappings.map((mapping, idx) => {
        const value = row[mapping.excelColumn ? 
          parseInt(mapping.excelColumn.replace(/\D/g, ''), 10) || idx : idx];
        return formatValue(value, mapping.dataType);
      });
      valueRows.push(`(${values.join(', ')})`);
    }
    
    let stmt = `INSERT INTO ${quotedTable} (${colList})
VALUES
${valueRows.join(',\n')}
ON CONFLICT (${conflictList})`;
    
    if (onConflictAction === 'DO UPDATE' && updateColumns.length > 0) {
      const updateClauses = updateColumns.map(col => 
        `${quoteIdentifier(col)} = EXCLUDED.${quoteIdentifier(col)}`
      ).join(', ');
      stmt += `\nDO UPDATE SET ${updateClauses};`;
    } else {
      stmt += '\nDO NOTHING;';
    }
    
    statements.push(stmt);
  }
  
  return statements;
}

/**
 * Main SQL generation entry point
 */
export function generateSQL(
  tableName: string,
  mappings: ColumnMapping[],
  rows: unknown[][],
  config: SqlConfig,
  options: GenerateOptions = {}
): SqlGenerationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: ValidationError[] = [];
  const statements: string[] = [];
  
  // Header comment
  if (opts.includeComments) {
    statements.push(`-- Generated by excel-to-sql-suite`);
    statements.push(`-- Table: ${tableName}`);
    statements.push(`-- Rows: ${rows.length}`);
    statements.push(`-- Mode: ${config.mode}`);
    statements.push(`-- Generated: ${new Date().toISOString()}`);
    statements.push('');
  }
  
  // Transaction wrapper
  if (config.wrapInTransaction) {
    statements.push('BEGIN;');
    statements.push('');
  }
  
  // CREATE TABLE
  if (opts.createTable) {
    statements.push(generateCreateTable(tableName, mappings, opts));
    statements.push('');
  }
  
  // Data statements
  let dataStatements: string[] = [];
  
  switch (config.mode) {
    case 'INSERT':
      dataStatements = generateInserts(tableName, mappings, rows, config.batchSize);
      break;
      
    case 'UPSERT':
      dataStatements = generateUpserts(
        tableName,
        mappings,
        rows,
        config.conflictKeys,
        config.onConflictAction,
        config.batchSize
      );
      break;
      
    case 'UPDATE':
      errors.push({
        row: 0,
        column: '',
        value: null,
        message: 'UPDATE mode not yet implemented - use UPSERT with conflict keys',
        severity: 'error',
      });
      break;
  }
  
  statements.push(...dataStatements);
  
  // Transaction commit
  if (config.wrapInTransaction) {
    statements.push('');
    statements.push('COMMIT;');
  }
  
  return {
    sql: statements.join('\n'),
    statements,
    rowCount: rows.length,
    errors,
  };
}
