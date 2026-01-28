import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionManager } from '@/lib/transaction-manager';
import { ExecutionManager } from '@/lib/execution-manager';
import type { ExcelData, ColumnMapping, SqlConfig } from '@/types/converter';

const mockExcelData: ExcelData = {
  headers: ['ID', 'Name', 'Email', 'Age'],
  rows: [
    ['1', 'John Doe', 'john@example.com', '30'],
    ['2', 'Jane Smith', 'jane@example.com', '28'],
  ],
  totalRows: 2,
  fileName: 'test.xlsx',
  sheetName: 'Sheet1',
  sheets: ['Sheet1'],
};

const mockMappings: ColumnMapping[] = [
  { excelColumn: 'ID', pgColumn: 'id', dataType: 'INTEGER', isPrimaryKey: true, isNullable: false, isUnique: true },
  { excelColumn: 'Name', pgColumn: 'name', dataType: 'VARCHAR', isPrimaryKey: false, isNullable: false, isUnique: false },
];

const mockSqlConfig: SqlConfig = {
  tableName: 'users',
  mode: 'INSERT',
  database: 'postgresql',
  primaryKey: ['id'],
  conflictKeys: ['id'],
  options: {
    ignoreNullValues: true,
    trimStrings: true,
    castTypes: true,
    batchSize: 1000,
    wrapInTransaction: true,
    onConflictAction: 'DO NOTHING',
  },
};

describe('TransactionManager', () => {
  let manager: TransactionManager;

  beforeEach(() => {
    manager = new TransactionManager('postgresql');
  });

  it('should begin transaction', () => {
    const sql = manager.beginTransaction();
    expect(sql).toContain('BEGIN');
  });

  it('should commit transaction', () => {
    manager.beginTransaction();
    const sql = manager.commitTransaction();
    expect(sql).toContain('COMMIT');
  });

  it('should create savepoint', () => {
    manager.beginTransaction();
    const sql = manager.createSavepoint('test_sp');
    expect(sql).toContain('SAVEPOINT');
  });

  it('should track state', () => {
    expect(manager.getState().isActive).toBe(false);
    manager.beginTransaction();
    expect(manager.getState().isActive).toBe(true);
  });

  it('should support MySQL', () => {
    const mysqlMgr = new TransactionManager('mysql');
    const sql = mysqlMgr.beginTransaction();
    expect(sql).toContain('START TRANSACTION');
  });

  it('should support MSSQL', () => {
    const mssqlMgr = new TransactionManager('mssql');
    const sql = mssqlMgr.beginTransaction();
    expect(sql).toContain('BEGIN');
  });
});

describe('ExecutionManager', () => {
  let manager: ExecutionManager;

  beforeEach(() => {
    manager = new ExecutionManager('postgresql');
  });

  it('should execute dry-run', async () => {
    const result = await manager.executeDryRun(
      mockExcelData,
      mockMappings,
      mockSqlConfig
    );
    expect(result.isValid).toBeDefined();
  });

  it('should execute file-export', async () => {
    const result = await manager.executeFileExport(
      mockExcelData,
      mockMappings,
      mockSqlConfig
    );
    expect(result.mode).toBe('file-export');
    expect(result.sql).toBeDefined();
  });

  it('should execute preview-diff', async () => {
    const result = await manager.executePreviewDiff(
      mockExcelData,
      mockMappings,
      mockSqlConfig
    );
    expect(result.mode).toBe('preview-diff');
  });

  it('should execute main method with dry-run', async () => {
    const result = await manager.execute(
      'dry-run',
      mockExcelData,
      mockMappings,
      mockSqlConfig
    );
    expect(result.mode).toBe('dry-run');
  });

  it('should include report', async () => {
    const result = await manager.execute(
      'file-export',
      mockExcelData,
      mockMappings,
      mockSqlConfig
    );
    expect(result.report).toBeDefined();
  });

  it('should measure duration', async () => {
    const result = await manager.execute(
      'dry-run',
      mockExcelData,
      mockMappings,
      mockSqlConfig
    );
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});
