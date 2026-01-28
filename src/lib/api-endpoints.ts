import type { ExcelData, ColumnMapping, SqlConfig, ValidationError } from '@/types/converter';
import { ExecutionManager } from './execution-manager';
import { createDirectExecutor, type DirectExecutor, type ExecutionProgress } from './direct-executor';
import type { DatabaseType } from './adapters';
import type { DbConnectionConfig } from './database-connection-mock';

/**
 * API Endpoints Layer
 * RESTful endpoints for all conversion modes and database operations
 */

export interface ApiRequest<T = any> {
  id: string;
  timestamp: number;
  endpoint: string;
  method: string;
  body?: T;
}

export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta: {
    requestId: string;
    timestamp: number;
    duration: number;
  };
}

export interface ConversionRequest {
  excelData: ExcelData;
  mappings: ColumnMapping[];
  config: SqlConfig;
  mode: 'dry-run' | 'file-export' | 'preview-diff' | 'direct-execution';
  database?: DatabaseType;
  connectionConfig?: DbConnectionConfig;
  batchSize?: number;
  useTransactions?: boolean;
}

export interface ConversionResponse {
  result: any;
  validationErrors?: ValidationError[];
  executionErrors?: ValidationError[];
  report?: string;
  duration: number;
}

class ApiEndpoints {
  private executionManager: ExecutionManager;
  private directExecutor?: DirectExecutor;
  private requestQueue: Map<string, ApiRequest> = new Map();

  constructor() {
    this.executionManager = new ExecutionManager();
  }

  /**
   * POST /api/convert
   * Main conversion endpoint supporting all modes
   */
  async handleConvert(request: ApiRequest<ConversionRequest>): Promise<ApiResponse<ConversionResponse>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { excelData, mappings, config, mode, database, connectionConfig } = request.body!;

      // Validate request
      const validation = this.validateConversionRequest(request.body!);
      if (!validation.valid) {
        return this.errorResponse(400, 'VALIDATION_ERROR', validation.errors || 'Invalid request', requestId, startTime);
      }

      let result: any;

      switch (mode) {
        case 'dry-run':
          result = this.executionManager.executeDryRun(excelData, mappings, config);
          break;

        case 'file-export':
          result = this.executionManager.executeFileExport(excelData, mappings, config);
          break;

        case 'preview-diff':
          result = this.executionManager.executePreviewDiff(excelData, mappings, config);
          break;

        case 'direct-execution':
          if (!database || !connectionConfig) {
            return this.errorResponse(
              400,
              'MISSING_DB_CONFIG',
              'Database and connectionConfig required for direct-execution mode',
              requestId,
              startTime
            );
          }
          result = await this.handleDirectExecution(
            excelData,
            mappings,
            config,
            database,
            connectionConfig
          );
          break;

        default:
          return this.errorResponse(400, 'INVALID_MODE', `Unknown mode: ${mode}`, requestId, startTime);
      }

      // Get any validation errors
      const report = this.executionManager.getReport();

      return this.successResponse(
        {
          result,
          report: report.report,
          duration: Date.now() - startTime,
        },
        requestId,
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.errorResponse(500, 'EXECUTION_ERROR', err.message, requestId, startTime);
    }
  }

  /**
   * POST /api/convert/direct-execute
   * Direct database execution endpoint
   */
  async handleDirectExecute(request: ApiRequest<ConversionRequest>): Promise<ApiResponse<ConversionResponse>> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const { excelData, mappings, config, database, connectionConfig, batchSize, useTransactions } = request.body!;

      // Validate required fields
      if (!database || !connectionConfig) {
        return this.errorResponse(
          400,
          'MISSING_DB_CONFIG',
          'Database and connectionConfig are required',
          requestId,
          startTime
        );
      }

      // Initialize direct executor
      if (!this.directExecutor || this.directExecutor.getState().database !== database) {
        this.directExecutor = createDirectExecutor(database, connectionConfig);
      }

      // Execute directly
      const result = await this.directExecutor.execute(
        excelData,
        mappings,
        config,
        {
          batchSize: batchSize || 1000,
          useTransactions: useTransactions !== false,
          rollbackOnError: true,
          timeout: 300000, // 5 minutes
          retryFailedRows: false,
          maxRetries: 0,
        }
      );

      return this.successResponse(
        {
          result,
          duration: Date.now() - startTime,
        },
        requestId,
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.errorResponse(500, 'EXECUTION_ERROR', err.message, requestId, startTime);
    }
  }

  /**
   * POST /api/convert/validate
   * Validation-only endpoint
   */
  handleValidate(request: ApiRequest<ConversionRequest>): ApiResponse {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const validation = this.validateConversionRequest(request.body!);

      return this.successResponse(
        {
          valid: validation.valid,
          errors: validation.errors || [],
        },
        requestId,
        startTime
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      return this.errorResponse(500, 'VALIDATION_ERROR', err.message, requestId, startTime);
    }
  }

  /**
   * GET /api/health
   * Health check endpoint
   */
  async handleHealthCheck(): Promise<ApiResponse> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    try {
      const dbHealthy = this.directExecutor ? await this.directExecutor.healthCheck() : true;

      return this.successResponse(
        {
          status: 'healthy',
          database: dbHealthy ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString(),
        },
        requestId,
        startTime
      );
    } catch (error) {
      return this.errorResponse(503, 'SERVICE_UNAVAILABLE', 'Health check failed', requestId, startTime);
    }
  }

  /**
   * POST /api/progress
   * Get progress for long-running operations
   */
  getProgress(requestId: string): ApiResponse<ExecutionProgress> {
    const startTime = Date.now();

    const request = this.requestQueue.get(requestId);
    if (!request) {
      return this.errorResponse(404, 'NOT_FOUND', `Request ${requestId} not found`, requestId, startTime);
    }

    // In real implementation, would track actual progress
    return this.successResponse(
      {
        status: 'processing' as const,
        percentage: 50,
        currentBatch: 5,
        totalBatches: 10,
        rowsProcessed: 5000,
        rowsFailed: 0,
        rowsTotal: 10000,
        estimatedTimeRemaining: 30000,
      },
      requestId,
      startTime
    );
  }

  /**
   * POST /api/cancel
   * Cancel long-running operation
   */
  async handleCancel(requestId: string): Promise<ApiResponse> {
    const startTime = Date.now();

    const request = this.requestQueue.get(requestId);
    if (!request) {
      return this.errorResponse(404, 'NOT_FOUND', `Request ${requestId} not found`, requestId, startTime);
    }

    this.requestQueue.delete(requestId);

    return this.successResponse(
      {
        message: `Request ${requestId} cancelled`,
      },
      requestId,
      startTime
    );
  }

  /**
   * Helper: Direct execution
   */
  private async handleDirectExecution(
    excelData: ExcelData,
    mappings: ColumnMapping[],
    config: SqlConfig,
    database: DatabaseType,
    connectionConfig: DbConnectionConfig
  ) {
    if (!this.directExecutor || this.directExecutor.getState().database !== database) {
      this.directExecutor = createDirectExecutor(database, connectionConfig);
    }

    return await this.directExecutor.execute(excelData, mappings, config, {
      batchSize: 1000,
      useTransactions: true,
      rollbackOnError: true,
      timeout: 300000,
      retryFailedRows: false,
      maxRetries: 0,
    });
  }

  /**
   * Helper: Validate conversion request
   */
  private validateConversionRequest(body: ConversionRequest): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!body.excelData) errors.push('excelData is required');
    if (!body.mappings || body.mappings.length === 0) errors.push('At least one mapping is required');
    if (!body.config) errors.push('config is required');
    if (!body.mode) errors.push('mode is required');
    if (!['dry-run', 'file-export', 'preview-diff', 'direct-execution'].includes(body.mode)) {
      errors.push(`Invalid mode: ${body.mode}`);
    }

    if (body.mode === 'direct-execution') {
      if (!body.database) errors.push('database is required for direct-execution mode');
      if (!body.connectionConfig) errors.push('connectionConfig is required for direct-execution mode');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Helper: Success response
   */
  private successResponse<T>(data: T, requestId: string, startTime: number): ApiResponse<T> {
    return {
      success: true,
      statusCode: 200,
      data,
      meta: {
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Helper: Error response
   */
  private errorResponse(
    statusCode: number,
    code: string,
    message: string,
    requestId: string,
    startTime: number
  ): ApiResponse {
    return {
      success: false,
      statusCode,
      error: {
        code,
        message,
      },
      meta: {
        requestId,
        timestamp: Date.now(),
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup
   */
  async cleanup() {
    this.requestQueue.clear();
  }
}

// Export for use
export function createApiEndpoints(): ApiEndpoints {
  return new ApiEndpoints();
}

export { ApiEndpoints };
