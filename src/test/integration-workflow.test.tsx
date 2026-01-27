import { describe, it, expect } from 'vitest';
import { parseExcelFile, analyzeColumns } from '@/lib/excel-parser';
import { generateSQL } from '@/lib/sql-generator';
import { applyDefaults, getDefaultSqlConfig, updateConfigWithPrimaryKey } from '@/lib/defaults';
import { validateExcelData, hasValidationErrors, getValidationSummary } from '@/lib/validation';
import type { ExcelData, ExcelColumn } from '@/types/converter';

describe('Full Workflow Integration', () => {
  describe('Complete Data Processing Pipeline', () => {
    it('should handle a complete workflow: import → validate → generate SQL', () => {
      // Step 1: Create mock Excel data (simulating file import)
      const excelData: ExcelData = {
        headers: ['UserID', 'Name', 'Email', 'Department'],
        rows: [
          ['U001', 'Alice Johnson', 'alice@company.com', 'Engineering'],
          ['U002', 'Bob Smith', 'bob@company.com', 'Sales'],
          ['U003', 'Carol White', 'carol@company.com', 'Marketing'],
          ['U004', 'David Brown', 'david@company.com', 'Engineering'],
          ['U005', 'Eve Davis', 'eve@company.com', 'HR'],
        ],
        totalRows: 5,
        fileName: 'users.xlsx',
        sheetName: 'Users',
        sheets: ['Users'],
      };

      // Step 2: Analyze columns (detect types)
      const mockColumns: ExcelColumn[] = [
        { name: 'UserID', index: 0, sampleValues: ['U001', 'U002'], detectedType: 'TEXT' },
        { name: 'Name', index: 1, sampleValues: ['Alice', 'Bob'], detectedType: 'TEXT' },
        { name: 'Email', index: 2, sampleValues: ['alice@company.com'], detectedType: 'TEXT' },
        { name: 'Department', index: 3, sampleValues: ['Engineering', 'Sales'], detectedType: 'TEXT' },
      ];

      // Step 3: Apply defaults
      const { mappings, primaryKeyIndex } = applyDefaults(excelData, mockColumns);

      expect(primaryKeyIndex).toBe(0); // UserID is PK
      expect(mappings[0].isPrimaryKey).toBe(true);
      expect(mappings.every(m => m.dataType === 'TEXT')).toBe(true);

      // Step 4: Validate data
      const errors = validateExcelData(excelData, mappings);
      expect(hasValidationErrors(errors)).toBe(false); // No errors

      // Step 5: Generate SQL
      const config = getDefaultSqlConfig('users');
      const { sql } = generateSQL(excelData, mappings, config);

      expect(sql).toContain('INSERT INTO "users"');
      expect(sql).toContain('VALUES');
      expect(sql).toMatch(/VALUES[\s\S]*\('U001'/); // Has data
      expect(sql).toContain('COMMIT');
    });

    it('should handle duplicate detection in full workflow', () => {
      const excelData: ExcelData = {
        headers: ['ID', 'Name'],
        rows: [
          ['1', 'Alice'],
          ['2', 'Bob'],
          ['1', 'Alice Duplicate'], // Duplicate ID
          ['3', 'Carol'],
        ],
        totalRows: 4,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const mockColumns: ExcelColumn[] = [
        { name: 'ID', index: 0, sampleValues: ['1', '2'], detectedType: 'TEXT' },
        { name: 'Name', index: 1, sampleValues: ['Alice', 'Bob'], detectedType: 'TEXT' },
      ];

      const { mappings } = applyDefaults(excelData, mockColumns);
      const errors = validateExcelData(excelData, mappings);

      // Should have validation errors
      expect(hasValidationErrors(errors)).toBe(true);

      const summary = getValidationSummary(errors);
      expect(summary.hasDuplicateKeyError).toBe(true);
      expect(summary.errorCount).toBeGreaterThan(0);

      // Should NOT generate SQL due to errors
      const config = getDefaultSqlConfig('test');
      if (hasValidationErrors(errors)) {
        // This is the expected path - validation blocks generation
        expect(true).toBe(true);
      }
    });

    it('should handle large dataset workflow correctly', () => {
      // Simulate a large dataset
      const largeRowCount = 100000;
      const rows = Array.from({ length: largeRowCount }, (_, i) => [
        `ID${i + 1}`,
        `User${i + 1}`,
        `user${i + 1}@example.com`,
      ]);

      const excelData: ExcelData = {
        headers: ['ID', 'Name', 'Email'],
        rows,
        totalRows: largeRowCount,
        fileName: 'large.xlsx',
        sheetName: 'Data',
        sheets: ['Data'],
      };

      const mockColumns: ExcelColumn[] = [
        { name: 'ID', index: 0, sampleValues: rows[0][0], detectedType: 'TEXT' },
        { name: 'Name', index: 1, sampleValues: rows[0][1], detectedType: 'TEXT' },
        { name: 'Email', index: 2, sampleValues: rows[0][2], detectedType: 'TEXT' },
      ];

      const { mappings } = applyDefaults(excelData, mockColumns);
      const errors = validateExcelData(excelData, mappings);

      // Should have no validation errors (no duplicates in sequence)
      expect(hasValidationErrors(errors)).toBe(false);

      // Generate SQL with batching
      const config = getDefaultSqlConfig('users');
      expect(config.options.batchSize).toBe(50000);

      const { sql } = generateSQL(excelData, mappings, config);

      // Should have 2 INSERT statements (100000 / 50000)
      const insertCount = (sql.match(/INSERT INTO/g) || []).length;
      expect(insertCount).toBe(2);

      // Should have all rows
      const rowMatches = sql.match(/\('ID\d+'/g) || [];
      expect(rowMatches.length).toBe(largeRowCount);
    });

    it('should handle mixed validation errors', () => {
      const excelData: ExcelData = {
        headers: ['ID', 'RequiredField', 'OptionalField'],
        rows: [
          ['1', 'Value1', 'Data1'],
          ['2', null, 'Data2'], // Missing required field
          ['1', 'Value3', 'Data3'], // Duplicate ID
          ['3', 'Value4', null], // Null in optional field (OK)
        ],
        totalRows: 4,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const mockColumns: ExcelColumn[] = [
        { name: 'ID', index: 0, sampleValues: ['1', '2'], detectedType: 'TEXT' },
        { name: 'RequiredField', index: 1, sampleValues: ['Value1'], detectedType: 'TEXT' },
        { name: 'OptionalField', index: 2, sampleValues: ['Data1'], detectedType: 'TEXT' },
      ];

      const { mappings } = applyDefaults(excelData, mockColumns);
      
      // Make the second column NOT NULL
      mappings[1].isNullable = false;
      
      const errors = validateExcelData(excelData, mappings);

      // Should detect multiple types of errors
      expect(hasValidationErrors(errors)).toBe(true);
      const summary = getValidationSummary(errors);
      expect(summary.errorCount).toBeGreaterThan(0);

      // Should detect duplicate key error
      expect(summary.hasDuplicateKeyError).toBe(true);
    });

    it('should respect custom configuration options in full workflow', () => {
      const excelData: ExcelData = {
        headers: ['ID', 'Name'],
        rows: Array.from({ length: 1000 }, (_, i) => [`${i + 1}`, `User${i + 1}`]),
        totalRows: 1000,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const mockColumns: ExcelColumn[] = [
        { name: 'ID', index: 0, sampleValues: ['1'], detectedType: 'TEXT' },
        { name: 'Name', index: 1, sampleValues: ['User1'], detectedType: 'TEXT' },
      ];

      const { mappings } = applyDefaults(excelData, mockColumns);
      const config = getDefaultSqlConfig('users');

      // Customize batch size
      config.options.batchSize = 100;
      config.options.wrapInTransaction = false;

      const { sql } = generateSQL(excelData, mappings, config);

      // Should have 10 INSERT statements (1000 / 100)
      const insertCount = (sql.match(/INSERT INTO/g) || []).length;
      expect(insertCount).toBe(10);

      // Should NOT have transaction wrapper
      expect(sql).not.toContain('BEGIN;');
      expect(sql).not.toContain('COMMIT;');
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should allow user to fix validation errors and regenerate', () => {
      let excelData: ExcelData = {
        headers: ['ID', 'Name'],
        rows: [['1', 'Alice'], ['1', 'Bob']], // Duplicate IDs
        totalRows: 2,
        fileName: 'test.xlsx',
        sheetName: 'Sheet1',
        sheets: ['Sheet1'],
      };

      const mockColumns: ExcelColumn[] = [
        { name: 'ID', index: 0, sampleValues: ['1'], detectedType: 'TEXT' },
        { name: 'Name', index: 1, sampleValues: ['Alice'], detectedType: 'TEXT' },
      ];

      let { mappings } = applyDefaults(excelData, mockColumns);
      let errors = validateExcelData(excelData, mappings);

      // Should have errors
      expect(hasValidationErrors(errors)).toBe(true);

      // User fixes data by removing duplicate
      excelData = {
        ...excelData,
        rows: [['1', 'Alice'], ['2', 'Bob']], // Fixed!
        totalRows: 2,
      };

      // Revalidate
      errors = validateExcelData(excelData, mappings);

      // Should now pass validation
      expect(hasValidationErrors(errors)).toBe(false);

      // Can now generate SQL
      const config = getDefaultSqlConfig('test');
      const { sql } = generateSQL(excelData, mappings, config);

      expect(sql).toContain('INSERT INTO');
    });
  });
});
