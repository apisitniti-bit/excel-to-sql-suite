import type { ExcelData, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';
import type { DatabaseType } from './adapters';
import { getAdapter } from './adapters';

/**
 * Conflict Resolution Engine
 * Handles duplicate key conflicts with three strategies: SKIP, UPDATE, UPSERT
 * Database-specific SQL generation for each conflict mode
 */

export type ConflictMode = 'skip' | 'update' | 'upsert';

export interface ConflictConfig {
  mode: ConflictMode;
  conflictKeys: string[]; // Columns to consider for conflict detection
  updateColumns?: string[]; // For UPDATE/UPSERT: which columns to update
  ignoreColumns?: string[]; // Columns to never update
}

export interface ConflictAnalysis {
  mode: ConflictMode;
  totalRows: number;
  expectedConflicts: number;
  conflictPercentage: number;
  estimatedRowsToInsert: number;
  estimatedRowsToSkip: number;
  estimatedRowsToUpdate: number;
  sqlStatements: {
    skip: string[];
    update: string[];
    upsert: string[];
  };
}

class ConflictResolutionEngine {
  /**
   * Detect potential conflicts in data
   */
  analyzeConflicts(
    data: ExcelData,
    mappings: ColumnMapping[],
    conflictKeys: string[]
  ): ConflictAnalysis {
    const conflictMappings = mappings.filter(m =>
      conflictKeys.includes(m.pgColumn) && m.pgColumn
    );

    if (conflictMappings.length === 0) {
      return {
        mode: 'skip',
        totalRows: data.totalRows,
        expectedConflicts: 0,
        conflictPercentage: 0,
        estimatedRowsToInsert: data.totalRows,
        estimatedRowsToSkip: 0,
        estimatedRowsToUpdate: 0,
        sqlStatements: { skip: [], update: [], upsert: [] },
      };
    }

    // Count duplicate combinations
    const seenCombinations = new Map<string, number>();
    const duplicateRows = new Set<number>();

    for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
      const row = data.rows[rowIndex];
      const keyValues = conflictMappings
        .map(m => {
          const colIndex = data.headers.indexOf(m.excelColumn);
          return String(row[colIndex] || '').trim();
        })
        .join('|');

      if (seenCombinations.has(keyValues)) {
        duplicateRows.add(rowIndex);
        seenCombinations.set(keyValues, (seenCombinations.get(keyValues) || 1) + 1);
      } else {
        seenCombinations.set(keyValues, 1);
      }
    }

    const expectedConflicts = Array.from(seenCombinations.values()).filter(c => c > 1).length;
    const conflictPercentage = (expectedConflicts / data.totalRows) * 100;

    return {
      mode: 'upsert',
      totalRows: data.totalRows,
      expectedConflicts,
      conflictPercentage,
      estimatedRowsToInsert: data.totalRows - duplicateRows.size,
      estimatedRowsToSkip: duplicateRows.size,
      estimatedRowsToUpdate: duplicateRows.size,
      sqlStatements: { skip: [], update: [], upsert: [] },
    };
  }

  /**
   * Generate SKIP mode SQL (keep existing, ignore conflicts)
   */
  buildSkipModeSQL(
    table: string,
    columns: string[],
    values: string[],
    database: DatabaseType
  ): string {
    const adapter = getAdapter(database);
    const columnList = columns.join(', ');
    const valueList = values.join(', ');

    switch (database) {
      case 'postgresql':
        return `INSERT INTO ${table} (${columnList}) VALUES (${valueList}) ON CONFLICT DO NOTHING;`;

      case 'mysql':
        return `INSERT IGNORE INTO ${table} (${columnList}) VALUES (${valueList});`;

      case 'mssql':
        // SQL Server: Use MERGE with WHEN NOT MATCHED
        return `MERGE INTO ${table} AS target
USING (SELECT ${valueList} AS ${columns.join(', ')}) AS source
  ON ${columns.map((col, i) => `target.${col} = source.${col}`).join(' AND ')}
WHEN NOT MATCHED THEN
  INSERT (${columnList}) VALUES (${columns.map(c => `source.${c}`).join(', ')});`;

      default:
        return `INSERT INTO ${table} (${columnList}) VALUES (${valueList});`;
    }
  }

  /**
   * Generate UPDATE mode SQL (replace existing records)
   */
  buildUpdateModeSQL(
    table: string,
    allColumns: string[],
    values: string[],
    conflictKeys: string[],
    database: DatabaseType,
    updateColumns?: string[]
  ): string {
    const columnsToUpdate = updateColumns || allColumns.filter(c => !conflictKeys.includes(c));
    const keyConditions = conflictKeys
      .map((key, i) => `${key} = ${values[allColumns.indexOf(key)]}`)
      .join(' AND ');

    const setClause = columnsToUpdate
      .map((col, i) => {
        const valueIndex = allColumns.indexOf(col);
        return `${col} = ${values[valueIndex]}`;
      })
      .join(', ');

    switch (database) {
      case 'postgresql':
        // PostgreSQL: ON CONFLICT DO UPDATE
        const conflictKeyList = conflictKeys.join(', ');
        const updateSetClause = columnsToUpdate
          .map((col, i) => {
            const valueIndex = allColumns.indexOf(col);
            return `${col} = EXCLUDED.${col}`;
          })
          .join(', ');

        const columnList = allColumns.join(', ');
        const valueList = values.join(', ');

        return `INSERT INTO ${table} (${columnList}) VALUES (${valueList})
ON CONFLICT (${conflictKeyList}) DO UPDATE SET ${updateSetClause};`;

      case 'mysql':
        // MySQL: ON DUPLICATE KEY UPDATE
        const columnList2 = allColumns.join(', ');
        const valueList2 = values.join(', ');
        const updateClause = columnsToUpdate
          .map((col, i) => {
            const valueIndex = allColumns.indexOf(col);
            return `${col} = ${values[valueIndex]}`;
          })
          .join(', ');

        return `INSERT INTO ${table} (${columnList2}) VALUES (${valueList2})
ON DUPLICATE KEY UPDATE ${updateClause};`;

      case 'mssql':
        return `UPDATE ${table} SET ${setClause} WHERE ${keyConditions};`;

      default:
        return `UPDATE ${table} SET ${setClause} WHERE ${keyConditions};`;
    }
  }

  /**
   * Generate UPSERT mode SQL (insert if not exists, update if exists)
   */
  buildUpsertModeSQL(
    table: string,
    allColumns: string[],
    values: string[],
    conflictKeys: string[],
    database: DatabaseType,
    updateColumns?: string[]
  ): string {
    const columnsToUpdate = updateColumns || allColumns.filter(c => !conflictKeys.includes(c));

    switch (database) {
      case 'postgresql':
        // PostgreSQL: ON CONFLICT DO UPDATE (upsert)
        const conflictKeyList = conflictKeys.join(', ');
        const updateSetClause = columnsToUpdate
          .map(col => `${col} = EXCLUDED.${col}`)
          .join(', ');

        const columnList = allColumns.join(', ');
        const valueList = values.join(', ');

        return `INSERT INTO ${table} (${columnList}) VALUES (${valueList})
ON CONFLICT (${conflictKeyList}) DO UPDATE SET ${updateSetClause};`;

      case 'mysql':
        // MySQL: ON DUPLICATE KEY UPDATE
        const columnList2 = allColumns.join(', ');
        const valueList2 = values.join(', ');
        const updateClause = columnsToUpdate
          .map(col => `${col} = VALUES(${col})`)
          .join(', ');

        return `INSERT INTO ${table} (${columnList2}) VALUES (${valueList2})
ON DUPLICATE KEY UPDATE ${updateClause};`;

      case 'mssql':
        // SQL Server: MERGE statement
        return `MERGE INTO ${table} AS target
USING (SELECT ${valueList} AS ${allColumns.join(', ')}) AS source (${allColumns.join(', ')})
  ON ${conflictKeys.map(key => `target.${key} = source.${key}`).join(' AND ')}
WHEN MATCHED THEN
  UPDATE SET ${columnsToUpdate.map(col => `target.${col} = source.${col}`).join(', ')}
WHEN NOT MATCHED THEN
  INSERT (${allColumns.join(', ')}) VALUES (${allColumns.map(c => `source.${c}`).join(', ')});`;

      default:
        return `INSERT INTO ${table} (${allColumns.join(', ')}) VALUES (${values.join(', ')});`;
    }
  }

  /**
   * Get recommended mode based on conflict analysis
   */
  recommendMode(analysis: ConflictAnalysis): ConflictMode {
    // If no conflicts expected, SKIP is most efficient
    if (analysis.expectedConflicts === 0) {
      return 'skip';
    }

    // If high conflict rate, recommend UPSERT
    if (analysis.conflictPercentage > 20) {
      return 'upsert';
    }

    // For low conflict rate, SKIP is efficient
    // UPDATE could also work if selective
    return 'skip';
  }

  /**
   * Validate conflict configuration
   */
  validateConfig(config: ConflictConfig, mappings: ColumnMapping[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const availableColumns = new Set(mappings.map(m => m.pgColumn).filter(Boolean));

    // Check conflict keys exist
    for (const key of config.conflictKeys) {
      if (!availableColumns.has(key)) {
        errors.push({
          row: 0,
          column: key,
          message: `Conflict key "${key}" is not mapped in column mappings.`,
          severity: 'error',
        });
      }
    }

    // Check update columns if provided
    if (config.updateColumns) {
      for (const col of config.updateColumns) {
        if (!availableColumns.has(col)) {
          errors.push({
            row: 0,
            column: col,
            message: `Update column "${col}" is not mapped in column mappings.`,
            severity: 'error',
          });
        }
      }
    }

    // Check ignore columns if provided
    if (config.ignoreColumns) {
      for (const col of config.ignoreColumns) {
        if (!availableColumns.has(col)) {
          errors.push({
            row: 0,
            column: col,
            message: `Ignore column "${col}" is not mapped in column mappings.`,
            severity: 'warning',
          });
        }
      }
    }

    return errors;
  }

  /**
   * Generate strategy report
   */
  generateStrategyReport(analysis: ConflictAnalysis, config: ConflictConfig): string {
    const lines: string[] = [];

    lines.push(`Conflict Resolution Strategy Report`);
    lines.push(`===================================`);
    lines.push(``);
    lines.push(`Analysis:`);
    lines.push(`  Total Rows: ${analysis.totalRows}`);
    lines.push(`  Expected Conflicts: ${analysis.expectedConflicts} (${analysis.conflictPercentage.toFixed(1)}%)`);
    lines.push(``);
    lines.push(`Mode: ${config.mode.toUpperCase()}`);
    lines.push(`Conflict Keys: ${config.conflictKeys.join(', ')}`);
    lines.push(``);
    lines.push(`Estimated Impact:`);
    lines.push(`  Rows to Insert: ${analysis.estimatedRowsToInsert}`);
    lines.push(`  Rows to Skip: ${analysis.estimatedRowsToSkip}`);
    lines.push(`  Rows to Update: ${analysis.estimatedRowsToUpdate}`);
    lines.push(``);

    if (config.mode === 'skip') {
      lines.push(`Skip Mode Strategy:`);
      lines.push(`  - Existing records will be kept unchanged`);
      lines.push(`  - Conflicting new records will be ignored`);
      lines.push(`  - No data loss but may miss updates`);
    } else if (config.mode === 'update') {
      lines.push(`Update Mode Strategy:`);
      lines.push(`  - Existing records will be replaced`);
      lines.push(`  - New records will still be inserted`);
      lines.push(`  - ${config.updateColumns?.length || 'all'} columns will be updated`);
    } else if (config.mode === 'upsert') {
      lines.push(`Upsert Mode Strategy:`);
      lines.push(`  - New records will be inserted`);
      lines.push(`  - Existing records will be updated`);
      lines.push(`  - Atomic operation, no data loss`);
      lines.push(`  - Most database-friendly approach`);
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const conflictResolutionEngine = new ConflictResolutionEngine();

/**
 * Export convenience functions
 */
export function analyzeConflicts(
  data: ExcelData,
  mappings: ColumnMapping[],
  conflictKeys: string[]
): ConflictAnalysis {
  return conflictResolutionEngine.analyzeConflicts(data, mappings, conflictKeys);
}

export function getConflictRecommendation(analysis: ConflictAnalysis): ConflictMode {
  return conflictResolutionEngine.recommendMode(analysis);
}

export function buildConflictSQL(
  mode: ConflictMode,
  table: string,
  columns: string[],
  values: string[],
  conflictKeys: string[],
  database: DatabaseType,
  updateColumns?: string[]
): string {
  switch (mode) {
    case 'skip':
      return conflictResolutionEngine.buildSkipModeSQL(table, columns, values, database);
    case 'update':
      return conflictResolutionEngine.buildUpdateModeSQL(
        table,
        columns,
        values,
        conflictKeys,
        database,
        updateColumns
      );
    case 'upsert':
      return conflictResolutionEngine.buildUpsertModeSQL(
        table,
        columns,
        values,
        conflictKeys,
        database,
        updateColumns
      );
    default:
      throw new Error(`Unknown conflict mode: ${mode}`);
  }
}
