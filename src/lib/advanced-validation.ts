import type { ExcelData, ColumnMapping, ValidationError } from '@/types/converter';

/**
 * Advanced Validation Engine
 * Comprehensive data validation with constraint simulation, custom rules, and intelligent error classification
 */

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  column: string;
  type: 'regex' | 'custom' | 'range' | 'enum' | 'format';
  pattern?: string | RegExp;
  enum?: string[];
  min?: number;
  max?: number;
  customFn?: (value: any) => boolean;
  errorMessage?: string;
  severity: 'error' | 'warning';
}

export interface ConstraintHint {
  column: string;
  type: 'primary-key' | 'unique' | 'not-null' | 'foreign-key';
  confidence: number; // 0-1
  reason: string;
}

export interface ValidationContext {
  totalRows: number;
  processedRows: number;
  failedRows: number;
  startTime: number;
}

class AdvancedValidationEngine {
  private rules: Map<string, ValidationRule> = new Map();
  private context: ValidationContext | null = null;

  /**
   * Register a custom validation rule
   */
  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Unregister a validation rule
   */
  unregisterRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get all registered rules
   */
  getRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Apply custom validation rules to a value
   */
  validateByRules(
    value: any,
    mappings: ColumnMapping[],
    columnName: string
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const applicableRules = Array.from(this.rules.values()).filter(
      r => r.column === columnName
    );

    for (const rule of applicableRules) {
      let passed = false;

      if (rule.type === 'regex' && rule.pattern) {
        const regex = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
        passed = regex.test(String(value));
      } else if (rule.type === 'enum' && rule.enum) {
        passed = rule.enum.includes(String(value));
      } else if (rule.type === 'range' && rule.min !== undefined && rule.max !== undefined) {
        const num = parseFloat(String(value));
        passed = num >= rule.min && num <= rule.max;
      } else if (rule.type === 'custom' && rule.customFn) {
        passed = rule.customFn(value);
      } else if (rule.type === 'format') {
        passed = this.validateFormat(value, rule.pattern as string);
      }

      if (!passed) {
        errors.push({
          row: 0,
          column: columnName,
          message: rule.errorMessage || `Value "${value}" failed validation rule: ${rule.name}`,
          severity: rule.severity,
        });
      }
    }

    return errors;
  }

  /**
   * Validate data types with coercion hints
   */
  validateDataTypes(
    data: ExcelData,
    mappings: ColumnMapping[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const typeValidators: Record<string, (v: string) => boolean> = {
      INTEGER: (v: string) => /^-?\d+$/.test(v.trim()),
      BIGINT: (v: string) => /^-?\d+$/.test(v.trim()),
      DECIMAL: (v: string) => /^-?\d+(\.\d+)?$/.test(v.trim()),
      BOOLEAN: (v: string) => /^(true|false|0|1|yes|no)$/i.test(v.trim()),
      DATE: (v: string) => !isNaN(Date.parse(v.trim())),
      TIMESTAMP: (v: string) => !isNaN(Date.parse(v.trim())),
      TIMESTAMPTZ: (v: string) => !isNaN(Date.parse(v.trim())),
      UUID: (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim()),
      JSON: (v: string) => {
        try {
          JSON.parse(v.trim());
          return true;
        } catch {
          return false;
        }
      },
      JSONB: (v: string) => {
        try {
          JSON.parse(v.trim());
          return true;
        } catch {
          return false;
        }
      },
    };

    for (const mapping of mappings) {
      if (!mapping.pgColumn) continue;

      const colIndex = data.headers.indexOf(mapping.excelColumn);
      if (colIndex === -1) continue;

      const validator = typeValidators[mapping.dataType];
      if (!validator) continue;

      let failCount = 0;
      const failRows: number[] = [];

      for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
        const value = data.rows[rowIndex][colIndex];

        // Skip null/empty for nullable columns
        if ((value === null || value === undefined || value === '') && mapping.isNullable) {
          continue;
        }

        // Skip null/empty for non-nullable
        if (value === null || value === undefined || value === '') {
          continue;
        }

        if (!validator(String(value))) {
          failCount++;
          if (failRows.length < 5) failRows.push(rowIndex);
        }
      }

      if (failCount > 0) {
        const rowStr = failRows.map(r => r + 2).join(', ');
        errors.push({
          row: 0,
          column: mapping.excelColumn,
          message: `Type Mismatch: Column "${mapping.pgColumn}" expects ${mapping.dataType} but found ${failCount} invalid value(s) at rows: ${rowStr}${
            failCount > 5 ? `... (+${failCount - 5} more)` : ''
          }. Suggestion: Override data type or clean data.`,
          severity: 'warning',
        });
      }
    }

    return errors;
  }

  /**
   * Validate unique constraints
   */
  validateUniqueConstraints(
    data: ExcelData,
    mappings: ColumnMapping[]
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const uniqueMappings = mappings.filter(m => m.isUnique && m.pgColumn);

    for (const mapping of uniqueMappings) {
      const colIndex = data.headers.indexOf(mapping.excelColumn);
      if (colIndex === -1) continue;

      const seenValues = new Map<string, number[]>();

      for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
        const value = data.rows[rowIndex][colIndex];

        if (value === null || value === undefined || value === '') {
          continue; // NULLs allowed in unique constraints
        }

        const valueStr = String(value).trim();
        if (!seenValues.has(valueStr)) {
          seenValues.set(valueStr, []);
        }
        seenValues.get(valueStr)!.push(rowIndex);
      }

      const duplicates = Array.from(seenValues.entries()).filter(([_, rows]) => rows.length > 1);

      if (duplicates.length > 0) {
        errors.push({
          row: 0,
          column: mapping.excelColumn,
          message: `Unique Constraint Violation: Column "${mapping.pgColumn}" has ${duplicates.length} duplicate value(s). Details: ${duplicates
            .slice(0, 3)
            .map(([val, rows]) => `"${val}" at rows ${rows.map(r => r + 2).join(',')}`)
            .join('; ')}${duplicates.length > 3 ? '...' : ''}`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Validate foreign key constraints (simulat ed)
   */
  validateForeignKeyConstraints(
    data: ExcelData,
    mappings: ColumnMapping[],
    fkReferences?: Map<string, Set<string>>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const fkMappings = mappings.filter(m => m.isPrimaryKey === false && m.pgColumn);

    if (!fkReferences) {
      return errors; // FK validation requires reference data
    }

    for (const mapping of fkMappings) {
      const refSet = fkReferences.get(mapping.pgColumn);
      if (!refSet) continue;

      const colIndex = data.headers.indexOf(mapping.excelColumn);
      if (colIndex === -1) continue;

      let notFoundCount = 0;
      const notFoundRows: number[] = [];

      for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
        const value = data.rows[rowIndex][colIndex];

        if (value === null || value === undefined || value === '') {
          continue; // NULLs allowed in FKs
        }

        if (!refSet.has(String(value).trim())) {
          notFoundCount++;
          if (notFoundRows.length < 5) notFoundRows.push(rowIndex);
        }
      }

      if (notFoundCount > 0) {
        const rowStr = notFoundRows.map(r => r + 2).join(', ');
        errors.push({
          row: 0,
          column: mapping.excelColumn,
          message: `Foreign Key Violation: Column "${mapping.pgColumn}" has ${notFoundCount} reference(s) not found in database at rows: ${rowStr}${
            notFoundCount > 5 ? `... (+${notFoundCount - 5} more)` : ''
          }. Suggestion: Verify referenced values exist or use UPSERT mode.`,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Detect constraint hints from data patterns
   */
  detectConstraintHints(
    data: ExcelData,
    mapping: ColumnMapping
  ): ConstraintHint[] {
    const hints: ConstraintHint[] = [];
    const colIndex = data.headers.indexOf(mapping.excelColumn);
    if (colIndex === -1) return hints;

    const values = data.rows.map(r => r[colIndex]).filter(v => v != null && v !== '');
    const unique = new Set(values.map(v => String(v).trim()));

    // Detect unique constraint
    if (unique.size === values.length && values.length > 0) {
      hints.push({
        column: mapping.excelColumn,
        type: 'unique',
        confidence: 0.9,
        reason: 'All non-null values are unique',
      });
    }

    // Detect not-null
    const nullCount = data.rows.filter(r => r[colIndex] == null || r[colIndex] === '').length;
    if (nullCount === 0) {
      hints.push({
        column: mapping.excelColumn,
        type: 'not-null',
        confidence: 0.95,
        reason: 'No NULL values found in column',
      });
    }

    return hints;
  }

  /**
   * Validate format (email, phone, url, etc.)
   */
  private validateFormat(value: string, format: string): boolean {
    const formats: Record<string, RegExp> = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      phone: /^[\d\-\+\(\)\s]+$/,
      url: /^https?:\/\//,
      ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
      zipcode: /^\d{5}(-\d{4})?$/,
    };

    const regex = formats[format];
    return regex ? regex.test(value) : true;
  }

  /**
   * Run comprehensive validation with all checks
   */
  runComprehensiveValidation(
    data: ExcelData,
    mappings: ColumnMapping[],
    fkReferences?: Map<string, Set<string>>
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Type validation
    errors.push(...this.validateDataTypes(data, mappings));

    // Unique constraint validation
    errors.push(...this.validateUniqueConstraints(data, mappings));

    // Foreign key validation (if references provided)
    if (fkReferences) {
      errors.push(...this.validateForeignKeyConstraints(data, mappings, fkReferences));
    }

    // Custom rule validation for each row
    for (const mapping of mappings) {
      const colIndex = data.headers.indexOf(mapping.excelColumn);
      if (colIndex === -1) continue;

      for (let rowIndex = 0; rowIndex < data.rows.length; rowIndex++) {
        const value = data.rows[rowIndex][colIndex];
        const ruleErrors = this.validateByRules(value, mappings, mapping.excelColumn);

        ruleErrors.forEach(err => {
          err.row = rowIndex + 2; // +2 for header + 1-indexed
        });

        errors.push(...ruleErrors);
      }
    }

    return errors;
  }
}

// Singleton instance
export const validationEngine = new AdvancedValidationEngine();

/**
 * Export functions for convenient use
 */
export function registerValidationRule(rule: ValidationRule): void {
  validationEngine.registerRule(rule);
}

export function validateWithCustomRules(
  data: ExcelData,
  mappings: ColumnMapping[],
  fkReferences?: Map<string, Set<string>>
): ValidationError[] {
  return validationEngine.runComprehensiveValidation(data, mappings, fkReferences);
}

export function detectConstraints(
  data: ExcelData,
  mappings: ColumnMapping[]
): Map<string, ConstraintHint[]> {
  const hints = new Map<string, ConstraintHint[]>();

  for (const mapping of mappings) {
    const columnHints = validationEngine.detectConstraintHints(data, mapping);
    if (columnHints.length > 0) {
      hints.set(mapping.excelColumn, columnHints);
    }
  }

  return hints;
}
