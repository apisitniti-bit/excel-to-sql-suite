import type { ExcelData, ColumnMapping, ValidationError } from '@/types/converter';

/**
 * Validates data for duplicated primary key values
 * Returns warnings if duplicates are found
 */
export function validateDuplicatePrimaryKeys(
  data: ExcelData,
  mappings: ColumnMapping[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const pkMapping = mappings.find(m => m.isPrimaryKey && m.pgColumn);

  if (!pkMapping) {
    return errors;
  }

  const pkColumnIndex = data.headers.indexOf(pkMapping.excelColumn);
  if (pkColumnIndex === -1) {
    return errors;
  }

  const seenValues = new Map<string, number[]>();
  const nullPKRows: number[] = [];

  // Scan all rows for PK values
  for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
    const row = data.rows[rowIndex];
    const pkValue = row[pkColumnIndex];

    // Handle null/empty PK values
    if (pkValue === null || pkValue === undefined || pkValue === '') {
      nullPKRows.push(rowIndex);
      continue;
    }

    const valueStr = String(pkValue).trim();
    if (!seenValues.has(valueStr)) {
      seenValues.set(valueStr, []);
    }
    seenValues.get(valueStr)!.push(rowIndex);
  }

  // Check for null primary keys
  if (nullPKRows.length > 0) {
    errors.push({
      row: 0,
      column: pkMapping.excelColumn,
      message: `Found ${nullPKRows.length} rows with NULL or empty Primary Key values (rows: ${nullPKRows
        .slice(0, 5)
        .map(r => r + 2)
        .join(', ')}${nullPKRows.length > 5 ? '...' : ''})`,
      severity: 'error',
    });
  }

  // Check for duplicate PK values
  const duplicates: Array<{ value: string; rows: number[] }> = [];
  for (const [value, rows] of seenValues.entries()) {
    if (rows.length > 1) {
      duplicates.push({ value, rows });
    }
  }

  if (duplicates.length > 0) {
    // Add main warning
    errors.push({
      row: 0,
      column: pkMapping.excelColumn,
      message: `Duplicated Key - Found ${duplicates.length} duplicate Primary Key value(s)`,
      severity: 'error',
    });

    // Add detail error for each duplicate
    for (const dup of duplicates.slice(0, 10)) {
      const rowNumbers = dup.rows.map(r => r + 2).join(', ');
      errors.push({
        row: 0,
        column: pkMapping.excelColumn,
        message: `  Value "${dup.value}" appears in rows: ${rowNumbers}`,
        severity: 'error',
      });
    }

    if (duplicates.length > 10) {
      errors.push({
        row: 0,
        column: pkMapping.excelColumn,
        message: `  ... and ${duplicates.length - 10} more duplicate(s)`,
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Validates all data integrity rules
 * Returns array of validation errors
 */
export function validateExcelData(
  data: ExcelData,
  mappings: ColumnMapping[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for empty data
  if (data.rows.length === 0) {
    errors.push({
      row: 0,
      column: '',
      message: 'No data rows found in Excel file',
      severity: 'error',
    });
    return errors;
  }

  // Check for primary key
  const pkMapping = mappings.find(m => m.isPrimaryKey && m.pgColumn);
  if (!pkMapping) {
    errors.push({
      row: 0,
      column: '',
      message: 'No Primary Key column selected',
      severity: 'error',
    });
  }

  // Validate duplicate primary keys
  const pkErrors = validateDuplicatePrimaryKeys(data, mappings);
  errors.push(...pkErrors);

  // Check for non-nullable columns with missing values
  for (const mapping of mappings) {
    if (!mapping.isNullable && mapping.pgColumn) {
      const colIndex = data.headers.indexOf(mapping.excelColumn);
      if (colIndex === -1) continue;

      let missingCount = 0;
      const missingRows: number[] = [];

      for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
        const value = data.rows[rowIndex][colIndex];
        if (value === null || value === undefined || value === '') {
          missingCount++;
          if (missingRows.length < 5) missingRows.push(rowIndex);
        }
      }

      if (missingCount > 0) {
        const rowStr = missingRows.map(r => r + 2).join(', ');
        errors.push({
          row: 0,
          column: mapping.excelColumn,
          message: `Column "${mapping.pgColumn}" (NOT NULL) has ${missingCount} empty value(s) at rows: ${rowStr}${
            missingCount > 5 ? '...' : ''
          }`,
          severity: 'error',
        });
      }
    }
  }

  return errors;
}

/**
 * Check if data has validation errors that prevent SQL generation
 */
export function hasValidationErrors(errors: ValidationError[]): boolean {
  return errors.some(e => e.severity === 'error');
}

/**
 * Check if data has duplicate primary key errors
 */
export function hasDuplicatePrimaryKeyError(errors: ValidationError[]): boolean {
  return errors.some(
    e => e.severity === 'error' && e.message.includes('Duplicated Key')
  );
}

/**
 * Get all validation errors as grouped messages
 */
export function getValidationSummary(errors: ValidationError[]): {
  errorCount: number;
  warningCount: number;
  hasDuplicateKeyError: boolean;
  messages: string[];
} {
  const errorCount = errors.filter(e => e.severity === 'error').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;
  const hasDuplicateKeyError = hasDuplicatePrimaryKeyError(errors);

  const messages = errors
    .filter(e => e.severity === 'error')
    .map(e => e.message);

  return {
    errorCount,
    warningCount,
    hasDuplicateKeyError,
    messages,
  };
}
