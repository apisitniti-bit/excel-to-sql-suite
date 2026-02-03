import { describe, it, expect, beforeEach } from 'vitest';
import {
  errorReporter,
  classifyValidationError,
  generateErrorReport,
  suggestAutoFixes,
  exportErrorsAsCSV,
  exportErrorsAsJSON,
  getErrorSummary,
} from '../lib/error-reporter';
import type { ValidationError } from '@/types/converter';

describe('Error Reporter', () => {
  let testErrors: ValidationError[];

  beforeEach(() => {
    testErrors = [
      {
        row: 2,
        column: 'email',
        value: 'invalid-email',
        message: 'Type Mismatch: Column "email" expects TEXT but found invalid value at rows: 2',
        severity: 'warning',
      },
      {
        row: 4,
        column: 'age',
        value: null,
        message: 'Column "age" (NOT NULL) has 1 empty value(s) at rows: 4',
        severity: 'error',
      },
      {
        row: 0,
        column: 'id',
        value: '1',
        message: 'Duplicated Key - Found 3 duplicate Primary Key value(s)',
        severity: 'error',
      },
      {
        row: 5,
        column: 'status',
        value: 'active',
        message: 'Unique Constraint Violation: Column "status" has 2 duplicate value(s)',
        severity: 'error',
      },
      {
        row: 10,
        column: 'department_id',
        value: 'D-99',
        message: 'Foreign Key Violation: Column "department_id" has 1 reference(s) not found',
        severity: 'error',
      },
    ];
  });

  it('should classify type mismatch errors', () => {
    const typeError = testErrors[0];
    const classification = classifyValidationError(typeError);

    expect(classification.category).toBe('TYPE_MISMATCH');
    expect(classification.isRecoverable).toBe(true);
    expect(classification.suggestedActions.length).toBeGreaterThan(0);
  });

  it('should classify null constraint errors', () => {
    const nullError = testErrors[1];
    const classification = classifyValidationError(nullError);

    expect(classification.category).toBe('NULL_CONSTRAINT');
    expect(classification.isRecoverable).toBe(true);
  });

  it('should classify duplicate key errors', () => {
    const dupError = testErrors[2];
    const classification = classifyValidationError(dupError);

    expect(classification.category).toBe('DUPLICATE_KEY');
    expect(classification.isRecoverable).toBe(true);
    expect(classification.suggestedActions).toContain('Use SKIP mode to keep existing records');
  });

  it('should classify unique constraint errors', () => {
    const uniqueError = testErrors[3];
    const classification = classifyValidationError(uniqueError);

    expect(classification.category).toBe('UNIQUE_CONSTRAINT');
    expect(classification.isRecoverable).toBe(true);
  });

  it('should classify foreign key errors', () => {
    const fkError = testErrors[4];
    const classification = classifyValidationError(fkError);

    expect(classification.category).toBe('FOREIGN_KEY');
    expect(classification.isRecoverable).toBe(true);
    expect(classification.suggestedActions).toContain('Skip rows with missing references');
  });

  it('should generate comprehensive error report', () => {
    const report = generateErrorReport(testErrors);

    expect(report.totalErrors).toBe(5);
    expect(report.errorsByCategory.size).toBeGreaterThan(0);
    expect(report.errorsBySeverity.size).toBeGreaterThan(0);
    expect(report.errorsByColumn.size).toBeGreaterThan(0);
  });

  it('should group errors by severity', () => {
    const report = generateErrorReport(testErrors);
    const errors = report.errorsBySeverity.get('error');
    const warnings = report.errorsBySeverity.get('warning');

    expect(errors?.length).toBe(4);
    expect(warnings?.length).toBe(1);
  });

  it('should group errors by column', () => {
    const report = generateErrorReport(testErrors);
    const idErrors = report.errorsByColumn.get('id');
    const emailErrors = report.errorsByColumn.get('email');

    expect(idErrors?.length).toBe(1);
    expect(emailErrors?.length).toBe(1);
  });

  it('should generate auto-fix suggestions', () => {
    const suggestions = suggestAutoFixes(testErrors);

    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toHaveProperty('id');
    expect(suggestions[0]).toHaveProperty('title');
    expect(suggestions[0]).toHaveProperty('action');
  });

  it('should export errors to CSV format', () => {
    const csv = exportErrorsAsCSV(testErrors);

    expect(typeof csv).toBe('string');
    expect(csv).toContain('Row');
    expect(csv).toContain('Column');
    expect(csv).toContain('Severity');
    expect(csv).toContain('Message');
    expect(csv).toContain('email');
    expect(csv).toContain('Type Mismatch');
  });

  it('should export errors to JSON format', () => {
    const json = exportErrorsAsJSON(testErrors);
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(testErrors.length);
    expect(parsed[0]).toHaveProperty('row');
    expect(parsed[0]).toHaveProperty('column');
    expect(parsed[0]).toHaveProperty('message');
    expect(parsed[0]).toHaveProperty('severity');
  });

  it('should create error summary', () => {
    const summary = getErrorSummary(testErrors);

    expect(summary.totalErrors).toBe(5);
    expect(summary.errorCount).toBe(4);
    expect(summary.warningCount).toBe(1);
    expect(Object.keys(summary.byCategory).length).toBeGreaterThan(0);
    expect(Object.keys(summary.byColumn).length).toBeGreaterThan(0);
    expect(Array.isArray(summary.topErrors)).toBe(true);
  });

  it('should identify most common errors', () => {
    const duplicateErrors = [
      ...testErrors,
      {
        row: 20,
        column: 'email',
        value: 'invalid-email',
        message: 'Type Mismatch: Column "email" expects TEXT but found invalid value',
        severity: 'warning' as const,
      },
    ];

    const summary = getErrorSummary(duplicateErrors);
    expect(summary.topErrors.length).toBeGreaterThan(0);
    // Most common should be Type Mismatch (appears 2 times)
  });

  it('should handle empty error list', () => {
    const report = generateErrorReport([]);

    expect(report.totalErrors).toBe(0);
    expect(report.errorsByCategory.size).toBe(0);
    expect(report.errorsByColumn.size).toBe(0);
  });

  it('should escape special characters in CSV export', () => {
    const specialErrors: ValidationError[] = [
      {
        row: 1,
        column: 'text',
        value: 'Error with "quotes" and, commas',
        message: 'Error with "quotes" and, commas',
        severity: 'error',
      },
    ];

    const csv = exportErrorsAsCSV(specialErrors);
    expect(csv).toContain('""'); // Escaped quotes
  });

  it('should mark recoverable vs non-recoverable errors', () => {
    const fkError = testErrors[4];
    const classification = classifyValidationError(fkError);

    expect(classification.isRecoverable).toBe(true);

    const dbError: ValidationError = {
      row: 1,
      column: '',
      value: null,
      message: 'Database connection timeout',
      severity: 'error',
    };

    const dbClassification = classifyValidationError(dbError);
    expect(dbClassification.isRecoverable).toBe(false);
  });

  it('should provide root cause analysis', () => {
    const nullError = testErrors[1];
    const classification = classifyValidationError(nullError);

    expect(classification.rootCause).toContain('NULL');
    expect(classification.rootCause.length).toBeGreaterThan(0);
  });
});
