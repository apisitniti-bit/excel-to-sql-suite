import type { ValidationError } from '@/types/converter';

/**
 * Error Reporter & Auto-Fix Suggestion Engine
 * Comprehensive error classification, reporting, and intelligent remediation suggestions
 */

export type ErrorCategory =
  | 'TYPE_MISMATCH'
  | 'NULL_CONSTRAINT'
  | 'DUPLICATE_KEY'
  | 'UNIQUE_CONSTRAINT'
  | 'FOREIGN_KEY'
  | 'ENCODING'
  | 'FORMAT'
  | 'CONSTRAINT'
  | 'DATABASE_ERROR'
  | 'VALIDATION_RULE';

export interface ErrorClassification {
  category: ErrorCategory;
  severity: 'error' | 'warning' | 'info';
  isRecoverable: boolean;
  affectedRows: number;
  rootCause: string;
  suggestedActions: string[];
}

export interface AutoFixSuggestion {
  id: string;
  title: string;
  description: string;
  action: 'override-type' | 'set-default' | 'skip-rows' | 'update-mapping' | 'clean-data' | 'use-conflict-mode';
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string; // describes what will happen
  isAutomatic: boolean; // can be applied without user confirmation
}

export interface ErrorReport {
  totalErrors: number;
  errorsByCategory: Map<ErrorCategory, ValidationError[]>;
  errorsBySeverity: Map<'error' | 'warning' | 'info', ValidationError[]>;
  errorsByColumn: Map<string, ValidationError[]>;
  classifiedErrors: Map<string, ErrorClassification>;
  suggestions: AutoFixSuggestion[];
  exportedAt: ISO8601String;
}

type ISO8601String = string;

class ErrorReporter {
  /**
   * Classify an error and determine recovery strategy
   */
  classifyError(error: ValidationError): ErrorClassification {
    const message = error.message.toLowerCase();
    let category: ErrorCategory = 'VALIDATION_RULE';
    let rootCause = '';
    const suggestedActions: string[] = [];
    let isRecoverable = false;

    if (message.includes('type mismatch')) {
      category = 'TYPE_MISMATCH';
      rootCause = 'Column value cannot be coerced to target data type';
      suggestedActions.push('Override the detected data type');
      suggestedActions.push('Apply data transformation/cleaning');
      suggestedActions.push('Skip affected rows');
      isRecoverable = true;
    } else if (message.includes('not null') || message.includes('empty')) {
      category = 'NULL_CONSTRAINT';
      rootCause = 'Non-nullable column contains NULL or empty values';
      suggestedActions.push('Provide default value for NULL cells');
      suggestedActions.push('Update mapping: mark column as nullable');
      suggestedActions.push('Skip rows with NULL values');
      suggestedActions.push('Remove column from mapping');
      isRecoverable = true;
    } else if (message.includes('duplicate') && message.includes('key')) {
      category = 'DUPLICATE_KEY';
      rootCause = 'Multiple rows have the same primary key value';
      suggestedActions.push('Use SKIP mode to keep existing records');
      suggestedActions.push('Use UPDATE mode to replace existing records');
      suggestedActions.push('Use UPSERT mode for merge behavior');
      suggestedActions.push('Remove duplicate rows from source data');
      isRecoverable = true;
    } else if (message.includes('unique')) {
      category = 'UNIQUE_CONSTRAINT';
      rootCause = 'Column with unique constraint has duplicate values';
      suggestedActions.push('Verify constraint is necessary');
      suggestedActions.push('Remove duplicates from data');
      suggestedActions.push('Use UPSERT mode if combining with primary key');
      isRecoverable = true;
    } else if (message.includes('foreign key') || message.includes('reference')) {
      category = 'FOREIGN_KEY';
      rootCause = 'Referenced value does not exist in target table';
      suggestedActions.push('Verify referenced value exists in database');
      suggestedActions.push('Insert referenced record first');
      suggestedActions.push('Skip rows with missing references');
      suggestedActions.push('Use UPSERT to automatically create references');
      isRecoverable = true;
    } else if (message.includes('encoding') || message.includes('utf')) {
      category = 'ENCODING';
      rootCause = 'Character encoding issue detected';
      suggestedActions.push('Save Excel file as UTF-8');
      suggestedActions.push('Re-encode file to UTF-8');
      suggestedActions.push('Specify encoding in upload settings');
      isRecoverable = true;
    } else if (message.includes('format')) {
      category = 'FORMAT';
      rootCause = 'Data format does not match expected pattern';
      suggestedActions.push('Review format specification');
      suggestedActions.push('Clean data to match expected format');
      suggestedActions.push('Use REGEX validation rule');
      isRecoverable = true;
    } else if (
      message.includes('connection') ||
      message.includes('timeout') ||
      message.includes('database')
    ) {
      category = 'DATABASE_ERROR';
      rootCause = 'Database operation failed';
      suggestedActions.push('Verify database connection settings');
      suggestedActions.push('Check database is accessible');
      suggestedActions.push('Verify user has required permissions');
      suggestedActions.push('Increase timeout setting');
      isRecoverable = false; // Requires manual intervention
    }

    return {
      category,
      severity: error.severity,
      isRecoverable,
      affectedRows: 1,
      rootCause,
      suggestedActions,
    };
  }

  /**
   * Generate auto-fix suggestions for common errors
   */
  generateAutoFixSuggestions(errors: ValidationError[]): AutoFixSuggestion[] {
    const suggestions: AutoFixSuggestion[] = [];
    const errorCounts = new Map<string, number>();

    // Aggregate error types
    for (const error of errors) {
      const key = error.message.split(':')[0];
      errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
    }

    // Generate suggestions for common patterns
    for (const [errorType, count] of errorCounts.entries()) {
      if (errorType.includes('Type Mismatch')) {
        suggestions.push({
          id: 'override-type-' + Date.now(),
          title: 'Override Data Type Detection',
          description: `${count} rows have type mismatches. You can override the detected type to allow coercion.`,
          action: 'override-type',
          severity: count > 100 ? 'high' : 'medium',
          impact: 'Data will be coerced to the new type. Some data may be lost if incompatible.',
          isAutomatic: false,
        });
      }

      if (errorType.includes('empty')) {
        suggestions.push({
          id: 'set-default-' + Date.now(),
          title: 'Set Default Value for Empty Cells',
          description: `${count} rows have empty cells in required columns. Set a default value for these.`,
          action: 'set-default',
          severity: 'high',
          impact: 'NULL cells will be replaced with the default value.',
          isAutomatic: false,
        });
      }

      if (errorType.includes('Duplicate')) {
        suggestions.push({
          id: 'conflict-mode-' + Date.now(),
          title: 'Select Conflict Resolution Mode',
          description: `${count} duplicate key(s) detected. Choose how to handle conflicts.`,
          action: 'use-conflict-mode',
          severity: 'critical',
          impact: 'Determines whether to skip, update, or merge duplicate records.',
          isAutomatic: false,
        });
      }

      if (errorType.includes('Unique')) {
        suggestions.push({
          id: 'unique-handling-' + Date.now(),
          title: 'Handle Unique Constraint Violations',
          description: `${count} unique constraint violation(s) detected. Review duplicates.`,
          action: 'clean-data',
          severity: 'high',
          impact: 'You must remove duplicates before proceeding.',
          isAutomatic: false,
        });
      }

      if (errorType.includes('Foreign Key')) {
        suggestions.push({
          id: 'fk-handling-' + Date.now(),
          title: 'Resolve Missing References',
          description: `${count} foreign key reference(s) not found. You can skip these rows or create missing references.`,
          action: 'skip-rows',
          severity: 'high',
          impact: 'Rows with missing references will not be imported.',
          isAutomatic: true,
        });
      }
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Generate comprehensive error report
   */
  generateReport(errors: ValidationError[]): ErrorReport {
    const errorsByCategory = new Map<ErrorCategory, ValidationError[]>();
    const errorsBySeverity = new Map<'error' | 'warning' | 'info', ValidationError[]>();
    const errorsByColumn = new Map<string, ValidationError[]>();
    const classifiedErrors = new Map<string, ErrorClassification>();

    // Classify and organize errors
    for (const error of errors) {
      const classification = this.classifyError(error);
      const classKey = `${error.column}-${error.message.slice(0, 30)}`;

      classifiedErrors.set(classKey, classification);

      // Group by category
      if (!errorsByCategory.has(classification.category)) {
        errorsByCategory.set(classification.category, []);
      }
      errorsByCategory.get(classification.category)!.push(error);

      // Group by severity
      if (!errorsBySeverity.has(error.severity)) {
        errorsBySeverity.set(error.severity, []);
      }
      errorsBySeverity.get(error.severity)!.push(error);

      // Group by column
      if (!errorsByColumn.has(error.column)) {
        errorsByColumn.set(error.column, []);
      }
      errorsByColumn.get(error.column)!.push(error);
    }

    const suggestions = this.generateAutoFixSuggestions(errors);

    return {
      totalErrors: errors.length,
      errorsByCategory,
      errorsBySeverity,
      errorsByColumn,
      classifiedErrors,
      suggestions,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Export errors to CSV format
   */
  exportToCSV(errors: ValidationError[]): string {
    const headers = ['Row', 'Column', 'Severity', 'Message'];
    const rows = errors.map(e => [
      e.row,
      e.column,
      e.severity,
      `"${e.message.replace(/"/g, '""')}"`, // Escape quotes
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Export errors to JSON format
   */
  exportToJSON(errors: ValidationError[]): string {
    return JSON.stringify(errors, null, 2);
  }

  /**
   * Create detailed error summary for UI display
   */
  createSummary(errors: ValidationError[]): {
    totalErrors: number;
    errorCount: number;
    warningCount: number;
    byCategory: { [key: string]: number };
    byColumn: { [key: string]: number };
    topErrors: Array<{ message: string; count: number; severity: string }>;
  } {
    const summary = {
      totalErrors: errors.length,
      errorCount: errors.filter(e => e.severity === 'error').length,
      warningCount: errors.filter(e => e.severity === 'warning').length,
      byCategory: {} as { [key: string]: number },
      byColumn: {} as { [key: string]: number },
      topErrors: [] as Array<{ message: string; count: number; severity: string }>,
    };

    // Count by category (simplified)
    const categoryMap = new Map<string, number>();
    const columnMap = new Map<string, number>();
    const messageMap = new Map<string, { count: number; severity: string }>();

    for (const error of errors) {
      // Extract category from message
      const categoryMatch = error.message.match(/^([^:]+)/);
      const category = categoryMatch ? categoryMatch[1] : 'Other';

      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
      columnMap.set(error.column, (columnMap.get(error.column) || 0) + 1);

      const msgKey = error.message.slice(0, 50);
      if (!messageMap.has(msgKey)) {
        messageMap.set(msgKey, { count: 0, severity: error.severity });
      }
      const data = messageMap.get(msgKey)!;
      data.count++;
    }

    // Convert maps to objects
    for (const [cat, count] of categoryMap) {
      summary.byCategory[cat] = count;
    }
    for (const [col, count] of columnMap) {
      summary.byColumn[col] = count;
    }

    // Top errors
    summary.topErrors = Array.from(messageMap.entries())
      .map(([msg, data]) => ({
        message: msg,
        count: data.count,
        severity: data.severity,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return summary;
  }
}

// Singleton instance
export const errorReporter = new ErrorReporter();

/**
 * Export convenience functions
 */
export function classifyValidationError(error: ValidationError): ErrorClassification {
  return errorReporter.classifyError(error);
}

export function generateErrorReport(errors: ValidationError[]): ErrorReport {
  return errorReporter.generateReport(errors);
}

export function suggestAutoFixes(errors: ValidationError[]): AutoFixSuggestion[] {
  return errorReporter.generateAutoFixSuggestions(errors);
}

export function exportErrorsAsCSV(errors: ValidationError[]): string {
  return errorReporter.exportToCSV(errors);
}

export function exportErrorsAsJSON(errors: ValidationError[]): string {
  return errorReporter.exportToJSON(errors);
}

export function getErrorSummary(errors: ValidationError[]): ReturnType<ErrorReporter['createSummary']> {
  return errorReporter.createSummary(errors);
}
