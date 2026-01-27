import { describe, it, expect, beforeEach } from 'vitest';
import { applyDefaults, getDefaultSqlConfig, updateConfigWithPrimaryKey } from '@/lib/defaults';
import { 
  validateDuplicatePrimaryKeys, 
  validateExcelData,
  hasValidationErrors,
  hasDuplicatePrimaryKeyError,
  getValidationSummary 
} from '@/lib/validation';
import type { ExcelData, ExcelColumn, ColumnMapping, SqlConfig } from '@/types/converter';

describe('Defaults Configuration', () => {
  const mockExcelData: ExcelData = {
    headers: ['ID', 'Name', 'Email'],
    rows: [['1', 'John', 'john@example.com']],
    totalRows: 1,
    fileName: 'test.xlsx',
    sheetName: 'Sheet1',
    sheets: ['Sheet1'],
  };

  const mockColumns: ExcelColumn[] = [
    { name: 'ID', index: 0, sampleValues: ['1', '2'], detectedType: 'INTEGER' },
    { name: 'Name', index: 1, sampleValues: ['John', 'Jane'], detectedType: 'TEXT' },
    { name: 'Email', index: 2, sampleValues: ['john@example.com'], detectedType: 'TEXT' },
  ];

  it('should apply TEXT as default data type for all columns', () => {
    const { columns } = applyDefaults(mockExcelData, mockColumns);
    
    columns.forEach(col => {
      expect(col.detectedType).toBe('TEXT');
    });
  });

  it('should mark first column as Primary Key by default', () => {
    const { mappings } = applyDefaults(mockExcelData, mockColumns);
    
    expect(mappings[0].isPrimaryKey).toBe(true);
    expect(mappings[1].isPrimaryKey).toBe(false);
    expect(mappings[2].isPrimaryKey).toBe(false);
  });

  it('should set first column as NOT NULL (PK)', () => {
    const { mappings } = applyDefaults(mockExcelData, mockColumns);
    
    expect(mappings[0].isNullable).toBe(false);
    expect(mappings[1].isNullable).toBe(true);
    expect(mappings[2].isNullable).toBe(true);
  });

  it('should mark first column as unique', () => {
    const { mappings } = applyDefaults(mockExcelData, mockColumns);
    
    expect(mappings[0].isUnique).toBe(true);
    expect(mappings[1].isUnique).toBe(false);
    expect(mappings[2].isUnique).toBe(false);
  });

  it('should return primaryKeyIndex as 0', () => {
    const { primaryKeyIndex } = applyDefaults(mockExcelData, mockColumns);
    
    expect(primaryKeyIndex).toBe(0);
  });

  it('should set batch size to 50000 in default config', () => {
    const config = getDefaultSqlConfig('test_table');
    
    expect(config.options.batchSize).toBe(50000);
  });

  it('should set transaction wrapping by default', () => {
    const config = getDefaultSqlConfig();
    
    expect(config.options.wrapInTransaction).toBe(true);
  });

  it('should update config with primary key from mappings', () => {
    const { mappings } = applyDefaults(mockExcelData, mockColumns);
    const config = getDefaultSqlConfig();
    
    const updated = updateConfigWithPrimaryKey(config, mappings);
    
    expect(updated.primaryKey).toContain('id');
    expect(updated.primaryKey.length).toBe(1);
  });
});

describe('Duplicate Primary Key Validation', () => {
  it('should detect duplicate primary key values', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Name'],
      rows: [
        ['1', 'John'],
        ['2', 'Jane'],
        ['1', 'John Duplicate'],
      ],
      totalRows: 3,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mappings: ColumnMapping[] = [
      { excelColumn: 'ID', pgColumn: 'id', dataType: 'TEXT', isPrimaryKey: true, isNullable: false, isUnique: true },
      { excelColumn: 'Name', pgColumn: 'name', dataType: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
    ];

    const errors = validateDuplicatePrimaryKeys(excelData, mappings);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Duplicated Key');
    expect(errors[0].severity).toBe('error');
  });

  it('should detect null primary key values', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Name'],
      rows: [
        ['1', 'John'],
        [null, 'Jane'],
        ['', 'Bob'],
      ],
      totalRows: 3,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mappings: ColumnMapping[] = [
      { excelColumn: 'ID', pgColumn: 'id', dataType: 'TEXT', isPrimaryKey: true, isNullable: false, isUnique: true },
      { excelColumn: 'Name', pgColumn: 'name', dataType: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
    ];

    const errors = validateDuplicatePrimaryKeys(excelData, mappings);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('NULL or empty Primary Key');
    expect(errors[0].severity).toBe('error');
  });

  it('should pass validation for unique primary keys', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Name'],
      rows: [
        ['1', 'John'],
        ['2', 'Jane'],
        ['3', 'Bob'],
      ],
      totalRows: 3,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mappings: ColumnMapping[] = [
      { excelColumn: 'ID', pgColumn: 'id', dataType: 'TEXT', isPrimaryKey: true, isNullable: false, isUnique: true },
      { excelColumn: 'Name', pgColumn: 'name', dataType: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
    ];

    const errors = validateDuplicatePrimaryKeys(excelData, mappings);

    expect(errors.length).toBe(0);
  });

  it('should report all duplicate instances', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Name'],
      rows: [
        ['1', 'John'],
        ['1', 'John2'],
        ['1', 'John3'],
        ['2', 'Jane'],
        ['2', 'Jane2'],
      ],
      totalRows: 5,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mappings: ColumnMapping[] = [
      { excelColumn: 'ID', pgColumn: 'id', dataType: 'TEXT', isPrimaryKey: true, isNullable: false, isUnique: true },
      { excelColumn: 'Name', pgColumn: 'name', dataType: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
    ];

    const errors = validateDuplicatePrimaryKeys(excelData, mappings);

    expect(errors.length).toBeGreaterThan(0);
    const mainError = errors.find(e => e.message.includes('Found 2 duplicate'));
    expect(mainError).toBeDefined();
  });
});

describe('Excel Data Validation', () => {
  it('should reject empty data', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Name'],
      rows: [],
      totalRows: 0,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mappings: ColumnMapping[] = [
      { excelColumn: 'ID', pgColumn: 'id', dataType: 'TEXT', isPrimaryKey: true, isNullable: false, isUnique: true },
    ];

    const errors = validateExcelData(excelData, mappings);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('No data rows found');
  });

  it('should require a primary key to be selected', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Name'],
      rows: [['1', 'John']],
      totalRows: 1,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mappings: ColumnMapping[] = [
      { excelColumn: 'ID', pgColumn: 'id', dataType: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: false },
      { excelColumn: 'Name', pgColumn: 'name', dataType: 'TEXT', isPrimaryKey: false, isNullable: true, isUnique: false },
    ];

    const errors = validateExcelData(excelData, mappings);

    expect(errors.some(e => e.message.includes('No Primary Key'))).toBe(true);
  });

  it('should detect missing values in NOT NULL columns', () => {
    const excelData: ExcelData = {
      headers: ['ID', 'Name'],
      rows: [
        ['1', 'John'],
        [null, 'Jane'],
      ],
      totalRows: 2,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const mappings: ColumnMapping[] = [
      { excelColumn: 'ID', pgColumn: 'id', dataType: 'TEXT', isPrimaryKey: true, isNullable: false, isUnique: true },
      { excelColumn: 'Name', pgColumn: 'name', dataType: 'TEXT', isPrimaryKey: false, isNullable: false, isUnique: false },
    ];

    const errors = validateExcelData(excelData, mappings);

    expect(errors.some(e => e.message.includes('NOT NULL'))).toBe(true);
  });
});

describe('Validation Helpers', () => {
  it('should identify errors correctly', () => {
    const errors = [
      { row: 1, column: 'ID', message: 'Error', severity: 'error' as const },
      { row: 2, column: 'Name', message: 'Warning', severity: 'warning' as const },
    ];

    expect(hasValidationErrors(errors)).toBe(true);
  });

  it('should return false when no errors', () => {
    const errors = [
      { row: 1, column: 'ID', message: 'Warning', severity: 'warning' as const },
    ];

    expect(hasValidationErrors(errors)).toBe(false);
  });

  it('should detect duplicate key errors', () => {
    const errors = [
      { row: 0, column: 'ID', message: 'Duplicated Key - Found 2 values', severity: 'error' as const },
    ];

    expect(hasDuplicatePrimaryKeyError(errors)).toBe(true);
  });

  it('should provide validation summary', () => {
    const errors = [
      { row: 1, column: 'ID', message: 'Duplicated Key - Found 1 value', severity: 'error' as const },
      { row: 2, column: 'Name', message: 'NULL PK', severity: 'error' as const },
      { row: 3, column: 'Email', message: 'Warning', severity: 'warning' as const },
    ];

    const summary = getValidationSummary(errors);

    expect(summary.errorCount).toBe(2);
    expect(summary.warningCount).toBe(1);
    expect(summary.hasDuplicateKeyError).toBe(true);
    expect(summary.messages.length).toBe(2);
  });
});
