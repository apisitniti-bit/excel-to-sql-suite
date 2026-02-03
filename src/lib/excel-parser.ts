/**
 * Compatibility wrapper for legacy UI imports
 * Re-exports from new core modules
 * @deprecated UI should migrate to @/core directly
 */

import { parseMultiSheet } from '@/core/excel/multi-sheet';
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
  sheetData?: {
    name: string;
    headers: string[];
    rows: unknown[][];
    rowCount: number;
  }[];
}> {
  console.log('[parseExcelFile] Starting parse for:', file.name, 'size:', file.size);
  
  try {
    const arrayBuffer = await fileToArrayBuffer(file);
    console.log('[parseExcelFile] File read successfully, bytes:', arrayBuffer.byteLength);
    
    // Parse all sheets for cross-sheet VLOOKUP support
    const parsed = await parseMultiSheet(arrayBuffer, { maxRows: 1000, parseAllSheets: true });
    console.log('[parseExcelFile] Core parse complete:', {
      fileName: parsed.fileName,
      sheetCount: parsed.sheets.length,
      activeSheet: parsed.activeSheet
    });
    
    const activeSheet = parsed.sheets.find(s => s.name === parsed.activeSheet);
    
    if (!activeSheet) {
      console.error('[parseExcelFile] Active sheet not found in parsed sheets');
      throw new Error('Failed to parse active sheet');
    }
    
    console.log('[parseExcelFile] Active sheet data:', {
      name: activeSheet.name,
      rowCount: activeSheet.rowCount,
      headerCount: activeSheet.headers.length
    });
    
    if (!activeSheet.headers || activeSheet.headers.length === 0) {
      console.error('[parseExcelFile] No headers found in sheet');
      throw new Error('No headers found in Excel file');
    }
    
    return {
      headers: activeSheet.headers,
      rows: activeSheet.rows,
      totalRows: activeSheet.rowCount,
      fileName: file.name,
      sheetName: activeSheet.name || 'Sheet1',
      sheets: parsed.sheets.map(s => s.name),
      sheetData: parsed.sheets.map(s => ({
        name: s.name,
        headers: s.headers,
        rows: s.rows,
        rowCount: s.rowCount,
      })),
    };
  } catch (error) {
    console.error('[parseExcelFile] Parse failed:', error);
    throw error;
  }
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
