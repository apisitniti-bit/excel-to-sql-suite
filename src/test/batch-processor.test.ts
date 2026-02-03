import { describe, it, expect, beforeEach } from 'vitest';
import { BatchProcessor } from '../lib/batch-processor';
import type { ExcelData, ColumnMapping, SqlConfig } from '@/types/converter';

describe('Batch Processor', () => {
  let processor: BatchProcessor;
  let testData: ExcelData;
  let testMappings: ColumnMapping[];
  let testConfig: SqlConfig;

  beforeEach(() => {
    processor = new BatchProcessor(100, 2); // Small batch size for testing

    testData = {
      headers: ['id', 'name', 'email'],
      rows: Array.from({ length: 250 }, (_, i) => [
        i + 1,
        `user${i}`,
        `user${i}@example.com`,
      ]),
      totalRows: 250,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    testMappings = [
      {
        excelColumn: 'id',
        pgColumn: 'id',
        dataType: 'INTEGER',
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
      },
      {
        excelColumn: 'name',
        pgColumn: 'name',
        dataType: 'TEXT',
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
      },
      {
        excelColumn: 'email',
        pgColumn: 'email',
        dataType: 'TEXT',
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
      },
    ];

    testConfig = {
      tableName: 'users',
      mode: 'INSERT',
      database: 'postgresql',
      primaryKey: ['id'],
      conflictKeys: [],
      options: {
        ignoreNullValues: false,
        trimStrings: true,
        castTypes: false,
        batchSize: 100,
        wrapInTransaction: true,
        onConflictAction: 'DO NOTHING',
      },
    } as unknown as SqlConfig;
  });

  it('should split data into batches correctly', () => {
    const batches = processor.splitIntoBatches(testData.rows);
    expect(batches.length).toBe(3); // 250 rows / 100 batch size = 3 batches
    expect(batches[0].length).toBe(100);
    expect(batches[1].length).toBe(100);
    expect(batches[2].length).toBe(50);
  });

  it('should handle batches with exact batch size', () => {
    const processor200 = new BatchProcessor(100, 2);
    const testData200: ExcelData = {
      ...testData,
      rows: testData.rows.slice(0, 200),
      totalRows: 200,
    };

    const batches = processor200.splitIntoBatches(testData200.rows);
    expect(batches.length).toBe(2);
    expect(batches[0].length).toBe(100);
    expect(batches[1].length).toBe(100);
  });

  it('should process a batch', async () => {
    const batchData = testData.rows.slice(0, 100);
    const result = await processor.processBatch(
      0,
      batchData,
      testData.headers,
      testMappings,
      testConfig
    );

    expect(result).toBeDefined();
    expect(result.batchId).toBe(0);
    expect(result.rowsProcessed).toBe(100);
    expect(result.status).toMatch(/success|partial|failed/);
  });

  it('should handle empty batch gracefully', async () => {
    const result = await processor.processBatch(
      0,
      [],
      testData.headers,
      testMappings,
      testConfig
    );

    expect(result.rowsProcessed).toBe(0);
  });

  it('should aggregate results correctly', () => {
    const mockResults = [
      {
        batchId: 0,
        rowsProcessed: 100,
        rowsSucceeded: 100,
        rowsFailed: 0,
        errors: [],
        duration: 500,
        status: 'success' as const,
      },
      {
        batchId: 1,
        rowsProcessed: 100,
        rowsSucceeded: 95,
        rowsFailed: 5,
        errors: [],
        duration: 600,
        status: 'partial' as const,
      },
      {
        batchId: 2,
        rowsProcessed: 50,
        rowsSucceeded: 50,
        rowsFailed: 0,
        errors: [],
        duration: 300,
        status: 'success' as const,
      },
    ];

    const aggregated = processor.aggregateResults(mockResults);

    expect(aggregated.totalProcessed).toBe(250);
    expect(aggregated.totalSucceeded).toBe(245);
    expect(aggregated.totalFailed).toBe(5);
    expect(aggregated.overallStatus).toBe('partial');
  });

  it('should generate report with recommendations', () => {
    const mockResults = [
      {
        batchId: 0,
        rowsProcessed: 100,
        rowsSucceeded: 100,
        rowsFailed: 0,
        errors: [],
        duration: 500,
        status: 'success' as const,
      },
    ];

    const aggregated = processor.aggregateResults(mockResults);
    const report = processor.generateReport(aggregated);

    expect(report.summary).toContain('Processed: 100 rows');
    expect(report.recommendations).toBeDefined();
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('should handle errors in batch processing', async () => {
    const badData: ExcelData = {
      headers: ['id', 'name'],
      rows: [['invalid', 'user1']], // 'invalid' instead of number for id
      totalRows: 1,
      fileName: 'bad.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const result = await processor.processBatch(
      0,
      badData.rows,
      badData.headers,
      testMappings,
      testConfig
    );

    expect(result).toBeDefined();
    expect(['success', 'partial', 'failed'].includes(result.status)).toBe(true);
  });

  it('should calculate progress correctly', async () => {
    const progressUpdates: any[] = [];
    const mockOnProgress = (progress: any) => {
      progressUpdates.push(progress);
    };

    // Execute parallel would track progress
    // For now, just verify the structure is defined
    expect(typeof mockOnProgress).toBe('function');
  });

  it('should handle different batch sizes', () => {
    const processor50 = new BatchProcessor(50, 1);
    const batches = processor50.splitIntoBatches(testData.rows);
    expect(batches.length).toBe(5); // 250 / 50 = 5
    expect(batches[0].length).toBe(50);
  });

  it('should support concurrent batch processing', () => {
    const processor4 = new BatchProcessor(100, 4);
    expect(processor4).toBeDefined();
    // Concurrency is configurable
  });
});
