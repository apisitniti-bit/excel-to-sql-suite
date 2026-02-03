/**
 * Schema Inference Module
 * PostgreSQL-focused type detection
 * No dependencies on Excel parsing or SQL generation
 */

import type { 
  ColumnAnalysis, 
  SchemaInference, 
  PostgresDataType, 
  TypeRule 
} from '../types';

// Type detection rules - ordered by specificity (highest first)
const TYPE_RULES: TypeRule[] = [
  // UUID: Strict pattern match
  {
    type: 'UUID',
    priority: 100,
    test: (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v),
  },
  
  // Boolean: Limited set of values
  {
    type: 'BOOLEAN',
    priority: 90,
    test: (v) => /^(true|false|1|0|yes|no|y|n|t|f)$/i.test(v),
  },
  
  // Integer (32-bit range)
  {
    type: 'INTEGER',
    priority: 80,
    test: (v) => {
      if (!/^-?\d+$/.test(v)) return false;
      const num = Number(v);
      return num >= -2147483648 && num <= 2147483647;
    },
  },
  
  // BigInt (64-bit range)
  {
    type: 'BIGINT',
    priority: 75,
    test: (v) => /^-?\d+$/.test(v),
  },
  
  // Decimal/Numeric
  {
    type: 'DECIMAL',
    priority: 70,
    test: (v) => /^-?\d+\.?\d*([eE][+-]?\d+)?$/.test(v) && !isNaN(Number(v)),
  },
  
  // Timestamp with timezone
  {
    type: 'TIMESTAMPTZ',
    priority: 60,
    test: (v) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(v),
  },
  
  // Date only
  {
    type: 'DATE',
    priority: 55,
    test: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
  },
  
  // Time only
  {
    type: 'TIME',
    priority: 54,
    test: (v) => /^\d{2}:\d{2}:\d{2}/.test(v),
  },
  
  // JSONB (objects and arrays only, not primitives)
  {
    type: 'JSONB',
    priority: 50,
    test: (v) => {
      if (!v.startsWith('{') && !v.startsWith('[')) return false;
      try {
        const parsed = JSON.parse(v);
        return typeof parsed === 'object' && parsed !== null;
      } catch {
        return false;
      }
    },
  },
  
  // Default: TEXT
  {
    type: 'TEXT',
    priority: 0,
    test: () => true,
  },
];

export interface InferOptions {
  sampleSize?: number;     // Rows to sample for type detection
  confidenceThreshold?: number; // Minimum confidence (0-1) to accept type
  detectPrimaryKey?: boolean;
}

const DEFAULT_OPTIONS: InferOptions = {
  sampleSize: 1000,
  confidenceThreshold: 0.95,
  detectPrimaryKey: true,
};

/**
 * Analyze column values and infer PostgreSQL type
 */
export function inferColumnType(
  values: unknown[],
  options: InferOptions = {}
): { type: PostgresDataType; confidence: number } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const nonNullValues = values.filter(v => v !== null && v !== undefined);
  const stringValues = nonNullValues.map(v => String(v).trim());
  const nonEmptyValues = stringValues.filter(v => v !== '');
  
  if (nonEmptyValues.length === 0) {
    return { type: 'TEXT', confidence: 1 };
  }
  
  // Test each rule against all non-empty values
  for (const rule of TYPE_RULES.sort((a, b) => b.priority - a.priority)) {
    const matchingCount = nonEmptyValues.filter(v => rule.test(v)).length;
    const confidence = matchingCount / nonEmptyValues.length;
    
    if (confidence >= opts.confidenceThreshold!) {
      return { type: rule.type, confidence };
    }
  }
  
  return { type: 'TEXT', confidence: 1 };
}

/**
 * Analyze all columns in a dataset
 */
export function analyzeColumns(
  headers: string[],
  rows: unknown[][],
  options: InferOptions = {}
): ColumnAnalysis[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const sampleRows = rows.slice(0, opts.sampleSize);
  
  return headers.map((name, index) => {
    const columnValues = sampleRows.map(row => row[index]);
    const allValues = rows.map(row => row[index]);
    
    const nullCount = columnValues.filter(v => v === null || v === undefined).length;
    const emptyStringCount = columnValues.filter(v => v === '').length;
    const uniqueValues = new Set(columnValues.filter(v => v !== null && v !== undefined));
    
    const { type, confidence } = inferColumnType(columnValues, opts);
    
    return {
      name,
      index,
      sampleValues: columnValues.slice(0, 10),
      nullCount,
      emptyStringCount,
      totalCount: columnValues.length,
      uniqueValues,
      detectedType: type,
      confidence,
    };
  });
}

/**
 * Detect if a column is a good candidate for primary key
 */
export function isPrimaryKeyCandidate(column: ColumnAnalysis): boolean {
  // Must be unique
  if (column.uniqueValues.size !== column.totalCount - column.nullCount) {
    return false;
  }
  
  // Must be non-null (or mostly non-null)
  if (column.nullCount > 0) {
    return false;
  }
  
  // Prefer INTEGER, BIGINT, UUID, or TEXT with reasonable length
  const goodTypes: PostgresDataType[] = ['INTEGER', 'BIGINT', 'SERIAL', 'BIGSERIAL', 'UUID', 'TEXT'];
  if (!goodTypes.includes(column.detectedType)) {
    return false;
  }
  
  return true;
}

/**
 * Infer complete schema from parsed data
 */
export function inferSchema(
  headers: string[],
  rows: unknown[][],
  options: InferOptions = {}
): SchemaInference {
  const columns = analyzeColumns(headers, rows, options);
  
  // Find primary key candidate
  let suggestedPrimaryKey: string | undefined;
  for (const col of columns) {
    if (isPrimaryKeyCandidate(col)) {
      suggestedPrimaryKey = col.name;
      break;
    }
  }
  
  // Calculate overall quality score
  const totalCells = columns.length * rows.length;
  const nullCells = columns.reduce((sum, col) => sum + col.nullCount, 0);
  const qualityScore = Math.round(((totalCells - nullCells) / totalCells) * 100);
  
  return {
    columns,
    suggestedPrimaryKey,
    qualityScore,
  };
}

/**
 * Get recommended column constraints
 */
export function suggestConstraints(
  column: ColumnAnalysis
): { nullable: boolean; unique: boolean; default?: string } {
  const nullable = column.nullCount > 0;
  const unique = column.uniqueValues.size === column.totalCount - column.nullCount;
  
  let defaultValue: string | undefined;
  if (column.detectedType === 'BOOLEAN' && !nullable) {
    defaultValue = 'false';
  }
  
  return { nullable, unique, default: defaultValue };
}
