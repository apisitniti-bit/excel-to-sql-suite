import type { ExcelData, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';
import { generateSQL } from './sql-generator';

/**
 * Batch Processing Engine
 * Handles large data conversions with batching, parallel execution, error isolation, and transaction management
 */

export interface BatchResult {
  batchId: number;
  rowsProcessed: number;
  rowsSucceeded: number;
  rowsFailed: number;
  errors: ValidationError[];
  duration: number; // milliseconds
  status: 'success' | 'partial' | 'failed';
}

export interface ExecutionProgress {
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  percentComplete: number;
  currentBatchId: number;
  totalBatches: number;
  estimatedTimeRemaining: number; // seconds
  averageRowsPerSecond: number;
}

export interface SavepointConfig {
  name: string;
  batchId: number;
  timestamp: number;
}

export class BatchProcessor {
  private batchSize: number;
  private maxConcurrency: number;
  private savepoints: SavepointConfig[] = [];

  constructor(batchSize: number = 1000, maxConcurrency: number = 4) {
    this.batchSize = batchSize;
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * Split data into batches
   */
  splitIntoBatches(rows: any[][]): any[][][] {
    const batches: any[][][] = [];

    for (let i = 0; i < rows.length; i += this.batchSize) {
      batches.push(rows.slice(i, i + this.batchSize));
    }

    return batches;
  }

  /**
   * Create a savepoint name for a batch
   */
  private getSavepointName(batchId: number): string {
    return `BATCH_${batchId}_SP`;
  }

  /**
   * Generate SQL for a batch
   */
  private generateBatchSQL(
    batchData: any[][],
    headers: string[],
    mappings: ColumnMapping[],
    config: SqlConfig,
    batchId: number
  ): { sql: string[]; errors: ValidationError[] } {
    const statements: string[] = [];
    const errors: ValidationError[] = [];

    // Add savepoint creation
    statements.push(`SAVEPOINT ${this.getSavepointName(batchId)};`);

    // Generate SQL for each row
    const excelData: ExcelData = {
      headers,
      rows: batchData,
      totalRows: batchData.length,
      fileName: 'batch-data',
      sheetName: 'batch',
      sheets: [],
    };

    const result = generateSQL(excelData, mappings, config);
    statements.push(...result.sql.split('\n').filter(line => line.trim() && !line.startsWith('BEGIN') && !line.startsWith('COMMIT')));
    errors.push(...result.errors);

    // Add savepoint release on success
    statements.push(`RELEASE SAVEPOINT ${this.getSavepointName(batchId)};`);

    return { sql: statements, errors };
  }

  /**
   * Process a single batch with error isolation
   */
  async processBatch(
    batchId: number,
    batchData: any[][],
    headers: string[],
    mappings: ColumnMapping[],
    config: SqlConfig,
    onProgress?: (progress: ExecutionProgress) => void
  ): Promise<BatchResult> {
    const startTime = Date.now();
    let rowsSucceeded = 0;
    let rowsFailed = 0;
    const errors: ValidationError[] = [];

    try {
      // Generate SQL for batch
      const { sql: statements, errors: sqlErrors } = this.generateBatchSQL(
        batchData,
        headers,
        mappings,
        config,
        batchId
      );

      if (sqlErrors.length > 0) {
        rowsFailed = batchData.length;
        errors.push(...sqlErrors);

        return {
          batchId,
          rowsProcessed: batchData.length,
          rowsSucceeded: 0,
          rowsFailed,
          errors,
          duration: Date.now() - startTime,
          status: 'failed',
        };
      }

      // Simulate successful processing
      rowsSucceeded = batchData.length;

      // In production, this would execute statements against actual database
      // For now, we validate the SQL is well-formed
      for (const stmt of statements) {
        if (!stmt.trim()) continue;
        // Basic SQL validation
        const validKeywords = ['INSERT', 'UPDATE', 'SAVEPOINT', 'RELEASE', 'DELETE', 'SELECT'];
        const startsWithValid = validKeywords.some(kw => stmt.trim().toUpperCase().startsWith(kw));

        if (!startsWithValid && !stmt.includes(';')) {
          rowsFailed++;
          rowsSucceeded--;
          errors.push({
            row: batchId * this.batchSize,
            column: '',
            message: `Invalid SQL statement: ${stmt.slice(0, 50)}...`,
            severity: 'error',
          });
        }
      }

      const status = rowsFailed === 0 ? 'success' : rowsSucceeded > 0 ? 'partial' : 'failed';

      return {
        batchId,
        rowsProcessed: batchData.length,
        rowsSucceeded,
        rowsFailed,
        errors,
        duration: Date.now() - startTime,
        status,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({
        row: batchId * this.batchSize,
        column: '',
        message: `Batch processing error: ${errorMsg}`,
        severity: 'error',
      });

      return {
        batchId,
        rowsProcessed: batchData.length,
        rowsSucceeded: 0,
        rowsFailed: batchData.length,
        errors,
        duration: Date.now() - startTime,
        status: 'failed',
      };
    }
  }

  /**
   * Execute batches with concurrency control
   */
  async executeParallel(
    data: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig,
    onProgress?: (progress: ExecutionProgress) => void
  ): Promise<BatchResult[]> {
    const batches = this.splitIntoBatches(data.rows);
    const results: BatchResult[] = [];
    const startTime = Date.now();
    let processedRows = 0;
    let successRows = 0;
    let failedRows = 0;

    // Process batches with concurrency limit
    for (let i = 0; i < batches.length; i += this.maxConcurrency) {
      const batchPromises = batches
        .slice(i, i + this.maxConcurrency)
        .map((batch, idx) =>
          this.processBatch(
            i + idx,
            batch,
            data.headers,
            mappings,
            config,
            onProgress
          )
        );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Update aggregated stats
      for (const result of batchResults) {
        processedRows += result.rowsProcessed;
        successRows += result.rowsSucceeded;
        failedRows += result.rowsFailed;
      }

      // Report progress
      if (onProgress) {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const rowsPerSecond = processedRows / Math.max(elapsedSeconds, 0.1);
        const remainingRows = data.totalRows - processedRows;
        const estimatedRemaining = remainingRows / Math.max(rowsPerSecond, 1);

        onProgress({
          totalRows: data.totalRows,
          processedRows,
          successRows,
          failedRows,
          percentComplete: Math.round((processedRows / data.totalRows) * 100),
          currentBatchId: i,
          totalBatches: batches.length,
          estimatedTimeRemaining: Math.ceil(estimatedRemaining),
          averageRowsPerSecond: Math.round(rowsPerSecond),
        });
      }
    }

    return results;
  }

  /**
   * Aggregate batch results into final execution summary
   */
  aggregateResults(batchResults: BatchResult[]): {
    totalProcessed: number;
    totalSucceeded: number;
    totalFailed: number;
    allErrors: ValidationError[];
    overallStatus: 'success' | 'partial' | 'failed';
    duration: number;
    errorsByBatch: Map<number, ValidationError[]>;
  } {
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    const allErrors: ValidationError[] = [];
    const errorsByBatch = new Map<number, ValidationError[]>();
    let totalDuration = 0;

    for (const result of batchResults) {
      totalProcessed += result.rowsProcessed;
      totalSucceeded += result.rowsSucceeded;
      totalFailed += result.rowsFailed;
      totalDuration = Math.max(totalDuration, result.duration);

      if (result.errors.length > 0) {
        allErrors.push(...result.errors);
        errorsByBatch.set(result.batchId, result.errors);
      }
    }

    const overallStatus =
      totalFailed === 0 ? 'success' : totalSucceeded > 0 ? 'partial' : 'failed';

    return {
      totalProcessed,
      totalSucceeded,
      totalFailed,
      allErrors,
      overallStatus,
      duration: totalDuration,
      errorsByBatch,
    };
  }

  /**
   * Generate execution report with recommendations
   */
  generateReport(
    aggregated: ReturnType<BatchProcessor['aggregateResults']>
  ): {
    summary: string;
    recommendations: string[];
    rollbackSuggested: boolean;
  } {
    const successRate = aggregated.totalProcessed > 0
      ? (aggregated.totalSucceeded / aggregated.totalProcessed) * 100
      : 0;

    const recommendations: string[] = [];
    let rollbackSuggested = false;

    if (aggregated.overallStatus === 'failed') {
      recommendations.push('Execution failed. Review errors and fix data before retrying.');
      rollbackSuggested = true;
    } else if (aggregated.overallStatus === 'partial') {
      recommendations.push(`Only ${successRate.toFixed(1)}% of rows processed successfully.`);
      recommendations.push('Review failed rows and decide whether to:');
      recommendations.push('  1. Fix failed data and retry');
      recommendations.push('  2. Accept partial success and commit');
      recommendations.push('  3. Rollback entire transaction');
      rollbackSuggested = successRate < 95;
    }

    if (aggregated.allErrors.length > 0) {
      const errorTypes = new Map<string, number>();
      for (const error of aggregated.allErrors) {
        const key = error.message.split(':')[0];
        errorTypes.set(key, (errorTypes.get(key) || 0) + 1);
      }

      recommendations.push('\nMost common errors:');
      Array.from(errorTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .forEach(([type, count]) => {
          recommendations.push(`  - ${type}: ${count} occurrence(s)`);
        });
    }

    if (aggregated.duration > 60000) {
      recommendations.push(
        `Execution took ${(aggregated.duration / 1000).toFixed(1)}s. Consider increasing batch size for future imports.`
      );
    }

    const summary = `Processed: ${aggregated.totalProcessed} rows | Succeeded: ${aggregated.totalSucceeded} | Failed: ${aggregated.totalFailed} | Success Rate: ${successRate.toFixed(1)}%`;

    return {
      summary,
      recommendations,
      rollbackSuggested,
    };
  }
}

// Default processor instance
export const batchProcessor = new BatchProcessor();
