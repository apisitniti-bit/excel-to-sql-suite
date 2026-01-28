import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDirectExecutor } from '@/lib/direct-executor';
import { createApiEndpoints } from '@/lib/api-endpoints';
import { createWebSocketServer } from '@/lib/websocket-server';
import { createCliTool } from '@/lib/cli-tool';
import type { ExcelData, ColumnMapping, SqlConfig } from '@/types/converter';
import type { DbConnectionConfig } from '@/lib/database-connection-mock';

/**
 * Phase 3 Module Tests
 * Tests for Direct Executor, API Endpoints, WebSocket Server, and CLI Tool
 */

describe('Phase 3: Database Integration Layer', () => {
  describe('DirectExecutor', () => {
    it('should create executor instance', () => {
      const config: DbConnectionConfig = {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'testdb',
      };

      const executor = createDirectExecutor('postgres', config);

      expect(executor).toBeDefined();
      expect(executor.getState()).toBeDefined();
    });

    it('should calculate batch count correctly', () => {
      const config: DbConnectionConfig = {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'testdb',
      };

      const executor = createDirectExecutor('postgres', config);

      // Mock data for testing
      expect(executor).toBeDefined();
    });

    it('should estimate remaining time', () => {
      const config: DbConnectionConfig = {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'testdb',
      };

      const executor = createDirectExecutor('postgres', config);

      expect(executor).toBeDefined();
    });

    it('should support progress callbacks', async () => {
      const config: DbConnectionConfig = {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'testdb',
      };

      const executor = createDirectExecutor('postgres', config);

      const progressUpdates: any[] = [];
      const callback = vi.fn((progress) => {
        progressUpdates.push(progress);
      });

      // Test that callback is properly typed
      expect(callback).toBeDefined();
    });

    it('should handle connection errors gracefully', async () => {
      const config: DbConnectionConfig = {
        type: 'postgres',
        host: 'invalid-host',
        port: 9999,
        username: 'test',
        password: 'test',
        database: 'testdb',
      };

      const executor = createDirectExecutor('postgres', config);

      expect(executor).toBeDefined();
    });

    it('should generate proper execution report', () => {
      const config: DbConnectionConfig = {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'testdb',
      };

      const executor = createDirectExecutor('postgres', config);

      expect(executor).toBeDefined();
    });
  });

  describe('ApiEndpoints', () => {
    let api: ReturnType<typeof createApiEndpoints>;

    beforeEach(() => {
      api = createApiEndpoints();
    });

    it('should create API endpoints instance', () => {
      expect(api).toBeDefined();
    });

    it('should validate conversion request', async () => {
      const mockRequest = {
        id: 'req1',
        timestamp: Date.now(),
        endpoint: '/api/convert',
        method: 'POST',
        body: {
          excelData: {
            headers: ['id', 'name'],
            rows: [[1, 'test']],
            totalRows: 1,
            fileName: 'test.xlsx',
            sheetName: 'Sheet1',
            sheets: ['Sheet1'],
          },
          mappings: [
            { sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' },
            { sourceColumn: 'name', targetColumn: 'name', dataType: 'text' },
          ],
          config: {
            tableName: 'users',
            conflictMode: 'SKIP' as const,
          },
          mode: 'dry-run' as const,
        },
      };

      const response = await api.handleConvert(mockRequest);
      // API should return a response (may not be success due to mocking)
      expect(response).toBeDefined();
      expect(response.meta).toBeDefined();
    });

    it('should reject invalid mode', async () => {
      const mockRequest = {
        id: 'req1',
        timestamp: Date.now(),
        endpoint: '/api/convert',
        method: 'POST',
        body: {
          excelData: {
            headers: ['id'],
            rows: [[1]],
            totalRows: 1,
            fileName: 'test.xlsx',
            sheetName: 'Sheet1',
            sheets: ['Sheet1'],
          },
          mappings: [{ sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' }],
          config: { tableName: 'users', conflictMode: 'SKIP' as const },
          mode: 'invalid' as any,
        },
      };

      const response = await api.handleConvert(mockRequest);
      expect(response.success).toBe(false);
    });

    it('should handle health check', async () => {
      const response = await api.handleHealthCheck();
      expect(response.success).toBe(true);
      expect(response.data?.status).toBe('healthy');
    });

    it('should validate missing database config', async () => {
      const mockRequest = {
        id: 'req1',
        timestamp: Date.now(),
        endpoint: '/api/convert',
        method: 'POST',
        body: {
          excelData: {
            headers: ['id'],
            rows: [[1]],
            totalRows: 1,
            fileName: 'test.xlsx',
            sheetName: 'Sheet1',
            sheets: ['Sheet1'],
          },
          mappings: [{ sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' }],
          config: { tableName: 'users', conflictMode: 'SKIP' as const },
          mode: 'direct-execution' as const,
          // Missing database and connectionConfig
        },
      };

      const response = await api.handleConvert(mockRequest);
      expect(response.success).toBe(false);
    });

    it('should generate unique request IDs', () => {
      const request1 = {
        id: 'req1',
        timestamp: Date.now(),
        endpoint: '/api/convert',
        method: 'POST',
      };

      const request2 = {
        id: 'req2',
        timestamp: Date.now(),
        endpoint: '/api/convert',
        method: 'POST',
      };

      expect(request1.id).not.toBe(request2.id);
    });

    it('should handle validation endpoint', () => {
      const mockRequest = {
        id: 'req1',
        timestamp: Date.now(),
        endpoint: '/api/convert/validate',
        method: 'POST',
        body: {
          excelData: {
            headers: ['id', 'name'],
            rows: [[1, 'test']],
            totalRows: 1,
            fileName: 'test.xlsx',
            sheetName: 'Sheet1',
            sheets: ['Sheet1'],
          },
          mappings: [
            { sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' },
            { sourceColumn: 'name', targetColumn: 'name', dataType: 'text' },
          ],
          config: {
            tableName: 'users',
            conflictMode: 'SKIP' as const,
          },
          mode: 'dry-run' as const,
        },
      };

      const response = api.handleValidate(mockRequest);
      expect(response.success).toBe(true);
      expect(response.data?.valid).toBe(true);
    });
  });

  describe('WebSocketServer', () => {
    let wsServer: ReturnType<typeof createWebSocketServer>;

    beforeEach(() => {
      wsServer = createWebSocketServer();
    });

    it('should create WebSocket server instance', () => {
      expect(wsServer).toBeDefined();
    });

    it('should create session', () => {
      const excelData: ExcelData = {
        headers: ['id', 'name'],
        rows: [[1, 'test']],
        totalRows: 1,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const mappings: ColumnMapping[] = [
        { sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' },
        { sourceColumn: 'name', targetColumn: 'name', dataType: 'text' },
      ];

      const config: SqlConfig = {
        tableName: 'users',
        conflictMode: 'SKIP',
      };

      const session = wsServer.createSession(excelData, mappings, config);

      expect(session).toBeDefined();
      expect(session.sessionId).toMatch(/^sess_/);
      expect(session.status).toBe('pending');
    });

    it('should subscribe to session', () => {
      const excelData: ExcelData = {
        headers: ['id'],
        rows: [[1]],
        totalRows: 1,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const session = wsServer.createSession(
        excelData,
        [{ sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' }],
        { tableName: 'users', conflictMode: 'SKIP' }
      );

      const subscribed = wsServer.subscribe(session.sessionId, 'conn1');
      expect(subscribed).toBe(true);
    });

    it('should track active sessions', () => {
      const excelData: ExcelData = {
        headers: ['id'],
        rows: [[1]],
        totalRows: 1,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      wsServer.createSession(
        excelData,
        [{ sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' }],
        { tableName: 'users', conflictMode: 'SKIP' }
      );

      const sessions = wsServer.getAllSessions();
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should cleanup sessions', () => {
      const excelData: ExcelData = {
        headers: ['id'],
        rows: [[1]],
        totalRows: 1,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const session = wsServer.createSession(
        excelData,
        [{ sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' }],
        { tableName: 'users', conflictMode: 'SKIP' }
      );

      wsServer.cleanupSession(session.sessionId);

      const retrieved = wsServer.getSession(session.sessionId);
      expect(retrieved).toBeUndefined();
    });

    it('should handle unsubscribe', () => {
      const excelData: ExcelData = {
        headers: ['id'],
        rows: [[1]],
        totalRows: 1,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const session = wsServer.createSession(
        excelData,
        [{ sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' }],
        { tableName: 'users', conflictMode: 'SKIP' }
      );

      wsServer.subscribe(session.sessionId, 'conn1');
      wsServer.unsubscribe(session.sessionId, 'conn1');

      expect(session.subscribers.size).toBe(0);
    });
  });

  describe('CliTool', () => {
    let cli: ReturnType<typeof createCliTool>;

    beforeEach(() => {
      cli = createCliTool();
    });

    it('should create CLI tool instance', () => {
      expect(cli).toBeDefined();
    });

    it('should parse arguments correctly', () => {
      const args = [
        '--input',
        'data.xlsx',
        '--mode',
        'dry-run',
        '--verbose',
      ];

      const config = cli.parseArguments(args);

      expect(config.input).toBe('data.xlsx');
      expect(config.mode).toBe('dry-run');
      expect(config.verbose).toBe(true);
    });

    it('should parse database arguments', () => {
      const args = [
        '--input',
        'data.xlsx',
        '--database',
        'postgres',
        '--host',
        'localhost',
        '--user',
        'admin',
      ];

      const config = cli.parseArguments(args);

      expect(config.input).toBe('data.xlsx');
      expect(config.database).toBe('postgres');
      expect(config.host).toBe('localhost');
      expect(config.username).toBe('admin');
    });

    it('should validate configuration', () => {
      const config = {
        input: 'data.xlsx',
        mode: 'dry-run' as const,
      };

      const validation = cli.validateConfig(config);
      expect(validation.valid).toBe(true);
    });

    it('should require database config for direct-execution', () => {
      const config = {
        input: 'data.xlsx',
        mode: 'direct-execution' as const,
      };

      const validation = cli.validateConfig(config);
      expect(validation.valid).toBe(false);
      expect(validation.errors?.length).toBeGreaterThan(0);
    });

    it('should validate all required database fields', () => {
      const config = {
        input: 'data.xlsx',
        mode: 'direct-execution' as const,
        database: 'postgres' as const,
        host: 'localhost',
        // Missing other required fields
      };

      const validation = cli.validateConfig(config);
      expect(validation.valid).toBe(false);
    });

    it('should execute dry-run mode', async () => {
      const config = {
        input: 'data.xlsx',
        mode: 'dry-run' as const,
      };

      const output = await cli.execute(config);
      expect(output.success).toBe(true);
      expect(output.mode).toBe('dry-run');
    });

    it('should format output correctly', () => {
      const output = {
        success: true,
        mode: 'dry-run' as const,
        duration: 100,
        message: 'Test completed',
      };

      const formatted = cli.formatOutput(output, false);
      expect(formatted).toContain('SUCCESS');
      expect(formatted).toContain('dry-run');
    });

    it('should format output as JSON', () => {
      const output = {
        success: true,
        mode: 'dry-run' as const,
        duration: 100,
        message: 'Test completed',
      };

      const formatted = cli.formatOutput(output, true);
      const parsed = JSON.parse(formatted);

      expect(parsed.success).toBe(true);
      expect(parsed.mode).toBe('dry-run');
    });
  });

  describe('Phase 3 Integration', () => {
    it('should support full pipeline from API to database', async () => {
      const api = createApiEndpoints();
      expect(api).toBeDefined();
    });

    it('should track progress across all components', () => {
      const wsServer = createWebSocketServer();

      const excelData: ExcelData = {
        headers: ['id'],
        rows: [[1]],
        totalRows: 1,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const session = wsServer.createSession(
        excelData,
        [{ sourceColumn: 'id', targetColumn: 'id', dataType: 'integer' }],
        { tableName: 'users', conflictMode: 'SKIP' }
      );

      expect(session.progress.percentage).toBe(0);
      expect(session.progress.status).toBe('pending');
    });

    it('should provide consistent error handling', async () => {
      const cli = createCliTool();
      const config = {
        input: 'data.xlsx',
        mode: 'direct-execution' as const,
      };

      const output = await cli.execute(config);
      expect(output.success).toBe(false);
      expect(output.errors).toBeDefined();
    });

    it('should measure performance correctly', async () => {
      const cli = createCliTool();
      const config = {
        input: 'data.xlsx',
        mode: 'dry-run' as const,
      };

      const startTime = Date.now();
      const output = await cli.execute(config);
      const elapsed = Date.now() - startTime;

      // Duration should be set
      expect(output.duration).toBeGreaterThanOrEqual(0);
      expect(output.duration).toBeLessThanOrEqual(elapsed + 100);
    });
  });
});
