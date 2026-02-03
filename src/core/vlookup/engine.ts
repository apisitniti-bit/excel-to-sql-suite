/**
 * VLOOKUP Engine (Standalone)
 * Cleanly separated from SQL generation and UPDATE/INSERT logic
 */

import type {
  VLookupConfig,
  VLookupSet,
  VLookupResult,
  LookupStats,
  LookupError,
  MultiSheetContext,
} from '../types/vlookup';
import type { ExcelSheet } from '../types';

const EMPTY_RESULT: VLookupResult = {
  rows: [],
  headers: [],
  stats: [],
  errors: [],
};

export interface VLookupOptions {
  /** Skip lookups and return original data */
  disabled?: boolean;
  /** If true, return errors for missing columns/sheets and stop */
  failFast?: boolean;
}

/**
 * Apply VLOOKUPs to a sheet using multi-sheet context
 */
export function applyVLookups(
  sheet: ExcelSheet,
  lookupSet: VLookupSet,
  context?: MultiSheetContext,
  options: VLookupOptions = {}
): VLookupResult {
  if (!lookupSet.enabled || lookupSet.lookups.length === 0 || options.disabled) {
    return {
      rows: sheet.rows,
      headers: sheet.headers,
      stats: [],
      errors: [],
    };
  }

  const errors: LookupError[] = [];
  const stats: LookupStats[] = [];

  const outputHeaders = buildOutputHeaders(sheet.headers, lookupSet.lookups);

  // Build lookup processors for each config
  const processors = lookupSet.lookups.map(config => {
    try {
      return createLookupProcessor(config, sheet, outputHeaders, context);
    } catch (error) {
      const err = classifyLookupError(error, config.id);
      errors.push(err);
      return null;
    }
  }).filter(Boolean) as LookupProcessor[];

  if (options.failFast && errors.length > 0) {
    return { ...EMPTY_RESULT, errors };
  }

  const transformedRows: unknown[][] = [];
  const headers = outputHeaders;

  for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
    const row = sheet.rows[rowIndex];
    let newRow = [...row];

    for (const processor of processors) {
      const { value, matched, usedDefault, nullInput } = processor.resolve(row, rowIndex, errors);

      // Extend row if we need to add a new column
      if (processor.outputIndex >= newRow.length) {
        while (newRow.length <= processor.outputIndex) {
          newRow.push(null);
        }
      }

      newRow[processor.outputIndex] = value;

      processor.stats.totalRows++;
      if (nullInput) processor.stats.nullInputs++;
      if (matched) processor.stats.matched++;
      if (!matched && !nullInput) processor.stats.unmatched++;
      if (usedDefault && !nullInput) processor.stats.unmatched++;
    }

    transformedRows.push(newRow);
  }

  for (const processor of processors) {
    stats.push(processor.stats);
  }

  return {
    rows: transformedRows,
    headers,
    stats,
    errors,
  };
}

interface LookupProcessor {
  config: VLookupConfig;
  outputIndex: number;
  stats: LookupStats;
  resolve: (
    row: unknown[],
    rowIndex: number,
    errors: LookupError[]
  ) => { value: unknown; matched: boolean; usedDefault: boolean; nullInput: boolean };
}

function createLookupProcessor(
  config: VLookupConfig,
  sheet: ExcelSheet,
  outputHeaders: string[],
  context?: MultiSheetContext
): LookupProcessor {
  const sourceIndex = getColumnIndex(sheet, config.sourceColumn);
  const targetColumn = config.targetColumn ?? config.sourceColumn;

  // Output column index: existing column or new column at end
  const outputIndex = outputHeaders.findIndex(h => h === targetColumn);

  const stats: LookupStats = {
    lookupId: config.id,
    sourceColumn: config.sourceColumn,
    targetColumn,
    totalRows: 0,
    matched: 0,
    unmatched: 0,
    nullInputs: 0,
  };

  // Build lookup map
  const lookupMap = buildLookupMap(config, context, sheet);

  return {
    config,
    outputIndex,
    stats,
    resolve: (row, rowIndex, errors) => {
      const inputValue = row[sourceIndex];

      if (inputValue === null || inputValue === undefined || inputValue === '') {
        return {
          value: config.defaultValue ?? null,
          matched: false,
          usedDefault: true,
          nullInput: true,
        };
      }

      const key = normalizeKey(inputValue, config.caseSensitive, config.trimKeys);
      const result = lookupMap.get(key);

      if (result === undefined) {
        return {
          value: config.defaultValue ?? null,
          matched: false,
          usedDefault: true,
          nullInput: false,
        };
      }

      return {
        value: result,
        matched: true,
        usedDefault: false,
        nullInput: false,
      };
    },
  };
}

function buildLookupMap(
  config: VLookupConfig,
  context?: MultiSheetContext,
  sheet?: ExcelSheet
): Map<string, string> {
  if (config.sourceType === 'inline') {
    return buildInlineMap(config);
  }

  if (config.sourceType === 'sheet') {
    if (!context) {
      throw new Error('Multi-sheet context required for sheet lookups');
    }
    return buildSheetMap(config, context);
  }

  throw new Error(`Unsupported lookup source type: ${config.sourceType}`);
}

function buildInlineMap(config: VLookupConfig): Map<string, string> {
  if (!config.inlineMap) {
    throw new Error('Inline lookup requires inlineMap');
  }

  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(config.inlineMap)) {
    const normalizedKey = normalizeKey(key, config.caseSensitive, config.trimKeys);
    map.set(normalizedKey, value);
  }
  return map;
}

function buildSheetMap(config: VLookupConfig, context: MultiSheetContext): Map<string, string> {
  if (!config.sheetLookup) {
    throw new Error('Sheet lookup requires sheetLookup config');
  }

  const { sheetName, keyColumn, valueColumn } = config.sheetLookup;

  if (!context.hasSheet(sheetName)) {
    throw new Error(`Missing sheet "${sheetName}"`);
  }

  const targetSheet = context.getSheet(sheetName);
  const keyIndex = context.getColumnIndex(targetSheet, keyColumn);
  const valueIndex = context.getColumnIndex(targetSheet, valueColumn);

  const map = new Map<string, string>();

  for (const row of targetSheet.rows) {
    const keyValue = row[keyIndex];
    const valueValue = row[valueIndex];

    if (keyValue === null || keyValue === undefined || keyValue === '') {
      continue;
    }

    const normalizedKey = normalizeKey(keyValue, config.caseSensitive, config.trimKeys);
    map.set(normalizedKey, valueValue !== null && valueValue !== undefined ? String(valueValue) : '');
  }

  return map;
}

function getColumnIndex(sheet: ExcelSheet, columnName: string): number {
  let index = sheet.headers.indexOf(columnName);
  if (index >= 0) return index;

  const normalized = columnName.toLowerCase().trim();
  index = sheet.headers.findIndex(h => h.toLowerCase().trim() === normalized);
  if (index >= 0) return index;

  throw new Error(
    `Column "${columnName}" not found in sheet "${sheet.name}". ` +
    `Available: ${sheet.headers.join(', ')}`
  );
}

function buildOutputHeaders(headers: string[], lookups: VLookupConfig[]): string[] {
  const output = [...headers];

  for (const lookup of lookups) {
    const targetColumn = lookup.targetColumn ?? lookup.sourceColumn;
    if (!output.includes(targetColumn)) {
      output.push(targetColumn);
    }
  }

  return output;
}

function normalizeKey(value: unknown, caseSensitive: boolean, trimKeys: boolean): string {
  let result = String(value);
  if (trimKeys) result = result.trim();
  return caseSensitive ? result : result.toLowerCase();
}

function classifyLookupError(error: unknown, lookupId: string): LookupError {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('column') && normalized.includes('not found')) {
    return { lookupId, type: 'missing_column', message };
  }

  if (normalized.includes('missing sheet') || (normalized.includes('sheet') && normalized.includes('not found'))) {
    return { lookupId, type: 'missing_sheet', message };
  }

  return { lookupId, type: 'parse_error', message };
}
