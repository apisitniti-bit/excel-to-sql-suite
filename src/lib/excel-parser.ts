/**
 * Compatibility wrapper for legacy UI imports
 * Re-exports from new core modules
 * @deprecated UI should migrate to @/core directly
 */

import { parseExcelFile as coreParseFile, parseSheet } from '@/core/excel/parser';
import { analyzeColumns as coreAnalyzeColumns, inferSchema } from '@/core/schema/inference';
import type { ExcelSheet, ColumnAnalysis } from '@/core/types';

/**
 * @deprecated Use @/core/excel/parser instead
 */
export async function parseExcelFile(file: File): Promise<{
  headers: string[];
  rows: unknown[][];
  totalRows: number;
  fileName: string;
  sheetName: string;
  sheets: string[];
}> {
  const arrayBuffer = await fileToArrayBuffer(file);
  const parsed = await coreParseFile(arrayBuffer, { maxRows: 1000 });
  const activeSheet = parsed.sheets.find(s => s.name === parsed.activeSheet) || parsed.sheets[0];
  
  return {
    headers: activeSheet.headers,
    rows: activeSheet.rows,
    totalRows: activeSheet.rowCount,
    fileName: file.name,
    sheetName: activeSheet.name || 'Sheet1',
    sheets: parsed.sheets.map(s => s.name),
  };
}

/**
 * @deprecated Use @/core/schema/inference instead
 */
export function analyzeColumns(data: {
  headers: string[];
  rows: unknown[][];
}): Array<{
  name: string;
  index: number;
  sampleValues: string[];
  detectedType: import('@/core/types').PostgresDataType;
}> {
  const columns = coreAnalyzeColumns(data.headers, data.rows, { sampleSize: 100 });
  
  return columns.map(col => ({
    name: col.name,
    index: col.index,
    sampleValues: col.sampleValues.slice(0, 5).map(String),
    detectedType: col.detectedType,
  }));
}

function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
