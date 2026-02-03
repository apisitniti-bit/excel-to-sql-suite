/**
 * Validation Module
 * Data quality checks for Excel-to-SQL conversion
 * Returns detailed error/warning reports with row/column references
 */

import type {
  ColumnMapping,
  ValidationError,
  ValidationResult,
  PostgresDataType,
} from '../types';

export interface ValidateOptions {
  strictTypes?: boolean;      // Reject type mismatches
  maxErrors?: number;         // Stop after N errors (0 = unlimited)
  checkConstraints?: boolean; // Validate NOT NULL, UNIQUE, etc.
}

const DEFAULT_OPTIONS: ValidateOptions = {
  strictTypes: false,
  maxErrors: 100,
  checkConstraints: true,
};

/**
 * Check if a value matches its PostgreSQL type
 */
export function validateType(
  value: unknown,
  expectedType: PostgresDataType
): { valid: boolean; message?: string } {
  if (value === null || value === undefined) {
    return { valid: true }; // NULL is valid for any type
  }
  
  const strValue = String(value).trim();
  
  if (strValue === '') {
    return { valid: true }; // Empty string treated as NULL
  }
  
  switch (expectedType) {
    case 'INTEGER':
    case 'SERIAL': {
      const intVal = parseInt(strValue, 10);
      if (isNaN(intVal)) {
        return { valid: false, message: `Expected INTEGER, got "${strValue}"` };
      }
      if (intVal < -2147483648 || intVal > 2147483647) {
        return { valid: false, message: `INTEGER value out of range: ${intVal}` };
      }
      return { valid: true };
    }
    
    case 'BIGINT':
    case 'BIGSERIAL': {
      const bigVal = parseInt(strValue, 10);
      if (isNaN(bigVal)) {
        return { valid: false, message: `Expected BIGINT, got "${strValue}"` };
      }
      return { valid: true };
    }
    
    case 'DECIMAL':
    case 'NUMERIC':
    case 'REAL':
    case 'DOUBLE PRECISION': {
      if (isNaN(parseFloat(strValue))) {
        return { valid: false, message: `Expected numeric type, got "${strValue}"` };
      }
      return { valid: true };
    }
    
    case 'BOOLEAN': {
      const lower = strValue.toLowerCase();
      const validValues = ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 't', 'f'];
      if (!validValues.includes(lower)) {
        return { valid: false, message: `Expected BOOLEAN, got "${strValue}"` };
      }
      return { valid: true };
    }
    
    case 'DATE': {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
        return { valid: false, message: `Expected DATE (YYYY-MM-DD), got "${strValue}"` };
      }
      const date = new Date(strValue);
      if (isNaN(date.getTime())) {
        return { valid: false, message: `Invalid DATE: "${strValue}"` };
      }
      return { valid: true };
    }
    
    case 'TIMESTAMPTZ':
    case 'TIMESTAMP': {
      const date = new Date(strValue);
      if (isNaN(date.getTime())) {
        return { valid: false, message: `Expected TIMESTAMP, got "${strValue}"` };
      }
      return { valid: true };
    }
    
    case 'UUID': {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(strValue)) {
        return { valid: false, message: `Expected UUID, got "${strValue}"` };
      }
      return { valid: true };
    }
    
    case 'JSON':
    case 'JSONB': {
      try {
        JSON.parse(strValue);
        return { valid: true };
      } catch {
        return { valid: false, message: `Expected valid JSON, got "${strValue}"` };
      }
    }
    
    case 'TEXT':
    case 'VARCHAR':
    case 'CHAR':
    default:
      // All string types accept any value
      return { valid: true };
  }
}

/**
 * Validate a single row against column mappings
 */
export function validateRow(
  row: unknown[],
  rowIndex: number,
  mappings: ColumnMapping[],
  options: ValidateOptions = {}
): ValidationError[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: ValidationError[] = [];
  
  for (const mapping of mappings) {
    const colIndex = parseInt(mapping.excelColumn.replace(/\D/g, ''), 10);
    const value = row[colIndex];
    
    // Check NOT NULL constraint
    if (opts.checkConstraints && !mapping.isNullable) {
      if (value === null || value === undefined || String(value).trim() === '') {
        errors.push({
          row: rowIndex + 2, // +2 for 1-indexed and header row
          column: mapping.pgColumn,
          value,
          message: `NOT NULL constraint violated for column "${mapping.pgColumn}"`,
          severity: 'error',
        });
      }
    }
    
    // Check type validity
    const typeCheck = validateType(value, mapping.dataType);
    if (!typeCheck.valid) {
      const severity = opts.strictTypes ? 'error' : 'warning';
      errors.push({
        row: rowIndex + 2,
        column: mapping.pgColumn,
        value,
        message: typeCheck.message || `Type mismatch for "${mapping.pgColumn}"`,
        severity,
      });
    }
    
    // Stop if max errors reached
    if (opts.maxErrors! > 0 && errors.length >= opts.maxErrors!) {
      break;
    }
  }
  
  return errors;
}

/**
 * Check for duplicate values in a column
 */
export function checkDuplicates(
  rows: unknown[][],
  columnIndex: number
): Map<unknown, number[]> {
  const valueMap = new Map<unknown, number[]>();
  
  rows.forEach((row, rowIndex) => {
    const value = row[columnIndex];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      const existing = valueMap.get(value) || [];
      existing.push(rowIndex);
      valueMap.set(value, existing);
    }
  });
  
  // Return only duplicates
  const duplicates = new Map<unknown, number[]>();
  for (const [value, indices] of valueMap) {
    if (indices.length > 1) {
      duplicates.set(value, indices);
    }
  }
  
  return duplicates;
}

/**
 * Validate entire dataset
 */
export function validateData(
  rows: unknown[],
  mappings: ColumnMapping[],
  options: ValidateOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // Validate each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const rowErrors = validateRow(row, i, mappings, opts);
    
    for (const error of rowErrors) {
      if (error.severity === 'error') {
        errors.push(error);
      } else {
        warnings.push(error);
      }
    }
    
    if (opts.maxErrors! > 0 && errors.length >= opts.maxErrors!) {
      break;
    }
  }
  
  // Check UNIQUE constraints
  if (opts.checkConstraints) {
    for (const mapping of mappings.filter(m => m.isUnique)) {
      const colIndex = parseInt(mapping.excelColumn.replace(/\D/g, ''), 10);
      const duplicates = checkDuplicates(rows as unknown[][], colIndex);
      
      for (const [value, indices] of duplicates) {
        for (const rowIndex of indices) {
          errors.push({
            row: rowIndex + 2,
            column: mapping.pgColumn,
            value,
            message: `UNIQUE constraint violated: duplicate value "${value}"`,
            severity: 'error',
          });
        }
      }
    }
  }
  
  return {
    errors,
    warnings,
    valid: errors.length === 0,
    rowCount: rows.length,
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

/**
 * Calculate data quality score (0-100)
 */
export function calculateQualityScore(
  rows: unknown[],
  mappings: ColumnMapping[]
): { score: number; details: Record<string, number> } {
  const totalCells = rows.length * mappings.length;
  let nullCells = 0;
  let typeMismatches = 0;
  
  for (const row of rows) {
    const rowArr = row as unknown[];
    for (const mapping of mappings) {
      const colIndex = parseInt(mapping.excelColumn.replace(/\D/g, ''), 10);
      const value = rowArr[colIndex];
      
      if (value === null || value === undefined || String(value).trim() === '') {
        if (!mapping.isNullable) {
          nullCells++;
        }
      }
      
      const typeCheck = validateType(value, mapping.dataType);
      if (!typeCheck.valid) {
        typeMismatches++;
      }
    }
  }
  
  const validCells = totalCells - nullCells - typeMismatches;
  const score = Math.round((validCells / totalCells) * 100);
  
  return {
    score,
    details: {
      totalCells,
      nullCells,
      typeMismatches,
      validCells,
    },
  };
}
