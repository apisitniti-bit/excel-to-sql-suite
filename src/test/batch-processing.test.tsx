import { describe, it, expect, beforeEach } from 'vitest';
import { generateSQL } from '@/lib/sql-generator';
import { applyDefaults, getDefaultSqlConfig } from '@/lib/defaults';
import type { ExcelData, ExcelColumn, ColumnMapping, SqlConfig } from '@/types/converter';

describe('Batch Processing - SQL Generation', () => {
  const createMockData = (rowCount: number): ExcelData => ({
    headers: ['ID', 'Name', 'Email'],
    rows: Array.from({ length: rowCount }, (_, i) => [
      `ID${i + 1}`,
      `User ${i + 1}`,
      `user${i + 1}@example.com`,
    ]),
    totalRows: rowCount,
    fileName: 'test.xlsx',
    sheetName: 'Sheet1',
    sheets: ['Sheet1'],
  });

  const mockColumns: ExcelColumn[] = [
    { name: 'ID', index: 0, sampleValues: ['ID1'], detectedType: 'TEXT' },
    { name: 'Name', index: 1, sampleValues: ['User 1'], detectedType: 'TEXT' },
    { name: 'Email', index: 2, sampleValues: ['user1@example.com'], detectedType: 'TEXT' },
  ];

  it('should keep single INSERT statement for small batches (< 50k rows)', () => {
    const excelData = createMockData(100);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    // Should contain only 1 INSERT statement
    const insertCount = (sql.match(/INSERT INTO/g) || []).length;
    expect(insertCount).toBe(1);

    // Should have 100 value rows
    const valueCount = (sql.match(/VALUES/g) || []).length;
    expect(valueCount).toBe(1);

    // Should contain all 100 rows
    expect(sql.match(/\(\s*'ID\d+'\s*,\s*'User \d+'/g)?.length).toBe(100);
  });

  it('should split data into multiple INSERT statements for large batches (> 50k rows)', () => {
    const excelData = createMockData(100000);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    // Should contain multiple INSERT statements
    const insertCount = (sql.match(/INSERT INTO/g) || []).length;
    expect(insertCount).toBeGreaterThan(1);

    // Should be approximately 2 (100000 / 50000)
    expect(insertCount).toBe(2);
  });

  it('should handle exactly 50k rows in single statement', () => {
    const excelData = createMockData(50000);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    const insertCount = (sql.match(/INSERT INTO/g) || []).length;
    expect(insertCount).toBe(1);
  });

  it('should handle 50001 rows in two statements', () => {
    const excelData = createMockData(50001);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    const insertCount = (sql.match(/INSERT INTO/g) || []).length;
    expect(insertCount).toBe(2);
  });

  it('should use custom batch size from config', () => {
    const excelData = createMockData(1000);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');
    
    // Override batch size to 100
    config.options.batchSize = 100;

    const { sql } = generateSQL(excelData, mappings, config);

    // Should have 10 INSERT statements (1000 / 100)
    const insertCount = (sql.match(/INSERT INTO/g) || []).length;
    expect(insertCount).toBe(10);
  });

  it('should maintain correct value format in batches', () => {
    const excelData = createMockData(100);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    // Should have VALUES keyword followed by comma-separated tuples
    expect(sql).toMatch(/VALUES\s*\('/);
    
    // Should have proper comma separation between rows
    expect(sql).toMatch(/'\),\s*\('/);
    
    // Should end with semicolon
    expect(sql.trim()).toMatch(/;$/);
  });

  it('should include all rows in batched output', () => {
    const excelData = createMockData(100000);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    // Count total rows in SQL (rough check)
    const rowMatches = sql.match(/\('ID\d+'/g) || [];
    expect(rowMatches.length).toBe(100000);
  });

  it('should wrap in transaction when enabled', () => {
    const excelData = createMockData(100);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');
    config.options.wrapInTransaction = true;

    const { sql } = generateSQL(excelData, mappings, config);

    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('COMMIT;');
  });

  it('should not wrap in transaction when disabled', () => {
    const excelData = createMockData(100);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');
    config.options.wrapInTransaction = false;

    const { sql } = generateSQL(excelData, mappings, config);

    expect(sql).not.toContain('BEGIN TRANSACTION;');
  });

  it('should generate valid SQL syntax for multiple batches', () => {
    const excelData = createMockData(100000);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    // Each INSERT statement should be valid
    const statements = sql.split('INSERT INTO');
    const validStatements = statements.filter(s => 
      s.includes('VALUES') && s.trim().endsWith(';')
    );
    
    expect(validStatements.length).toBeGreaterThan(0);
  });

  it('should handle edge case: 1 row', () => {
    const excelData = createMockData(1);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    const insertCount = (sql.match(/INSERT INTO/g) || []).length;
    expect(insertCount).toBe(1);
    expect(sql).toContain("('ID1'");
  });

  it('should handle edge case: very large batch (1 million rows)', () => {
    const excelData = createMockData(1000000);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');

    const { sql } = generateSQL(excelData, mappings, config);

    // Should have 20 INSERT statements (1000000 / 50000)
    const insertCount = (sql.match(/INSERT INTO/g) || []).length;
    expect(insertCount).toBe(20);

    // All rows should be included
    const rowCount = (sql.match(/\('ID\d+'/g) || []).length;
    expect(rowCount).toBe(1000000);
  });
});

describe('Batch Processing - UPSERT Mode', () => {
  const createMockData = (rowCount: number): ExcelData => ({
    headers: ['ID', 'Name', 'Email'],
    rows: Array.from({ length: rowCount }, (_, i) => [
      `ID${i + 1}`,
      `User ${i + 1}`,
      `user${i + 1}@example.com`,
    ]),
    totalRows: rowCount,
    fileName: 'test.xlsx',
    sheetName: 'Sheet1',
    sheets: ['Sheet1'],
  });

  const mockColumns: ExcelColumn[] = [
    { name: 'ID', index: 0, sampleValues: ['ID1'], detectedType: 'TEXT' },
    { name: 'Name', index: 1, sampleValues: ['User 1'], detectedType: 'TEXT' },
    { name: 'Email', index: 2, sampleValues: ['user1@example.com'], detectedType: 'TEXT' },
  ];

  it('should handle UPSERT mode with batching', () => {
    const excelData = createMockData(100);
    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('users');
    config.mode = 'UPSERT';

    const { sql } = generateSQL(excelData, mappings, config);

    expect(sql).toContain('INSERT INTO');
    expect(sql).toContain('ON CONFLICT');
    expect(sql).toContain('DO UPDATE SET');
  });
});

describe('Batch Processing - Edge Cases', () => {
  it('should handle special characters in data', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Description'],
      rows: [
        ['1', "It's a test"],
        ['2', 'Quote: "Hello"'],
        ['3', "Backslash: \\test"],
      ],
      totalRows: 3,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mockColumns: ExcelColumn[] = [
      { name: 'ID', index: 0, sampleValues: ['1'], detectedType: 'TEXT' },
      { name: 'Description', index: 1, sampleValues: ["It's a test"], detectedType: 'TEXT' },
    ];

    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('test');

    const { sql } = generateSQL(excelData, mappings, config);

    expect(sql).toBeDefined();
    expect(sql).toContain('INSERT INTO');
  });

  it('should handle null/empty values', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Optional'],
      rows: [
        ['1', 'value'],
        ['2', null],
        ['3', ''],
      ],
      totalRows: 3,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mockColumns: ExcelColumn[] = [
      { name: 'ID', index: 0, sampleValues: ['1'], detectedType: 'TEXT' },
      { name: 'Optional', index: 1, sampleValues: ['value'], detectedType: 'TEXT' },
    ];

    const { mappings } = applyDefaults(excelData, mockColumns);
    const config = getDefaultSqlConfig('test');

    const { sql } = generateSQL(excelData, mappings, config);

    expect(sql).toBeDefined();
    expect(sql).toContain('INSERT INTO');
  });
});
