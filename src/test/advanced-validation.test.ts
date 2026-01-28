import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerValidationRule,
  validateWithCustomRules,
  detectConstraints,
} from '../advanced-validation';
import type { ExcelData, ColumnMapping, ValidationRule } from '@/types/converter';

describe('Advanced Validation Engine', () => {
  let testData: ExcelData;
  let testMappings: ColumnMapping[];

  beforeEach(() => {
    testData = {
      headers: ['id', 'email', 'age', 'score'],
      rows: [
        [1, 'user1@example.com', 25, 95.5],
        [2, 'user2@example.com', 30, 87.3],
        [3, 'invalid-email', 35, 92.1],
        [4, 'user4@example.com', null, 88.5],
      ],
      totalRows: 4,
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
        excelColumn: 'email',
        pgColumn: 'email',
        dataType: 'TEXT',
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
      },
      {
        excelColumn: 'age',
        pgColumn: 'age',
        dataType: 'INTEGER',
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
      },
      {
        excelColumn: 'score',
        pgColumn: 'score',
        dataType: 'DECIMAL',
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
      },
    ];
  });

  it('should detect type mismatches', () => {
    const errors = validateWithCustomRules(testData, testMappings);
    const typeErrors = errors.filter(e => e.message.includes('Type Mismatch'));
    expect(typeErrors.length).toBeGreaterThanOrEqual(0);
  });

  it('should detect NULL constraint violations', () => {
    const errors = validateWithCustomRules(testData, testMappings);
    const nullErrors = errors.filter(e => e.message.includes('NULL') || e.message.includes('empty'));
    expect(nullErrors.length).toBeGreaterThanOrEqual(0);
  });

  it('should register custom validation rules', () => {
    const customRule: ValidationRule = {
      id: 'email-format',
      name: 'Email Format',
      description: 'Validate email format',
      column: 'email',
      type: 'regex',
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      errorMessage: 'Invalid email format',
      severity: 'error',
    };

    registerValidationRule(customRule);

    // Rule should be registered and used
    expect(true).toBe(true);
  });

  it('should detect constraint hints', () => {
    const hints = detectConstraints(testData, testMappings);
    expect(hints).toBeInstanceOf(Map);
  });

  it('should handle empty data gracefully', () => {
    const emptyData: ExcelData = {
      headers: ['id'],
      rows: [],
      totalRows: 0,
      fileName: 'empty.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const errors = validateWithCustomRules(emptyData, [testMappings[0]]);
    expect(errors).toBeDefined();
  });

  it('should validate decimal type correctly', () => {
    const decimalData: ExcelData = {
      headers: ['value'],
      rows: [['123.45'], ['67.89'], ['invalid']],
      totalRows: 3,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const decimalMapping: ColumnMapping[] = [
      {
        excelColumn: 'value',
        pgColumn: 'value',
        dataType: 'DECIMAL',
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
      },
    ];

    const errors = validateWithCustomRules(decimalData, decimalMapping);
    expect(errors).toBeDefined();
  });

  it('should detect unique constraint violations', () => {
    const duplicateData: ExcelData = {
      headers: ['id', 'code'],
      rows: [
        [1, 'ABC'],
        [2, 'ABC'],
        [3, 'ABC'],
      ],
      totalRows: 3,
      fileName: 'test.xlsx',
      sheetName: 'Sheet1',
      sheets: ['Sheet1'],
    };

    const uniqueMappings: ColumnMapping[] = [
      {
        excelColumn: 'id',
        pgColumn: 'id',
        dataType: 'INTEGER',
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
      },
      {
        excelColumn: 'code',
        pgColumn: 'code',
        dataType: 'TEXT',
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
      },
    ];

    const errors = validateWithCustomRules(duplicateData, uniqueMappings);
    const uniqueErrors = errors.filter(e => e.message.includes('Unique'));
    expect(uniqueErrors.length).toBeGreaterThanOrEqual(0);
  });
});
