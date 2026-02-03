/**
 * Preview Module
 * Independent from SQL generation and VLOOKUP
 */

import type { ExcelSheet } from '../types';
import type { ColumnInfo, PreviewData } from '../types/vlookup';

export interface PreviewOptions {
  /** Number of sample rows to return */
  sampleRows?: number;
  /** Number of sample values per column */
  sampleValues?: number;
}

const DEFAULT_OPTIONS: PreviewOptions = {
  sampleRows: 20,
  sampleValues: 3,
};

/**
 * Build preview data for a single sheet
 */
export function buildPreviewData(
  sheet: ExcelSheet,
  options: PreviewOptions = {}
): PreviewData {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const sampleRows = sheet.rows.slice(0, opts.sampleRows);
  const columns = analyzeColumnsForPreview(sheet, opts.sampleValues!);

  return {
    columns,
    rowCount: sheet.rowCount,
    sampleRows,
    sheets: [sheet.name],
    activeSheet: sheet.name,
  };
}

/**
 * Build preview data for multi-sheet
 */
export function buildMultiSheetPreview(
  sheets: ExcelSheet[],
  activeSheet: string,
  options: PreviewOptions = {}
): PreviewData {
  const active = sheets.find(s => s.name === activeSheet) ?? sheets[0];
  const preview = buildPreviewData(active, options);

  return {
    ...preview,
    sheets: sheets.map(s => s.name),
    activeSheet: active.name,
  };
}

/**
 * Analyze columns for preview (name + sample value + type hint)
 */
export function analyzeColumnsForPreview(
  sheet: ExcelSheet,
  sampleCount: number = 3
): ColumnInfo[] {
  return sheet.headers.map((name, index) => {
    const samples: unknown[] = [];
    let nullCount = 0;

    for (const row of sheet.rows) {
      const value = row[index];
      if (value === null || value === undefined || value === '') {
        nullCount++;
      }
      if (samples.length < sampleCount && value !== null && value !== undefined && value !== '') {
        samples.push(value);
      }
      if (samples.length >= sampleCount) break;
    }

    return {
      name,
      index,
      samples,
      typeHint: detectTypeHint(samples),
      nullCount,
    };
  });
}

function detectTypeHint(samples: unknown[]): ColumnInfo['typeHint'] {
  if (samples.length === 0) return 'text';

  let numberCount = 0;
  let dateCount = 0;
  let booleanCount = 0;

  for (const value of samples) {
    if (typeof value === 'number' && !isNaN(value)) numberCount++;
    else if (value instanceof Date) dateCount++;
    else if (typeof value === 'boolean') booleanCount++;
    else if (!isNaN(Number(value))) numberCount++;
  }

  if (numberCount === samples.length) return 'number';
  if (dateCount === samples.length) return 'date';
  if (booleanCount === samples.length) return 'boolean';
  if (numberCount > 0 || dateCount > 0 || booleanCount > 0) return 'mixed';

  return 'text';
}
