import type { ExcelData, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';
import { DatabaseConnectionManager, type DbConnectionConfig, type QueryResult } from './database-connection-mock';
import { generateSQL } from './sql-generator';
import { TransactionManager } from './transaction-manager';
import type { DatabaseType } from './adapters';

/**
 * Direct Executor
 * Executes SQL directly against database with real-time progress tracking and error handling
 */

export interface ExecutionProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  rowsProcessed: number;
  rowsFailed: number;
  rowsTotal: number;
  estimatedTimeRemaining: number; // milliseconds
  currentError?: string;
}

export interface BatchExecutionResult {
  batchNumber: number;
  rowsProcessed: number;
  rowsFailed: number;
  duration: number;
  errors: ValidationError[];
  sql: string;
  success: boolean;
}

export interface DirectExecutionResult {
  status: 'success' | 'partial' | 'failed';
  totalRows: number;
  succeededRows: number;
  failedRows: number;
  totalDuration: number;
  batchResults: BatchExecutionResult[];
  errors: ValidationError[];
  report: string;
}

export interface ExecutionOptions {
  batchSize: number;
  useTransactions: boolean;
  rollbackOnError: boolean;
  timeout: number;
  retryFailedRows: boolean;
  maxRetries: number;
}

class DirectExecutor {
  private dbManager: DatabaseConnectionManager;
  private txManager: TransactionManager;
  private database: DatabaseType;

  constructor(
    database: DatabaseType,
    connectionConfig: DbConnectionConfig
  ) {
    this.database = database;
    this.dbManager = new DatabaseConnectionManager(connectionConfig);
    this.txManager = new TransactionManager(database);
  }

  /**
   * Execute Excel data import directly to database
   */
  async execute(
    data: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig,
    options: ExecutionOptions,
    onProgress?: (progress: ExecutionProgress) => void
  ): Promise<DirectExecutionResult> {
    const startTime = Date.now();
    const batchResults: BatchExecutionResult[] = [];
    let totalSucceeded = 0;
    let totalFailed = 0;
    const allErrors: ValidationError[] = [];

    try {
      // Connect to database
      await this.dbManager.connect();

      // Calculate batches
      const batchSize = options.batchSize || 1000;
      const totalRows = data.rows.length;
      const totalBatches = Math.ceil(totalRows / batchSize);

      // Process each batch
      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStartIdx = batchNum * batchSize;
        const batchEndIdx = Math.min(batchStartIdx + batchSize, totalRows);
        const batchRows = data.rows.slice(batchStartIdx, batchEndIdx);

        // Report progress
        if (onProgress) {
          const processed = totalSucceeded + totalFailed;
          onProgress({
            status: 'processing',
            percentage: Math.round((processed / totalRows) * 100),
            currentBatch: batchNum + 1,
            totalBatches,
            rowsProcessed: totalSucceeded,
            rowsFailed: totalFailed,
            rowsTotal: totalRows,
            estimatedTimeRemaining: this.estimateRemainingTime(
              startTime,
              totalSucceeded,
              totalFailed,
              totalRows
            ),
          });
        }

        // Execute batch
        const batchResult = await this.executeBatch(
          batchRows,
          mappings,
          config,
          options,
          batchNum + 1
        );

        batchResults.push(batchResult);
        totalSucceeded += batchResult.rowsProcessed;
        totalFailed += batchResult.rowsFailed;
        allErrors.push(...batchResult.errors);

        // Check for timeout
        if (Date.now() - startTime > options.timeout) {
          throw new Error(`Execution timeout after ${options.timeout}ms`);
        }
      }

      // Final progress update
      if (onProgress) {
        onProgress({
          status: 'completed',
          percentage: 100,
          currentBatch: totalBatches,
          totalBatches,
          rowsProcessed: totalSucceeded,
          rowsFailed: totalFailed,
          rowsTotal: totalRows,
          estimatedTimeRemaining: 0,
        });
      }

      const duration = Date.now() - startTime;

      return {
        status: totalFailed === 0 ? 'success' : totalSucceeded > 0 ? 'partial' : 'failed',
        totalRows,
        succeededRows: totalSucceeded,
        failedRows: totalFailed,
        totalDuration: duration,
        batchResults,
        errors: allErrors,
        report: this.generateReport(
          totalRows,
          totalSucceeded,
          totalFailed,
          duration,
          batchResults
        ),
      };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);

      if (onProgress) {
        onProgress({
          status: 'failed',
          percentage: 0,
          currentBatch: 0,
          totalBatches: 0,
          rowsProcessed: totalSucceeded,
          rowsFailed: totalFailed,
          rowsTotal: data.rows.length,
          estimatedTimeRemaining: 0,
          currentError: err,
        });
      }

      return {
        status: 'failed',
        totalRows: data.rows.length,
        succeededRows: totalSucceeded,
        failedRows: totalFailed,
        totalDuration: Date.now() - startTime,
        batchResults,
        errors: [
          ...allErrors,
          {
            row: 0,
            column: '',
            message: `Execution failed: ${err}`,
            severity: 'error',
          },
        ],
        report: `Execution failed: ${err}`,
      };
    } finally {
      await this.dbManager.disconnect();
    }
  }

  /**
   * Execute a single batch
   */
  private async executeBatch(
    rows: any[][],
    mappings: ColumnMapping[],
    config: SqlConfig,
    options: ExecutionOptions,
    batchNumber: number
  ): Promise<BatchExecutionResult> {
    const startTime = Date.now();
    let succeeded = 0;
    let failed = 0;
    const errors: ValidationError[] = [];

    try {
      // Generate SQL for batch
      const batchData: ExcelData = {
        headers: [],
        rows,
        totalRows: rows.length,
        fileName: `batch_${batchNumber}.xlsx`,
        sheetName: 'Batch',
        sheets: ['Batch'],
      };

      const { sql, errors: sqlErrors } = generateSQL(batchData, mappings, config);

      if (sqlErrors.length > 0) {
        errors.push(...sqlErrors);
        failed = rows.length;
      } else {
        // Execute with transaction if enabled
        if (options.useTransactions) {
          try {
            this.txManager.beginTransaction();

            // Execute SQL
            const result = await this.dbManager.query(sql);
            succeeded = result.rowCount || rows.length;

            this.txManager.commitTransaction();
          } catch (error) {
            this.txManager.rollbackTransaction();
            failed = rows.length;
            const err = error instanceof Error ? error.message : String(error);
            errors.push({
              row: 0,
              column: '',
              message: `Batch execution failed: ${err}`,
              severity: 'error',
            });
          }
        } else {
          // Execute without transaction
          const result = await this.dbManager.query(sql);
          succeeded = result.rowCount || rows.length;
        }
      }

      return {
        batchNumber,
        rowsProcessed: succeeded,
        rowsFailed: failed,
        duration: Date.now() - startTime,
        errors,
        sql,
        success: failed === 0,
      };
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      failed = rows.length;
      errors.push({
        row: 0,
        column: '',
        message: `Batch ${batchNumber} failed: ${err}`,
        severity: 'error',
      });

      return {
        batchNumber,
        rowsProcessed: succeeded,
        rowsFailed: failed,
        duration: Date.now() - startTime,
        errors,
        sql: '',
        success: false,
      };
    }
  }

  /**
   * Estimate time remaining
   */
  private estimateRemainingTime(
    startTime: number,
    succeeded: number,
    failed: number,
    total: number
  ): number {
    const processed = succeeded + failed;
    if (processed === 0) return 0;

    const elapsed = Date.now() - startTime;
    const avgTimePerRow = elapsed / processed;
    const remaining = total - processed;

    return Math.round(avgTimePerRow * remaining);
  }

  /**
   * Generate execution report
   */
  private generateReport(
    total: number,
    succeeded: number,
    failed: number,
    duration: number,
    batchResults: BatchExecutionResult[]
  ): string {
    const successRate = total > 0 ? ((succeeded / total) * 100).toFixed(1) : '0';
    const durationSecs = (duration / 1000).toFixed(2);

    const successfulBatches = batchResults.filter(b => b.success).length;
    const failedBatches = batchResults.filter(b => !b.success).length;

    const lines: string[] = [
      `Direct Execution Report`,
      `${'='.repeat(50)}`,
      ``,
      `Status: ${failed === 0 ? 'SUCCESS ✓' : succeeded > 0 ? 'PARTIAL ⚠' : 'FAILED ✗'}`,
      ``,
      `Rows:`,
      `  Total:     ${total}`,
      `  Succeeded: ${succeeded}`,
      `  Failed:    ${failed}`,
      `  Success Rate: ${successRate}%`,
      ``,
      `Batches:`,
      `  Total:     ${batchResults.length}`,
      `  Succeeded: ${successfulBatches}`,
      `  Failed:    ${failedBatches}`,
      ``,
      `Performance:`,
      `  Duration: ${durationSecs}s`,
      `  Throughput: ${(succeeded / (duration / 1000)).toFixed(2)} rows/sec`,
      ``,
    ];

    if (failed > 0) {
      const failedRowsPerBatch = batchResults
        .filter(b => b.rowsFailed > 0)
        .map(b => `Batch ${b.batchNumber}: ${b.rowsFailed} rows`)
        .join(', ');

      lines.push(`Failed Rows:`);
      lines.push(`  ${failedRowsPerBatch}`);
      lines.push(``);
    }

    lines.push(`Recommendations:`);
    if (failed === total) {
      lines.push(`  - All rows failed. Review error log for details.`);
      lines.push(`  - Check database connectivity and permissions.`);
      lines.push(`  - Verify SQL syntax and constraints.`);
    } else if (failed > 0) {
      lines.push(`  - ${failed} rows failed. Review specific errors.`);
      lines.push(`  - Consider retrying failed rows only.`);
      lines.push(`  - Check constraint violations.`);
    } else {
      lines.push(`  - All rows processed successfully! ✓`);
    }

    return lines.join('\n');
  }

  /**
   * Get current connection state
   */
  getState() {
    return this.dbManager.getState();
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<boolean> {
    return this.dbManager.healthCheck();
  }
}

// Export for use
export function createDirectExecutor(
  database: DatabaseType,
  connectionConfig: DbConnectionConfig
): DirectExecutor {
  return new DirectExecutor(database, connectionConfig);
}

export { DirectExecutor };
