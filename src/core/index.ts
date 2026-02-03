/**
 * Core module exports
 * Framework-agnostic Excel-to-SQL engine
 */

// Types
export * from './types';

// Excel parsing
export {
  parseExcelFile,
  parseSheet,
  getSheetNames,
  previewSheet,
  type ParseOptions,
} from './excel/parser';

// Multi-sheet parsing
export {
  parseMultiSheet,
  parseAllSheets,
  getSheetNamesQuick,
  buildContextFromSheets,
  type MultiSheetParseOptions,
} from './excel/multi-sheet';

// Excel export
export {
  buildWorkbookBuffer,
  type ExportWorkbookOptions,
} from './excel/export';

// Schema inference
export {
  inferColumnType,
  analyzeColumns,
  inferSchema,
  isPrimaryKeyCandidate,
  suggestConstraints,
  type InferOptions,
} from './schema/inference';

// SQL generation
export {
  generateSQL,
  generateCreateTable,
  generateInserts,
  generateUpserts,
  formatValue,
  escapeString,
  quoteIdentifier,
  type GenerateOptions,
} from './sql/generator';

// Validation
export {
  validateData,
  validateRow,
  validateType,
  checkDuplicates,
  calculateQualityScore,
  type ValidateOptions,
} from './validate';

// VLOOKUP engine
export {
  applyVLookups,
  type VLookupOptions,
} from './vlookup/engine';

// Preview
export {
  buildPreviewData,
  buildMultiSheetPreview,
  analyzeColumnsForPreview,
  type PreviewOptions,
} from './preview';
