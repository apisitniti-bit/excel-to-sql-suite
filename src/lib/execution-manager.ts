import type { ExcelData, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';
import type { DatabaseType } from './adapters';
import { generateSQL } from './sql-generator';
import { BatchProcessor, type BatchResult } from './batch-processor';
import { TransactionManager, TransactionExecutor } from './transaction-manager';

/**
 * Execution Manager
 * Orchestrates SQL execution across multiple modes: DRY_RUN, FILE_EXPORT, DIRECT_EXECUTION
 * Handles real-time progress, error management, and result reporting
 */

export type ExecutionMode = 'dry-run' | 'file-export' | 'direct-execution' | 'preview-diff';

export interface ExecutionOptions {
  mode: ExecutionMode;
  rollbackOnError: boolean;
  batchSize: number;
  maxConcurrency: number;
  timeout: number; // milliseconds
  dryRun: boolean;
}

export interface ExecutionResult {
  mode: ExecutionMode;
  status: 'success' | 'partial' | 'failed';
  totalRows: number;
  succeededRows: number;
  failedRows: number;
  duration: number; // milliseconds
  sql: string;
  errors: ValidationError[];
  warnings: ValidationError[];
  report: string;
  exportPath?: string;
  beforeData?: any[];
  afterData?: any[];
}

export interface DryRunResult {
  isValid: boolean;
  statementCount: number;
  estimatedRowsAffected: number;
  estimatedDuration: number; // milliseconds
  warnings: string[];
  errors: string[];
  firstNStatements: string[]; // Show first 5 statements
}

export interface PreviewDiffRow {
  action: 'INSERT' | 'UPDATE' | 'SKIP';
  before?: Record<string, any>;
  after?: Record<string, any>;
  conflicts: string[];
}

class ExecutionManager {
  private batchProcessor: BatchProcessor;
  private transactionManager: TransactionManager;

  constructor(database: DatabaseType) {
    this.batchProcessor = new BatchProcessor();
    this.transactionManager = new TransactionManager(database);
  }

  /**
   * Execute conversion in DRY_RUN mode
   * Parse and validate SQL without executing against database
   */
  async executeDryRun(
    data: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig
  ): Promise<DryRunResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Generate SQL
      const { sql, errors: sqlErrors } = generateSQL(data, mappings, config);

      if (sqlErrors.length > 0) {
        errors.push(
          ...sqlErrors.map(
            e => `Row ${e.row}, Column ${e.column}: ${e.message}`
          )
        );
      }

      // Parse SQL statements
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      // Basic validation
      if (statements.length === 0) {
        errors.push('No valid SQL statements generated');
      }

      // Check for suspicious patterns
      for (const stmt of statements) {
        if (stmt.toUpperCase().includes('DROP')) {
          warnings.push('WARNING: DROP statement detected');
        }
        if (stmt.toUpperCase().includes('DELETE')) {
          warnings.push('WARNING: DELETE statement detected');
        }
      }

      // Estimate impact
      const estimatedRowsAffected = statements.filter(s =>
        /^(INSERT|UPDATE|DELETE)/i.test(s)
      ).length;

      const duration = Date.now() - startTime;

      return {
        isValid: errors.length === 0,
        statementCount: statements.length,
        estimatedRowsAffected,
        estimatedDuration: duration,
        warnings,
        errors,
        firstNStatements: statements.slice(0, 5),
      };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      errors.push(`Execution error: ${err}`);

      return {
        isValid: false,
        statementCount: 0,
        estimatedRowsAffected: 0,
        estimatedDuration: Date.now() - startTime,
        warnings,
        errors,
        firstNStatements: [],
      };
    }
  }

  /**
   * Execute in FILE_EXPORT mode
   * Generate SQL and return for download/export
   */
  async executeFileExport(
    data: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const { sql, errors: sqlErrors } = generateSQL(data, mappings, config);

      const result: ExecutionResult = {
        mode: 'file-export',
        status: sqlErrors.length === 0 ? 'success' : 'partial',
        totalRows: data.totalRows,
        succeededRows: data.totalRows - sqlErrors.length,
        failedRows: sqlErrors.length,
        duration: Date.now() - startTime,
        sql,
        errors: sqlErrors,
        warnings: [],
        report: this.generateReport(
          'file-export',
          data.totalRows,
          data.totalRows - sqlErrors.length,
          sqlErrors.length,
          Date.now() - startTime
        ),
        exportPath: undefined, // Client will set this
      };

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      return {
        mode: 'file-export',
        status: 'failed',
        totalRows: data.totalRows,
        succeededRows: 0,
        failedRows: data.totalRows,
        duration: Date.now() - startTime,
        sql: '',
        errors: [
          {
            row: 0,
            column: '',
            message: err.message,
            severity: 'error',
          },
        ],
        warnings: [],
        report: `Execution failed: ${err.message}`,
      };
    }
  }

  /**
   * Execute in DIRECT_EXECUTION mode
   * Actually execute against database (would require DB connection in real implementation)
   */
  async executeDirectExecution(
    data: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig,
    onProgress?: (progress: any) => void
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Begin transaction
      const beginSQL = this.transactionManager.beginTransaction();

      let totalSucceeded = 0;
      let totalFailed = 0;
      const allErrors: ValidationError[] = [];

      // Process batches
      const batchResults = await this.batchProcessor.executeParallel(
        data,
        mappings,
        config,
        onProgress
      );

      // Aggregate results
      for (const result of batchResults) {
        totalSucceeded += result.rowsSucceeded;
        totalFailed += result.rowsFailed;
        allErrors.push(...result.errors);
      }

      // Commit or rollback based on errors
      let commitSQL = '';
      if (config.options.wrapInTransaction) {
        if (totalFailed === 0) {
          commitSQL = this.transactionManager.commitTransaction();
        } else if (config.options.wrapInTransaction && config.options.onConflictAction === 'DO NOTHING') {
          commitSQL = this.transactionManager.rollbackTransaction();
        }
      }

      const { sql } = generateSQL(data, mappings, config);

      return {
        mode: 'direct-execution',
        status: totalFailed === 0 ? 'success' : totalSucceeded > 0 ? 'partial' : 'failed',
        totalRows: data.totalRows,
        succeededRows: totalSucceeded,
        failedRows: totalFailed,
        duration: Date.now() - startTime,
        sql: `${beginSQL}\n${sql}\n${commitSQL}`,
        errors: allErrors,
        warnings: [],
        report: this.generateReport(
          'direct-execution',
          data.totalRows,
          totalSucceeded,
          totalFailed,
          Date.now() - startTime
        ),
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      this.transactionManager.rollbackTransaction();

      return {
        mode: 'direct-execution',
        status: 'failed',
        totalRows: data.totalRows,
        succeededRows: 0,
        failedRows: data.totalRows,
        duration: Date.now() - startTime,
        sql: '',
        errors: [
          {
            row: 0,
            column: '',
            message: err.message,
            severity: 'error',
          },
        ],
        warnings: [],
        report: `Execution failed: ${err.message}`,
      };
    }
  }

  /**
   * Execute in PREVIEW_DIFF mode
   * Show what would change (before/after preview)
   */
  async executePreviewDiff(
    data: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const diffs: PreviewDiffRow[] = [];

    try {
      // Group rows by conflict key for preview
      const conflictKey = config.conflictKeys[0] || config.primaryKey[0];
      if (!conflictKey) {
        throw new Error('No primary key for diff preview');
      }

      // Map data for preview (simulate before/after)
      const conflictMapping = mappings.find(m => m.pgColumn === conflictKey);
      if (!conflictMapping) {
        throw new Error(`Conflict key mapping not found: ${conflictKey}`);
      }

      const conflictColIndex = data.headers.indexOf(conflictMapping.excelColumn);

      for (let i = 0; i < data.rows.length; i++) {
        const row = data.rows[i];
        const conflictValue = row[conflictColIndex];

        const afterRecord: Record<string, any> = {};
        for (const mapping of mappings) {
          const colIndex = data.headers.indexOf(mapping.excelColumn);
          afterRecord[mapping.pgColumn] = row[colIndex];
        }

        diffs.push({
          action: 'INSERT',
          before: undefined,
          after: afterRecord,
          conflicts: [],
        });
      }

      const { sql } = generateSQL(data, mappings, config);

      return {
        mode: 'preview-diff',
        status: 'success',
        totalRows: data.totalRows,
        succeededRows: data.totalRows,
        failedRows: 0,
        duration: Date.now() - startTime,
        sql,
        errors: [],
        warnings: [],
        report: `Preview: ${diffs.length} rows will be inserted`,
        afterData: diffs,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      return {
        mode: 'preview-diff',
        status: 'failed',
        totalRows: data.totalRows,
        succeededRows: 0,
        failedRows: data.totalRows,
        duration: Date.now() - startTime,
        sql: '',
        errors: [
          {
            row: 0,
            column: '',
            message: err.message,
            severity: 'error',
          },
        ],
        warnings: [],
        report: `Preview failed: ${err.message}`,
      };
    }
  }

  /**
   * Main execution entrypoint
   */
  async execute(
    mode: ExecutionMode,
    data: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig,
    options?: Partial<ExecutionOptions>,
    onProgress?: (progress: any) => void
  ): Promise<ExecutionResult> {
    const opts: ExecutionOptions = {
      mode,
      rollbackOnError: true,
      batchSize: 1000,
      maxConcurrency: 4,
      timeout: 30000,
      dryRun: mode === 'dry-run',
      ...options,
    };

    switch (mode) {
      case 'dry-run': {
        const dryRunResult = await this.executeDryRun(data, mappings, config);
        return {
          mode: 'dry-run',
          status: dryRunResult.isValid ? 'success' : 'failed',
          totalRows: data.totalRows,
          succeededRows: dryRunResult.estimatedRowsAffected,
          failedRows: dryRunResult.errors.length,
          duration: dryRunResult.estimatedDuration,
          sql: dryRunResult.firstNStatements.join(';\n'),
          errors: dryRunResult.errors.map(e => ({
            row: 0,
            column: '',
            message: e,
            severity: 'error' as const,
          })),
          warnings: dryRunResult.warnings.map(w => ({
            row: 0,
            column: '',
            message: w,
            severity: 'warning' as const,
          })),
          report: `${dryRunResult.isValid ? '✓ Valid' : '✗ Invalid'} | ${dryRunResult.statementCount} statements | ${dryRunResult.estimatedRowsAffected} rows affected`,
        };
      }

      case 'file-export':
        return this.executeFileExport(data, mappings, config);

      case 'direct-execution':
        return this.executeDirectExecution(data, mappings, config, onProgress);

      case 'preview-diff':
        return this.executePreviewDiff(data, mappings, config);

      default:
        throw new Error(`Unknown execution mode: ${mode}`);
    }
  }

  /**
   * Generate human-readable execution report
   */
  private generateReport(
    mode: ExecutionMode,
    totalRows: number,
    succeededRows: number,
    failedRows: number,
    duration: number
  ): string {
    const successRate = totalRows > 0 ? ((succeededRows / totalRows) * 100).toFixed(1) : '0';
    const durationSecs = (duration / 1000).toFixed(2);

    const lines: string[] = [
      `Execution Report - ${mode.toUpperCase()}`,
      `${'='.repeat(50)}`,
      ``,
      `Status: ${failedRows === 0 ? 'SUCCESS ✓' : succeededRows > 0 ? 'PARTIAL ⚠' : 'FAILED ✗'}`,
      `Total Rows: ${totalRows}`,
      `Succeeded: ${succeededRows}`,
      `Failed: ${failedRows}`,
      `Success Rate: ${successRate}%`,
      `Duration: ${durationSecs}s`,
      ``,
    ];

    if (failedRows > 0) {
      lines.push(`Recommendations:`);
      if (failedRows === totalRows) {
        lines.push(`  - All rows failed. Review error log for details.`);
        lines.push(`  - Check data types and constraints.`);
      } else {
        lines.push(`  - ${failedRows} rows failed. Review error report.`);
        lines.push(`  - Consider rollback and fix data issues.`);
      }
    } else {
      lines.push(`All rows processed successfully! ✓`);
    }

    return lines.join('\n');
  }

  /**
   * Cancel execution (placeholder for async cancellation)
   */
  cancel(): void {
    this.transactionManager.rollbackTransaction();
  }

  /**
   * Get current state
   */
  getState() {
    return this.transactionManager.getState();
  }
}

// Export classes and functions
export { ExecutionManager };
export const createExecutionManager = (database: DatabaseType) => new ExecutionManager(database);

/**
 * Convenience function for direct execution
 */
export async function executeConversion(
  mode: ExecutionMode,
  data: ExcelData,
  mappings: ColumnMapping[],
  config: SqlConfig,
  database: DatabaseType,
  onProgress?: (progress: any) => void
): Promise<ExecutionResult> {
  const manager = new ExecutionManager(database);
  return manager.execute(mode, data, mappings, config, {}, onProgress);
}
